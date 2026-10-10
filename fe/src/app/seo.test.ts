import { afterEach, expect, test, vi } from "vitest";

import robots from "./robots";
import sitemap from "./sitemap";

afterEach(() => vi.unstubAllEnvs());

test("lists every page in every language, with its translations", () => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.com");
  const entries = sitemap();
  expect(entries.map((entry) => entry.url)).toEqual([
    "https://example.com/sheraton/en",
    "https://example.com/sheraton/ar",
    "https://example.com/sheraton/id",
    "https://example.com/sheraton/en/momen",
    "https://example.com/sheraton/ar/momen",
    "https://example.com/sheraton/id/momen",
  ]);
  expect(entries[3]!.alternates?.languages).toMatchObject({
    ar: "https://example.com/sheraton/ar/momen",
    "x-default": "https://example.com/sheraton/en/momen",
  });
  expect(robots()).toMatchObject({
    rules: { disallow: ["/design", "/sheraton/*/admin"] },
    sitemap: "https://example.com/sitemap.xml",
  });
});

test("publishes no sitemap without a public origin", () => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
  expect(sitemap()).toEqual([]);
  expect(robots().sitemap).toBeUndefined();
});
