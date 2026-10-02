/**
 * Persistence-of-vision text engine.
 *
 * Renders a static black/white noise field, then makes a parametrable text
 * perceptible ONLY through motion: as the text drifts (and optionally rotates)
 * across the field, the cells under its shape are inverted (black <-> white)
 * every frame. The moving pattern of flips reads as text to the human eye,
 * while any single frozen frame is just noise. Freeze the motion and the text
 * vanishes into the background.
 *
 * Concept adapted from optical.toys "POV static cube": there the moving shape
 * is a cube's edges; here it is the outline (or fill) of arbitrary text.
 *
 * Zero dependency, DOM/canvas only. The pure helpers live in geometry.ts.
 */

import {
  centerOffsets,
  noiseAt,
  rotatePoint,
  shapeCells,
  stepBounce,
  stepPingPong,
  type Point,
  type PovMode,
} from "./geometry";

export type { PovMode };

export type PovBackground = "static" | "oscillate";

export type PovOptions = {
  text?: string;
  /** Noise cell size in pixels (bigger = coarser). */
  cellSize?: number;
  fontSize?: number;
  fontFamily?: string;
  /** Drift speed in pixels per frame. */
  speed?: number;
  /** Rotation speed in radians per frame (0 = no rotation). */
  rotationSpeed?: number;
  /**
   * Maximum tilt in radians. The text oscillates within [-maxRotation,
   * +maxRotation] and never spins past it, so it stays readable. Clamped to
   * PI/2 (a 180 degrees total swing) at most.
   */
  maxRotation?: number;
  /** Invert the glyph outline (default) or its full fill. */
  mode?: PovMode;
  /**
   * Background strategy.
   * - "static": noise drawn once, only the text cells flip (original toy).
   * - "oscillate": a fixed noise texture gently sways; the text region sways in
   *   a different direction. The shape reads from motion contrast, not flicker.
   */
  background?: PovBackground;
  /** Oscillate mode only: sway amplitude in cells. */
  oscAmplitude?: number;
  /**
   * Minimum milliseconds between field updates (0 = every animation frame).
   * Higher = slower, calmer motion.
   */
  stepMs?: number;
  /** Toggle motion when the canvas is clicked, like the original toy. */
  pauseOnClick?: boolean;
  /** Injectable RNG for deterministic noise (defaults to Math.random). */
  rng?: () => number;
};

export type PovController = {
  start: () => void;
  stop: () => void;
  toggle: () => void;
  running: () => boolean;
  setText: (text: string) => void;
  destroy: () => void;
};

export const DEFAULT_TEXT = "FANTOM";

const DEFAULTS = {
  text: DEFAULT_TEXT,
  cellSize: 5,
  fontSize: 130,
  fontFamily: "system-ui, sans-serif",
  speed: 1.4,
  rotationSpeed: 0.01,
  maxRotation: Math.PI / 8,
  mode: "outline" as PovMode,
  background: "static" as PovBackground,
  oscAmplitude: 4,
  stepMs: 55,
  pauseOnClick: true,
};

/**
 * Rasterise text to a boolean ink mask sampled at cell resolution. Needs a
 * DOM canvas, so this is not part of the pure helpers.
 */
function buildTextMask(
  text: string,
  fontSize: number,
  fontFamily: string,
  cellSize: number,
): boolean[][] {
  const off = document.createElement("canvas");
  const octx = off.getContext("2d");
  if (!octx) return [];
  const font = `bold ${fontSize}px ${fontFamily}`;
  octx.font = font;
  const width = Math.max(1, Math.ceil(octx.measureText(text).width) + cellSize);
  const height = Math.ceil(fontSize * 1.4);
  off.width = width;
  off.height = height;
  octx.font = font;
  octx.textBaseline = "middle";
  octx.fillStyle = "#fff";
  octx.fillText(text, cellSize / 2, height / 2);

  const data = octx.getImageData(0, 0, width, height).data;
  const cols = Math.ceil(width / cellSize);
  const rows = Math.ceil(height / cellSize);
  const mask: boolean[][] = [];
  for (let gy = 0; gy < rows; gy++) {
    const row: boolean[] = [];
    for (let gx = 0; gx < cols; gx++) {
      const px = Math.min(width - 1, gx * cellSize + (cellSize >> 1));
      const py = Math.min(height - 1, gy * cellSize + (cellSize >> 1));
      const alpha = data[(py * width + px) * 4 + 3] ?? 0;
      row.push(alpha > 128);
    }
    mask.push(row);
  }
  return mask;
}

