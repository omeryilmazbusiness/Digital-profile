import { describe, expect, test } from "vitest";

import { pingPongFrame } from "./frame-playback";

describe("pingPongFrame", () => {
  test("walks forward, then back, then repeats", () => {
    const count = 5;
    const duration = 1_000;
    expect(pingPongFrame(0, count, duration)).toBe(0);
    expect(pingPongFrame(500, count, duration)).toBe(2);
    expect(pingPongFrame(1_000, count, duration)).toBe(4);
    expect(pingPongFrame(1_500, count, duration)).toBe(2);
    expect(pingPongFrame(2_000, count, duration)).toBe(0);
    expect(pingPongFrame(2_500, count, duration)).toBe(2);
  });

  test("clamps empty sequences and non-positive durations", () => {
    expect(pingPongFrame(500, 0, 1_000)).toBe(0);
    expect(pingPongFrame(500, 1, 1_000)).toBe(0);
    expect(pingPongFrame(500, 5, 0)).toBe(0);
    expect(pingPongFrame(-100, 5, 1_000)).toBe(0);
  });
});
