/**
 * Render the README animated preview (public/preview.gif).
 *
 * Replays the engine's "static" background mode offline: a fixed noise field
 * where only the cells under the drifting text outline flip each frame. It
 * reuses the engine's pure helpers (src/snippet/geometry.ts), so the GIF is
 * the real effect, not an approximation.
 *
 * Run with: make build-preview
 */

import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import gifenc from "gifenc";
import {
  centerOffsets,
  rotatePoint,
  shapeCells,
  stepBounce,
  stepPingPong,
} from "../src/snippet/geometry.ts";
import { makeRng, textMask } from "./raster.ts";

const TEXT = "BOO";
const WIDTH = 480;
const HEIGHT = 240;
const CELL = 4;
const FONT_SIZE = 120;
const SPEED = 1.6;
const ROTATION_SPEED = 0.01;
const MAX_ROTATION = Math.PI / 10;
const FRAMES = 90;
const DELAY_MS = 40;

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../public/preview.gif");

const rng = makeRng(42);
const cols = WIDTH / CELL;
const rows = HEIGHT / CELL;
const grid = new Uint8Array(cols * rows).map(() => (rng() < 0.5 ? 1 : 0));
const { offsets, halfW, halfH } = centerOffsets(
  shapeCells(textMask(TEXT, FONT_SIZE, CELL), "outline"),
  CELL,
);

let cx = WIDTH / 2;
let cy = HEIGHT / 2;
let vx = SPEED;
let vy = SPEED * 0.6;
let tilt = { value: 0, dir: 1 };

const gif = gifenc.GIFEncoder();
// Index 2 is transparent: after the first frame only flipped cells are
// encoded, the rest shows through from the previous frame (much smaller file).
const TRANSPARENT = 2;
const palette = [
  [0, 0, 0],
  [255, 255, 255],
  [255, 0, 255],
];
const pixels = new Uint8Array(WIDTH * HEIGHT);
const previous = grid.slice();

for (let f = 0; f < FRAMES; f++) {
  ({ pos: cx, vel: vx } = stepBounce(cx, vx, halfW, WIDTH));
  ({ pos: cy, vel: vy } = stepBounce(cy, vy, halfH, HEIGHT));
  tilt = stepPingPong(tilt.value, tilt.dir, ROTATION_SPEED, MAX_ROTATION);
  for (const o of offsets) {
    const r = rotatePoint(o.x, o.y, tilt.value);
    const gx = Math.floor((cx + r.x) / CELL);
    const gy = Math.floor((cy + r.y) / CELL);
    if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) continue;
    const idx = gy * cols + gx;
    grid[idx] = (grid[idx] ?? 0) ^ 1;
  }
  for (let y = 0; y < HEIGHT; y++) {
    const rowBase = Math.floor(y / CELL) * cols;
    for (let x = 0; x < WIDTH; x++) {
      const idx = rowBase + Math.floor(x / CELL);
      const value = grid[idx] ?? 0;
      pixels[y * WIDTH + x] =
        f > 0 && value === previous[idx] ? TRANSPARENT : value;
    }
  }
  previous.set(grid);
  gif.writeFrame(pixels, WIDTH, HEIGHT, {
    palette,
    delay: DELAY_MS,
    transparent: f > 0,
    transparentIndex: TRANSPARENT,
    dispose: 1,
  });
}

gif.finish();
const bytes = gif.bytes();
writeFileSync(out, bytes);
console.log(`Wrote ${out} (${bytes.byteLength} bytes)`);