export function createPovText(
  canvas: HTMLCanvasElement,
  options: PovOptions = {},
): PovController {
  const opts = { ...DEFAULTS, ...options };
  const rng = options.rng ?? Math.random;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2d canvas context unavailable");
  // Typed non-null so the hoisted render functions below keep the narrowing.
  const ctx: CanvasRenderingContext2D = context;

  const cell = opts.cellSize;
  const width = canvas.width;
  const height = canvas.height;
  const cols = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const oscillate = opts.background === "oscillate";
  const seed = Math.floor(rng() * 0x7fffffff);
  // Never let the text swing more than 180 degrees total (PI/2 each way).
  const maxRotation = Math.min(Math.abs(opts.maxRotation), Math.PI / 2);

  // --- static-mode state (persistent noise, only text cells flip) ---
  const grid = new Uint8Array(cols * rows);
  let offsets: Point[] = [];
  let halfW = 0;
  let halfH = 0;
  let cx = width / 2;
  let cy = height / 2;
  let vx = opts.speed;
  let vy = opts.speed;

  // --- oscillate-mode state (fixed texture, background and text sway apart) ---
  // Rendered at cell resolution into an offscreen buffer, then scaled up.
  let offCanvas: HTMLCanvasElement | null = null;
  let offCtx: CanvasRenderingContext2D | null = null;
  let buffer: ImageData | null = null;
  if (oscillate) {
    offCanvas = document.createElement("canvas");
    offCanvas.width = cols;
    offCanvas.height = rows;
    offCtx = offCanvas.getContext("2d");
    if (offCtx) buffer = offCtx.createImageData(cols, rows);
    ctx.imageSmoothingEnabled = false;
  }

  // Both regions shift 1 cell per tick along different axes, so they change at
  // the same rate and only the direction of motion sets the text apart.
  const textMask = new Uint8Array(oscillate ? cols * rows : 0);
  const amplitude = Math.max(1, Math.round(opts.oscAmplitude));
  let bg = { value: 0, dir: 1 };
  let tx = { value: amplitude, dir: -1 }; // phase-shifted so both are rarely still

  let tilt = { value: 0, dir: 1 };
  let running = false;
  let raf: number | null = null;
  let lastStep = 0;

  function drawNoise(): void {
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const on = rng() < 0.5 ? 1 : 0;
        grid[gy * cols + gx] = on;
        ctx.fillStyle = on ? "#fff" : "#000";
        ctx.fillRect(gx * cell, gy * cell, cell, cell);
      }
    }
  }

  function invertCell(px: number, py: number): void {
    const gx = Math.floor(px / cell);
    const gy = Math.floor(py / cell);
    if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) return;
    const idx = gy * cols + gx;
    const next = (grid[idx] ?? 0) ^ 1;
    grid[idx] = next;
    ctx.fillStyle = next ? "#fff" : "#000";
    ctx.fillRect(gx * cell, gy * cell, cell, cell);
  }

  function rebuild(text: string): void {
    const mask = buildTextMask(text, opts.fontSize, opts.fontFamily, cell);
    if (oscillate) {
      // Stamp the (fixed, centred) text region into a membership grid.
      textMask.fill(0);
      for (const o of centerOffsets(shapeCells(mask, "fill"), 1).offsets) {
        const gx = Math.round(cols / 2 + o.x);
        const gy = Math.round(rows / 2 + o.y);
        if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) continue;
        textMask[gy * cols + gx] = 1;
      }
      return;
    }
    const centered = centerOffsets(shapeCells(mask, opts.mode), cell);
    offsets = centered.offsets;
    halfW = centered.halfW;
    halfH = centered.halfH;
    cx = Math.min(Math.max(cx, halfW), width - halfW);
    cy = Math.min(Math.max(cy, halfH), height - halfH);
  }

  function setCell(data: Uint8ClampedArray, idx: number, gray: number): void {
    const b = idx * 4;
    data[b] = gray;
    data[b + 1] = gray;
    data[b + 2] = gray;
    data[b + 3] = 255;
  }

  function renderStatic(): void {
    const nx = stepBounce(cx, vx, halfW, width);
    cx = nx.pos;
    vx = nx.vel;
    const ny = stepBounce(cy, vy, halfH, height);
    cy = ny.pos;
    vy = ny.vel;
    tilt = stepPingPong(tilt.value, tilt.dir, opts.rotationSpeed, maxRotation);

    for (const o of offsets) {
      const r = rotatePoint(o.x, o.y, tilt.value);
      invertCell(cx + r.x, cy + r.y);
    }
  }

  function renderOscillate(): void {
    if (!buffer || !offCtx || !offCanvas) return;
    bg = stepPingPong(bg.value, bg.dir, 1, amplitude);
    tx = stepPingPong(tx.value, tx.dir, 1, amplitude);

    const data = buffer.data;
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const idx = gy * cols + gx;
        // Background sways horizontally, text vertically.
        const on = textMask[idx]
          ? noiseAt(gx, gy - tx.value, seed)
          : noiseAt(gx - bg.value, gy, seed);
        setCell(data, idx, on ? 255 : 0);
      }
    }
    offCtx.putImageData(buffer, 0, 0);
    ctx.drawImage(offCanvas, 0, 0, width, height);
  }

  function frame(now: number): void {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    // Throttle to stepMs: slows the motion without changing what a tick does.
    if (now - lastStep < opts.stepMs) return;
    lastStep = now;
    if (oscillate) renderOscillate();
    else renderStatic();
  }

  function start(): void {
    if (running) return;
    running = true;
    raf = requestAnimationFrame(frame);
  }

  function stop(): void {
    running = false;
    if (raf != null) cancelAnimationFrame(raf);
    raf = null;
  }

  function toggle(): void {
    if (running) stop();
    else start();
  }

  if (opts.pauseOnClick) canvas.addEventListener("click", toggle);

  if (!oscillate) drawNoise();
  rebuild(opts.text);
  start();

  return {
    start,
    stop,
    toggle,
    running: () => running,
    setText: rebuild,
    destroy() {
      stop();
      if (opts.pauseOnClick) canvas.removeEventListener("click", toggle);
    },
  };
}
