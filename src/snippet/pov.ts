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
 * Zero dependency, DOM/canvas only. The pure geometry helpers below are split
 * out so they can be unit-tested without a browser.
 */

export type PovMode = "outline" | "fill";

export type PovBackground = "static" | "dynamic" | "oscillate";

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
   *   Readable, but defeated by a naive frame difference.
   * - "dynamic": the whole field is re-randomised every frame; the text is a
   *   region of coherently scrolling noise. Resists a naive frame difference.
   * - "oscillate": a fixed noise texture gently sways; the text region sways in
   *   a different direction. The shape reads from motion contrast (not flicker),
   *   and both regions shift by the same amount each tick, so a naive frame
   *   difference stays uniform.
   */
  background?: PovBackground;
  /** Dynamic mode only: internal texture scroll, in cells per frame. */
  flowSpeed?: number;
  /** Oscillate mode only: sway amplitude in cells. */
  oscAmplitude?: number;
  /**
   * Minimum milliseconds between field updates (0 = every animation frame).
   * Higher = slower, calmer motion. Both background and text advance on the
   * same tick, so the anti-diff statistics are preserved.
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

/** Cell coordinate in a grid, in cell units. */
export type Cell = { x: number; y: number };

/**
 * Rotate a point around the origin. Pure.
 */
