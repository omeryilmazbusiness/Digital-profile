import { expect, test } from "vitest";

import { sceneKeyframes } from "./scroll-scenes";

test("a scene starting at 0 is visible on arrival and fades out after its window", () => {
  expect(sceneKeyframes({ start: 0, end: 0.2 })).toEqual({
    fadeIn: null,
    fadeOut: { at: 0.2, duration: 0.06 },
  });
});

test("a middle scene fades in before its window and out after it", () => {
  const { fadeIn, fadeOut } = sceneKeyframes({ start: 0.3, end: 0.5 });
  expect(fadeIn?.at).toBeCloseTo(0.24);
  expect(fadeIn?.duration).toBeCloseTo(0.06);
  expect(fadeOut).toEqual({ at: 0.5, duration: 0.06 });
});

test("fades shrink near the ends and vanish at them", () => {
  expect(sceneKeyframes({ start: 0.02, end: 0.97 })).toEqual({
    fadeIn: { at: 0, duration: 0.02 },
    fadeOut: { at: 0.97, duration: expect.closeTo(0.03) as number },
  });
  expect(sceneKeyframes({ start: 0.6, end: 1 }).fadeOut).toBeNull();
});

test("invalid windows are rejected", () => {
  expect(() => sceneKeyframes({ start: 0.5, end: 0.5 })).toThrow(RangeError);
  expect(() => sceneKeyframes({ start: -0.1, end: 0.5 })).toThrow(RangeError);
  expect(() => sceneKeyframes({ start: 0.5, end: 1.2 })).toThrow(RangeError);
});
