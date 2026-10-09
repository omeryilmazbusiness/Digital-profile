import { expect, test } from "vitest";

import { backingSize, coverRect } from "./canvas-cover";

test("a wide screen crops the top and bottom of a 4:3 frame", () => {
  // 1600×1200 into 1920×1080: scale 1.2, visible source 1600×900, centered.
  expect(coverRect(1600, 1200, 1920, 1080)).toEqual({ sx: 0, sy: 150, sWidth: 1600, sHeight: 900 });
});

test("a tall screen crops the sides", () => {
  // 1600×1200 into 390×844: scale 0.703…, visible source ≈554×1200, centered.
  const r = coverRect(1600, 1200, 390, 844);
  expect(r.sHeight).toBe(1200);
  expect(r.sWidth).toBeCloseTo((390 * 1200) / 844, 6);
  expect(r.sx).toBeCloseTo((1600 - r.sWidth) / 2, 6);
  expect(r.sy).toBe(0);
});

test("focus moves the crop", () => {
  expect(coverRect(1600, 1200, 1920, 1080, 0.5, 0).sy).toBe(0);
  expect(coverRect(1600, 1200, 1920, 1080, 0.5, 1).sy).toBe(300);
  expect(coverRect(1600, 1200, 1920, 1080, 0.5, 7).sy).toBe(300);
});

test("same aspect ratio uses the whole source", () => {
  expect(coverRect(800, 600, 400, 300)).toEqual({ sx: 0, sy: 0, sWidth: 800, sHeight: 600 });
});

test("degenerate sizes do not produce NaN", () => {
  expect(coverRect(800, 600, 0, 0)).toEqual({ sx: 0, sy: 0, sWidth: 800, sHeight: 600 });
  expect(coverRect(0, 0, 100, 100)).toEqual({ sx: 0, sy: 0, sWidth: 0, sHeight: 0 });
});

test("backing size follows the pixel ratio, capped at 2", () => {
  expect(backingSize(390, 844, 3)).toEqual({ width: 780, height: 1688 });
  expect(backingSize(1440, 900, 1)).toEqual({ width: 1440, height: 900 });
  expect(backingSize(100.4, 50.6, 1.5)).toEqual({ width: 151, height: 76 });
  expect(backingSize(100, 100, 0)).toEqual({ width: 100, height: 100 });
});