export function rotatePoint(
  x: number,
  y: number,
  angle: number,
): { x: number; y: number } {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

/**
 * Given a boolean ink mask (mask[y][x] = true where the glyph is drawn),
 * return the cells that make up the shape: for "outline", only ink cells that
 * touch a non-ink cell (4-neighbourhood); for "fill", every ink cell. Pure.
 */
export function shapeCells(mask: boolean[][], mode: PovMode): Cell[] {
  const cells: Cell[] = [];
  for (let y = 0; y < mask.length; y++) {
    const row = mask[y];
    if (!row) continue;
    for (let x = 0; x < row.length; x++) {
      if (!row[x]) continue;
      if (mode === "fill") {
        cells.push({ x, y });
        continue;
      }
      const isEdge =
        !mask[y - 1]?.[x] || !mask[y + 1]?.[x] || !row[x - 1] || !row[x + 1];
      if (isEdge) cells.push({ x, y });
    }
  }
  return cells;
}

/**
 * Re-centre a list of cells around their bounding-box centre, converting to
 * pixel offsets (multiplying by cellSize). Returns the offsets plus the half
 * extents used for wall bouncing. Pure.
 */
export function centerOffsets(
  cells: Cell[],
  cellSize: number,
): { offsets: Array<{ x: number; y: number }>; halfW: number; halfH: number } {
  if (cells.length === 0) {
    return { offsets: [], halfW: 0, halfH: 0 };
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const c of cells) {
    if (c.x < minX) minX = c.x;
    if (c.x > maxX) maxX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.y > maxY) maxY = c.y;
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const offsets = cells.map((c) => ({
    x: (c.x - cx) * cellSize,
    y: (c.y - cy) * cellSize,
  }));
  const halfW = ((maxX - minX) / 2) * cellSize;
  const halfH = ((maxY - minY) / 2) * cellSize;
  return { offsets, halfW, halfH };
}

/**
 * Advance one drifting coordinate, bouncing when the shape (half extent)
 * reaches a wall. Pure. Returns the new position and velocity.
 */
export function stepBounce(
  pos: number,
  vel: number,
  half: number,
  limit: number,
): { pos: number; vel: number } {
  let p = pos + vel;
  let v = vel;
  if (p - half <= 0 || p + half >= limit) {
    v = -v;
    p += v;
  }
  return { pos: p, vel: v };
}

/**
 * Oscillate the rotation angle within [-max, +max] instead of spinning freely:
 * text tilted past a mild angle is unreadable even for a human, so the shape
 * gently rocks back and forth rather than turning upside down. Pure.
 */
export function stepAngle(
  angle: number,
  dir: number,
  speed: number,
  max: number,
): { angle: number; dir: number } {
  let a = angle + speed * dir;
  let d = dir;
  if (a >= max) {
    a = max;
    d = -1;
  } else if (a <= -max) {
    a = -max;
    d = 1;
  }
  return { angle: a, dir: d };
}

/**
 * Deterministic 0/1 value hash for integer coordinates, used as a stable noise
 * texture. Sampling it at a scrolling offset produces coherent motion: shifting
 * x by one advances the whole texture rigidly. Pure.
 */
export function noiseAt(x: number, y: number, seed: number): 0 | 1 {
  let h = (Math.trunc(x) * 374761393 + Math.trunc(y) * 668265263 + seed) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h ^= h >>> 16;
  return (h & 1) as 0 | 1;
}

const DEFAULTS = {
  text: "FANTOM",
  cellSize: 5,
  fontSize: 130,
  fontFamily: "system-ui, sans-serif",
  speed: 1.4,
  rotationSpeed: 0.01,
  maxRotation: Math.PI / 8,
  mode: "outline" as PovMode,
  background: "static" as PovBackground,
  flowSpeed: 1,
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
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d canvas context unavailable");

  const cell = opts.cellSize;
  const width = canvas.width;
  const height = canvas.height;
  const cols = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const dynamic = opts.background === "dynamic";
  const oscillate = opts.background === "oscillate";
  const buffered = dynamic || oscillate;
  const seed = Math.floor(rng() * 0x7fffffff);
  // Never let the text swing more than 180 degrees total (PI/2 each way).
  const maxRotation = Math.min(Math.abs(opts.maxRotation), Math.PI / 2);

  // --- static-mode state (persistent noise, only text cells flip) ---
  const grid = new Uint8Array(cols * rows);
  let offsets: Array<{ x: number; y: number }> = [];
  let halfW = 0;
  let halfH = 0;
  let cx = width / 2;
  let cy = height / 2;
  let vx = opts.speed;
  let vy = opts.speed;

  // --- dynamic-mode state (whole field re-randomised, text texture scrolls) ---
  let filled: Cell[] = [];
  let cxCells = 0;
  let cyCells = 0;
  let scroll = 0;
  let offCanvas: HTMLCanvasElement | null = null;
  let offCtx: CanvasRenderingContext2D | null = null;
  let buffer: ImageData | null = null;
  if (buffered) {
    offCanvas = document.createElement("canvas");
    offCanvas.width = cols;
    offCanvas.height = rows;
    offCtx = offCanvas.getContext("2d");
    if (offCtx) buffer = offCtx.createImageData(cols, rows);
    ctx.imageSmoothingEnabled = false;
  }

  // --- oscillate-mode state (fixed texture, background and text sway apart) ---
  // 1 cell per tick each, so both regions change at the same rate (no readable
  // low-difference hole), but along different axes (motion contrast reveals it).
  const textMask = new Uint8Array(oscillate ? cols * rows : 0);
  let bgPos = 0;
  let bgDir = 1;
  let txPos = opts.oscAmplitude; // phase-shifted so both are rarely still
  let txDir = -1;

  function swayStep(pos: number, dir: number): { pos: number; dir: number } {
    const amp = Math.max(1, Math.round(opts.oscAmplitude));
    let p = pos + dir;
    let d = dir;
    if (p >= amp) {
      p = amp;
      d = -1;
    } else if (p <= -amp) {
      p = -amp;
      d = 1;
    }
    return { pos: p, dir: d };
  }

  let angle = 0;
  let rotDir = 1;
  let running = false;
  let raf: number | null = null;
  let lastStep = 0;

  function drawNoise(): void {
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const on = rng() < 0.5 ? 1 : 0;
        grid[gy * cols + gx] = on;
        ctx!.fillStyle = on ? "#fff" : "#000";
        ctx!.fillRect(gx * cell, gy * cell, cell, cell);
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
    ctx!.fillStyle = next ? "#fff" : "#000";
    ctx!.fillRect(gx * cell, gy * cell, cell, cell);
  }

  function rebuild(text: string): void {
    const mask = buildTextMask(text, opts.fontSize, opts.fontFamily, cell);
    if (buffered) {
      const cells = shapeCells(mask, "fill");
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const c of cells) {
        if (c.x < minX) minX = c.x;
        if (c.x > maxX) maxX = c.x;
        if (c.y < minY) minY = c.y;
        if (c.y > maxY) maxY = c.y;
      }
      filled = cells;
      cxCells = cells.length ? (minX + maxX) / 2 : 0;
      cyCells = cells.length ? (minY + maxY) / 2 : 0;
      if (oscillate) {
        // Stamp the (fixed, centred) text region into a membership grid.
        textMask.fill(0);
        const ccx = cols / 2;
        const ccy = rows / 2;
        for (const c of cells) {
          const gx = Math.round(ccx + (c.x - cxCells));
          const gy = Math.round(ccy + (c.y - cyCells));
          if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) continue;
          textMask[gy * cols + gx] = 1;
        }
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

  function setCell(data: Uint8ClampedArray, idx: number, on: number): void {
    const b = idx * 4;
    data[b] = on;
    data[b + 1] = on;
    data[b + 2] = on;
    data[b + 3] = 255;
  }

  function renderStatic(): void {
    const nx = stepBounce(cx, vx, halfW, width);
    cx = nx.pos;
    vx = nx.vel;
    const ny = stepBounce(cy, vy, halfH, height);
    cy = ny.pos;
    vy = ny.vel;
    const na = stepAngle(angle, rotDir, opts.rotationSpeed, maxRotation);
    angle = na.angle;
    rotDir = na.dir;

    for (const o of offsets) {
      const r = rotatePoint(o.x, o.y, angle);
      invertCell(cx + r.x, cy + r.y);
    }
  }

  function renderDynamic(): void {
    if (!buffer || !offCtx || !offCanvas) return;
    scroll += opts.flowSpeed;
    const na = stepAngle(angle, rotDir, opts.rotationSpeed, maxRotation);
    angle = na.angle;
    rotDir = na.dir;

    const data = buffer.data;
    // Re-randomise the whole field: a naive frame difference is noise here.
    for (let i = 0; i < cols * rows; i++) {
      setCell(data, i, rng() < 0.5 ? 255 : 0);
    }
    // Overlay the text as a coherently scrolling noise texture.
    const sx = Math.floor(scroll);
    const centerX = width / 2;
    const centerY = height / 2;
    for (const c of filled) {
      const r = rotatePoint(
        (c.x - cxCells) * cell,
        (c.y - cyCells) * cell,
        angle,
      );
      const gx = Math.floor((centerX + r.x) / cell);
      const gy = Math.floor((centerY + r.y) / cell);
      if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) continue;
      setCell(data, gy * cols + gx, noiseAt(c.x - sx, c.y, seed) ? 255 : 0);
    }
    offCtx.putImageData(buffer, 0, 0);
    ctx!.drawImage(offCanvas, 0, 0, width, height);
  }

  function renderOscillate(): void {
    if (!buffer || !offCtx || !offCanvas) return;
    const bg = swayStep(bgPos, bgDir);
    bgPos = bg.pos;
    bgDir = bg.dir;
    const tx = swayStep(txPos, txDir);
    txPos = tx.pos;
    txDir = tx.dir;

    const data = buffer.data;
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const idx = gy * cols + gx;
        // Background sways horizontally, text sways vertically: same 1-cell
        // shift per tick, different direction.
        const on = textMask[idx]
          ? noiseAt(gx, gy - txPos, seed)
          : noiseAt(gx - bgPos, gy, seed);
        setCell(data, idx, on ? 255 : 0);
      }
    }
    offCtx.putImageData(buffer, 0, 0);
    ctx!.drawImage(offCanvas, 0, 0, width, height);
  }

  function frame(now: number): void {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    // Throttle to stepMs so the motion can be slowed without touching the
    // per-tick statistics that keep the text hidden from a frame difference.
    if (now - lastStep < opts.stepMs) return;
    lastStep = now;
    if (dynamic) renderDynamic();
    else if (oscillate) renderOscillate();
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

  function onClick(): void {
    toggle();
  }

  if (opts.pauseOnClick) canvas.addEventListener("click", onClick);

  if (!buffered) drawNoise();
  rebuild(opts.text);
  start();

  return {
    start,
    stop,
    toggle,
    running: () => running,
    setText: (text: string) => rebuild(text),
    destroy() {
      stop();
      if (opts.pauseOnClick) canvas.removeEventListener("click", onClick);
    },
  };
}
