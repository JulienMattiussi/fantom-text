/**
 * Generate the brand assets: public/og.svg (source), public/og.png (the
 * og:image, since Facebook/LinkedIn reject SVG) and public/favicon.svg.
 *
 * The noise is generated rather than hand-drawn, so the SVGs are produced here
 * too. The OG card shows what a still frame cannot: the text outline that only
 * motion reveals, with a short trail to suggest the drift.
 *
 * Run with: make build-og
 */

import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import { centerOffsets, shapeCells } from "../src/snippet/geometry.ts";
import { FONT_FAMILY, makeRng, textMask } from "./raster.ts";

const BG = "#0e0d14";
const ACCENT = "#9b7bff";
const MUTED = "#a7a4b8";
const BORDER = "#2a2838";

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(here, "../public");

/** One path covering every white cell of a random cols x rows field. */
function noisePath(
  cols: number,
  rows: number,
  cell: number,
  rng: () => number,
): string {
  let d = "";
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (rng() < 0.5)
        d += `M${x * cell} ${y * cell}h${cell}v${cell}h-${cell}z`;
    }
  }
  return d;
}

/** Outline cells of `text` as a path centred on (cx, cy). */
function outlinePath(
  text: string,
  fontSize: number,
  cell: number,
  cx: number,
  cy: number,
): string {
  const { offsets } = centerOffsets(
    shapeCells(textMask(text, fontSize, cell), "outline"),
    cell,
  );
  return offsets
    .map((o) => {
      const x = Math.round((cx + o.x) / cell) * cell;
      const y = Math.round((cy + o.y) / cell) * cell;
      return `M${x} ${y}h${cell}v${cell}h-${cell}z`;
    })
    .join("");
}

function ogSvg(): string {
  const cell = 8;
  const panel = { x: 72, y: 95, w: 496, h: 440 };
  const noise = noisePath(panel.w / cell, panel.h / cell, cell, makeRng(7));
  const ghost = outlinePath("BOO", 190, cell, panel.w / 2 + 8, panel.h / 2);
  // Older positions of the drifting text, fading out.
  const trail = [
    { dx: -3, dy: 1, opacity: 0.3 },
    { dx: 0, dy: 0, opacity: 1 },
  ];
  const ghosts = trail
    .map(
      (t) =>
        `<path d="${ghost}" transform="translate(${t.dx * cell} ${t.dy * cell})" opacity="${t.opacity}"/>`,
    )
    .join("\n      ");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <clipPath id="panel"><rect width="${panel.w}" height="${panel.h}" rx="24"/></clipPath>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="2.5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="1200" height="630" fill="${BG}"/>

  <g transform="translate(${panel.x} ${panel.y})">
    <g clip-path="url(#panel)">
      <rect width="${panel.w}" height="${panel.h}" fill="#000"/>
      <path d="${noise}" fill="#fff" opacity="0.7"/>
      <g fill="${ACCENT}" filter="url(#glow)">
      ${ghosts}
      </g>
    </g>
    <rect width="${panel.w}" height="${panel.h}" rx="24" fill="none" stroke="${BORDER}" stroke-width="2"/>
  </g>

  <g font-family="${FONT_FAMILY}">
    <text x="640" y="250" font-size="104" font-weight="800" letter-spacing="-3" fill="#fff">fantom</text>
    <text x="640" y="350" font-size="104" font-weight="800" letter-spacing="-3" fill="${ACCENT}">text</text>
    <text x="640" y="430" font-size="27" fill="${MUTED}">Un texte invisible dans le bruit,</text>
    <text x="640" y="466" font-size="27" fill="${MUTED}">révélé uniquement par le mouvement.</text>
    <text x="640" y="530" font-size="22" font-style="italic" fill="#6f6c80">Fige-le : il disparaît.</text>
  </g>
</svg>
`;
}

function faviconSvg(): string {
  const cell = 5;
  const noise = noisePath(100 / cell, 100 / cell, cell, makeRng(3));
  const ghost = "M20 90V46a30 30 0 0 1 60 0v44l-10-8-10 8-10-8-10 8-10-8z";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="fantom-text">
  <defs><clipPath id="ghost"><path d="${ghost}"/></clipPath></defs>
  <rect width="100" height="100" rx="22" fill="${BG}"/>
  <g clip-path="url(#ghost)">
    <rect width="100" height="100" fill="#fff"/>
    <path d="${noise}" fill="${ACCENT}" opacity="0.55"/>
  </g>
  <g fill="${BG}">
    <ellipse cx="39" cy="47" rx="6" ry="8"/>
    <ellipse cx="61" cy="47" rx="6" ry="8"/>
  </g>
</svg>
`;
}

const og = ogSvg();
writeFileSync(resolve(publicDir, "og.svg"), og);
writeFileSync(resolve(publicDir, "favicon.svg"), faviconSvg());
const png = new Resvg(og, {
  fitTo: { mode: "width", value: 1200 },
  font: { loadSystemFonts: true, defaultFontFamily: "Liberation Sans" },
})
  .render()
  .asPng();
writeFileSync(resolve(publicDir, "og.png"), png);
console.log(`Wrote og.svg, og.png (${png.byteLength} bytes), favicon.svg`);
