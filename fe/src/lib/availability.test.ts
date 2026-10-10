import { expect, test } from "vitest";

import { isOpen, zonedClock } from "./availability";

const hours = { timeZone: "Asia/Riyadh", days: [0, 1, 2, 3, 4], opens: "09:00", closes: "18:00" };

test("reads the clock in the office's time zone", () => {
  // 06:30 UTC on Sunday 11 October 2026 is 09:30 in Makkah (UTC+3).
  expect(zonedClock(new Date("2026-10-11T06:30:00Z"), "Asia/Riyadh")).toEqual({
    weekday: 0,
    minutes: 9 * 60 + 30,
    time: "09:30",
  });
});

test("is open on working days within hours, whatever the visitor's zone", () => {
  expect(isOpen(new Date("2026-10-11T06:30:00Z"), hours)).toBe(true);
  // 05:59 UTC = 08:59 Makkah: not yet.
  expect(isOpen(new Date("2026-10-11T05:59:00Z"), hours)).toBe(false);
  // 15:00 UTC = 18:00 Makkah: closed at closing time.
  expect(isOpen(new Date("2026-10-11T15:00:00Z"), hours)).toBe(false);
  // Friday.
  expect(isOpen(new Date("2026-10-16T08:00:00Z"), hours)).toBe(false);
});

test("handles midnight in the zone", () => {
  // 21:00 UTC Saturday = 00:00 Sunday in Makkah.
  expect(zonedClock(new Date("2026-10-10T21:00:00Z"), "Asia/Riyadh")).toMatchObject({
    weekday: 0,
    time: "00:00",
  });
});
