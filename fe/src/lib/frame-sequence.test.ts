import { describe, expect, test } from "vitest";

import {
  frameAt,
  frameUrl,
  frameUrls,
  loadOrder,
  nearestLoaded,
  pickFrameSet,
  type FrameSequence,
} from "./frame-sequence";

const sequence: FrameSequence = {
  basePath: "/frames/hero-abcd1234",
  count: 3,
  sets: { landscape: { width: 1600, height: 1200 }, portrait: { width: 810, height: 1080 } },
};

test("frame URLs are 1-based and zero-padded", () => {
  expect(frameUrl(sequence, "portrait", 0)).toBe("/frames/hero-abcd1234/portrait/frame_0001.webp");
  expect(frameUrls(sequence, "landscape")).toEqual([
    "/frames/hero-abcd1234/landscape/frame_0001.webp",
    "/frames/hero-abcd1234/landscape/frame_0002.webp",
    "/frames/hero-abcd1234/landscape/frame_0003.webp",
  ]);
});

test("portrait screens get the portrait set", () => {
  expect(pickFrameSet(390, 844)).toBe("portrait");
  expect(pickFrameSet(1440, 900)).toBe("landscape");
  expect(pickFrameSet(800, 800)).toBe("landscape");
});

test("frameAt maps progress onto frames and clamps", () => {
  expect(frameAt(0, 121)).toBe(0);
  expect(frameAt(0.5, 121)).toBe(60);
  expect(frameAt(1, 121)).toBe(120);
  expect(frameAt(-0.2, 121)).toBe(0);
  expect(frameAt(1.3, 121)).toBe(120);
  expect(frameAt(0.5, 0)).toBe(0);
});

describe("loadOrder", () => {
  test("visits every frame exactly once, ends first", () => {
    for (const n of [1, 2, 3, 10, 121]) {
      const order = loadOrder(n);
      expect(order).toHaveLength(n);
      expect(new Set(order).size).toBe(n);
      expect(order.slice(0, Math.min(n, 2))).toEqual(n === 1 ? [0] : [0, n - 1]);
    }
    expect(loadOrder(0)).toEqual([]);
  });

  test("an early prefix already spans the sequence", () => {
    const first = loadOrder(121).slice(0, 9);
    expect(first).toEqual([0, 120, 60, 30, 90, 15, 45, 75, 105]);
  });
});

test("nearestLoaded falls back to the closest loaded frame, earlier first", () => {
  const frames = [null, "b", null, null, "e", null];
  expect(nearestLoaded(frames, 1)).toBe("b");
  expect(nearestLoaded(frames, 0)).toBe("b");
  expect(nearestLoaded(frames, 3)).toBe("e");
  expect(nearestLoaded(frames, 2)).toBe("b");
  expect(nearestLoaded(frames, 5)).toBe("e");
  expect(nearestLoaded([null, null], 1)).toBeNull();
});
