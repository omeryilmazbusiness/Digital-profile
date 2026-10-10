import { expect, test } from "vitest";

import { adminHref, safeNext } from "./paths";

test("builds admin addresses under the site's language", () => {
  expect(adminHref("ar", "/profile")).toBe("/sheraton/ar/admin/profile");
  expect(adminHref("en")).toBe("/sheraton/en/admin");
});

test("returns to admin pages only after sign-in", () => {
  expect(safeNext("/sheraton/id/admin/profile", "en")).toBe("/sheraton/id/admin/profile");
  expect(safeNext("/sheraton/en/admin", "en")).toBe("/sheraton/en/admin");
  for (const unsafe of [
    null,
    "",
    "https://evil.example/sheraton/en/admin",
    "//evil.example/sheraton/en/admin",
    "/\\evil.example",
    "/sheraton/en/momen",
    "/sheraton/en/administrator",
    "/sheraton/en/admin/login",
  ]) {
    expect(safeNext(unsafe, "ar")).toBe("/sheraton/ar/admin/discover");
  }
});
