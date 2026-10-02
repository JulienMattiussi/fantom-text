/**
 * Shared helpers for the offline asset scripts (preview GIF, OG image).
 */

import { Resvg } from "@resvg/resvg-js";

export const FONT_FAMILY = "Liberation Sans, DejaVu Sans, Arial, sans-serif";

/** Deterministic RNG (mulberry32) so regenerating gives identical files. */
export function makeRng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Rasterise bold text to a boolean ink mask at cell resolution, like the
 * engine's buildTextMask but with resvg since Node has no canvas.
 */
export function textMask(
  text: string,
  fontSize: number,
  cell: number,
): boolean[][] {
  const w = Math.ceil(text.length * fontSize * 0.8);
  const h = Math.ceil(fontSize * 1.4);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <text x="${w / 2}" y="${h / 2}" text-anchor="middle" dominant-baseline="central"
      font-family="${FONT_FAMILY}" font-weight="bold"
      font-size="${fontSize}" fill="#fff">${text}</text></svg>`;
  const img = new Resvg(svg, { font: { loadSystemFonts: true } }).render();
  const cols = Math.ceil(w / cell);
  const rows = Math.ceil(h / cell);
  const mask: boolean[][] = [];
  for (let gy = 0; gy < rows; gy++) {
    const row: boolean[] = [];
    for (let gx = 0; gx < cols; gx++) {
      const px = Math.min(w - 1, gx * cell + (cell >> 1));
      const py = Math.min(h - 1, gy * cell + (cell >> 1));
      row.push((img.pixels[(py * w + px) * 4 + 3] ?? 0) > 128);
    }
    mask.push(row);
  }
  return mask;
}
