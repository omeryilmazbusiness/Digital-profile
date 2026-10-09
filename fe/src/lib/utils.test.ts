import { expect, test } from "vitest";

import { cn } from "./utils";

test("type scale sizes and text colors do not cancel each other", () => {
  expect(cn("text-body text-tint")).toBe("text-body text-tint");
  expect(cn("text-tint", "text-subheadline")).toBe("text-tint text-subheadline");
  expect(cn("text-large-title text-label", "text-caption-2")).toBe("text-label text-caption-2");
});

test("later sizes and colors still win within their group", () => {
  expect(cn("text-body", "text-headline")).toBe("text-headline");
  expect(cn("text-tint", "text-system-red")).toBe("text-system-red");
  expect(cn("shadow-card", "shadow-float")).toBe("shadow-float");
});
