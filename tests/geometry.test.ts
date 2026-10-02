import { describe, it, expect } from "vitest";
import {
  centerOffsets,
  noiseAt,
  rotatePoint,
  shapeCells,
  stepBounce,
  stepPingPong,
} from "../src/snippet/geometry";

describe("rotatePoint", () => {
  it("leaves a point unchanged at angle 0", () => {
    expect(rotatePoint(3, 4, 0)).toEqual({ x: 3, y: 4 });
  });

  it("rotates 90 degrees counterclockwise in canvas space", () => {
    const r = rotatePoint(1, 0, Math.PI / 2);
    expect(r.x).toBeCloseTo(0, 10);
    expect(r.y).toBeCloseTo(1, 10);
  });
});

describe("shapeCells", () => {
  // A 3x3 filled block: the centre cell is fully surrounded, the ring is edge.
  const block: boolean[][] = [
    [true, true, true],
    [true, true, true],
    [true, true, true],
  ];

  it("returns every ink cell in fill mode", () => {
    expect(shapeCells(block, "fill")).toHaveLength(9);
  });

  it("returns only the boundary cells in outline mode", () => {
    const outline = shapeCells(block, "outline");
    expect(outline).toHaveLength(8);
    expect(outline).not.toContainEqual({ x: 1, y: 1 });
  });

  it("treats every ink cell of a single row as edge", () => {
    const line: boolean[][] = [[true, true, true]];
    expect(shapeCells(line, "outline")).toHaveLength(3);
  });

  it("ignores non-ink cells", () => {
    const sparse: boolean[][] = [
      [false, true, false],
      [false, false, false],
    ];
    expect(shapeCells(sparse, "fill")).toEqual([{ x: 1, y: 0 }]);
  });
});

describe("centerOffsets", () => {
  it("centres a symmetric pair of cells around the origin", () => {
    const { offsets, halfW, halfH } = centerOffsets(
      [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ],
      10,
    );
    expect(offsets).toEqual([
      { x: -10, y: 0 },
      { x: 10, y: 0 },
    ]);
    expect(halfW).toBe(10);
    expect(halfH).toBe(0);
  });

  it("returns empty extents for no cells", () => {
    expect(centerOffsets([], 5)).toEqual({ offsets: [], halfW: 0, halfH: 0 });
  });
});

describe("stepPingPong", () => {
  it("advances by speed in the current direction below the cap", () => {
    expect(stepPingPong(0, 1, 0.1, 1)).toEqual({ value: 0.1, dir: 1 });
    expect(stepPingPong(0, -1, 0.1, 1)).toEqual({ value: -0.1, dir: -1 });
  });

  it("clamps and reverses at the positive cap", () => {
    const r = stepPingPong(0.95, 1, 0.1, 1);
    expect(r.value).toBe(1);
    expect(r.dir).toBe(-1);
  });

  it("clamps and reverses at the negative cap", () => {
    const r = stepPingPong(-0.95, -1, 0.1, 1);
    expect(r.value).toBe(-1);
    expect(r.dir).toBe(1);
  });

  it("never exceeds the cap over many steps", () => {
    let state = { value: 0, dir: 1 };
    const max = Math.PI / 8;
    for (let i = 0; i < 1000; i++) {
      state = stepPingPong(state.value, state.dir, 0.05, max);
      expect(Math.abs(state.value)).toBeLessThanOrEqual(max);
    }
  });

  it("sweeps the whole integer range with a unit step (background sway)", () => {
    let state = { value: 0, dir: 1 };
    const seen = new Set<number>();
    for (let i = 0; i < 20; i++) {
      state = stepPingPong(state.value, state.dir, 1, 3);
      seen.add(state.value);
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([-3, -2, -1, 0, 1, 2, 3]);
  });
});

describe("noiseAt", () => {
  it("returns only 0 or 1", () => {
    for (let i = 0; i < 100; i++) {
      expect([0, 1]).toContain(noiseAt(i, i * 2, 7));
    }
  });

  it("is deterministic for the same coordinates and seed", () => {
    expect(noiseAt(12, 34, 99)).toBe(noiseAt(12, 34, 99));
  });

  it("depends on the seed", () => {
    // Two seeds should disagree on at least some coordinates.
    let diff = 0;
    for (let x = 0; x < 200; x++) {
      if (noiseAt(x, 0, 1) !== noiseAt(x, 0, 2)) diff++;
    }
    expect(diff).toBeGreaterThan(0);
  });

  it("is roughly balanced between 0 and 1 (usable as noise)", () => {
    let ones = 0;
    const n = 4000;
    for (let x = 0; x < n; x++) ones += noiseAt(x, 0, 3);
    const ratio = ones / n;
    expect(ratio).toBeGreaterThan(0.4);
    expect(ratio).toBeLessThan(0.6);
  });
});

describe("stepBounce", () => {
  it("advances by the velocity when away from the walls", () => {
    expect(stepBounce(50, 2, 10, 100)).toEqual({ pos: 52, vel: 2 });
  });

  it("reverses when the shape reaches the right wall", () => {
    const r = stepBounce(89, 2, 10, 100);
    expect(r.vel).toBe(-2);
    expect(r.pos).toBe(89);
  });

  it("reverses when the shape reaches the left wall", () => {
    const r = stepBounce(11, -2, 10, 100);
    expect(r.vel).toBe(2);
    expect(r.pos).toBe(11);
  });
});
