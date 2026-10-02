/**
 * Pure helpers of the POV engine (no DOM): shape extraction, motion steps and
 * the noise hash. Unit-tested without a browser and reused by the offline
 * asset scripts.
 */

export type PovMode = "outline" | "fill";

/** Coordinate pair, in cells or pixels depending on context. */
export type Point = { x: number; y: number };

/** Rotate a point around the origin. */
export function rotatePoint(x: number, y: number, angle: number): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

/**
 * Given a boolean ink mask (mask[y][x] = true where the glyph is drawn),
 * return the cells that make up the shape: for "outline", only ink cells that
 * touch a non-ink cell (4-neighbourhood); for "fill", every ink cell.
 */
export function shapeCells(mask: boolean[][], mode: PovMode): Point[] {
  const cells: Point[] = [];
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
 * Re-centre cells around their bounding-box centre, scaled by `scale` (the
 * cell size for pixel offsets, 1 to stay in cells). Also returns the half
 * extents, used for wall bouncing.
 */
export function centerOffsets(
  cells: Point[],
  scale: number,
): { offsets: Point[]; halfW: number; halfH: number } {
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
    x: (c.x - cx) * scale,
    y: (c.y - cy) * scale,
  }));
  const halfW = ((maxX - minX) / 2) * scale;
  const halfH = ((maxY - minY) / 2) * scale;
  return { offsets, halfW, halfH };
}

/**
 * Advance one drifting coordinate, bouncing when the shape (half extent)
 * reaches a wall. Returns the new position and velocity.
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
 * Move `value` by `step` in direction `dir`, clamping to [-max, +max] and
 * reversing at either end. Drives both the text tilt (it rocks instead of
 * turning upside down) and the oscillate background sway.
 */
export function stepPingPong(
  value: number,
  dir: number,
  step: number,
  max: number,
): { value: number; dir: number } {
  let v = value + step * dir;
  let d = dir;
  if (v >= max) {
    v = max;
    d = -1;
  } else if (v <= -max) {
    v = -max;
    d = 1;
  }
  return { value: v, dir: d };
}

/**
 * Deterministic 0/1 value hash for integer coordinates, used as a stable noise
 * texture. Sampling it at a shifted offset moves the whole texture rigidly.
 */
export function noiseAt(x: number, y: number, seed: number): 0 | 1 {
  let h = (Math.trunc(x) * 374761393 + Math.trunc(y) * 668265263 + seed) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h ^= h >>> 16;
  return (h & 1) as 0 | 1;
}
