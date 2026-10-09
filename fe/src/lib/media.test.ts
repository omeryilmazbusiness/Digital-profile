import { describe, expect, test } from "vitest";

import { fallbackSrc, mediaUrl, srcSet } from "./media";

describe("mediaUrl", () => {
  test.each([
    ["/api/v1/public/media/a.webp", "", "/api/v1/public/media/a.webp"],
    [
      "/api/v1/public/media/a.webp",
      "http://localhost:8080/",
      "http://localhost:8080/api/v1/public/media/a.webp",
    ],
    ["https://cdn.example.com/a.webp", "http://localhost:8080", "https://cdn.example.com/a.webp"],
    ["//cdn.example.com/a.webp", "http://localhost:8080", "//cdn.example.com/a.webp"],
  ])("mediaUrl(%j, %j)", (url, origin, want) => {
    expect(mediaUrl(url, origin)).toBe(want);
  });
});

describe("variant selection", () => {
  const source = {
    width: 800,
    height: 600,
    variants: [
      { url: "/m/800.webp", width: 800 },
      { url: "/m/480.webp", width: 480 },
    ],
  };

  test("srcSet lists variants by ascending width", () => {
    expect(srcSet(source, "")).toBe("/m/480.webp 480w, /m/800.webp 800w");
  });

  test("fallbackSrc picks the smallest wide-enough variant, else the largest", () => {
    expect(fallbackSrc(source, 400, "")).toBe("/m/480.webp");
    expect(fallbackSrc(source, 960, "")).toBe("/m/800.webp");
    expect(fallbackSrc({ ...source, variants: [] }, 960, "")).toBe("");
  });
});
