import { NextRequest } from "next/server";
import { expect, test } from "vitest";

import { proxy } from "./proxy";

const request = (path: string, headers: Record<string, string> = {}) =>
  new NextRequest(new URL(path, "https://example.com"), { headers });

test("opens the site in the visitor's language", () => {
  const response = proxy(request("/", { "accept-language": "ar-SA,ar;q=0.9" }));
  expect(response.status).toBe(307);
  expect(response.headers.get("location")).toBe("https://example.com/sheraton/ar");
  expect(proxy(request("/sheraton")).headers.get("location")).toBe(
    "https://example.com/sheraton/en",
  );
});

test("keeps the card's short link working, query included", () => {
  const response = proxy(request("/momen?src=qr", { cookie: "locale=id" }));
  expect(response.headers.get("location")).toBe("https://example.com/sheraton/id/momen?src=qr");
  expect(proxy(request("/momen/vcard")).headers.get("location")).toBe(
    "https://example.com/sheraton/en/momen/vcard",
  );
});

test("remembers the language of a page, and leaves unknown ones to the 404", () => {
  const page = proxy(request("/sheraton/ar/momen"));
  expect(page.headers.get("location")).toBeNull();
  expect(page.cookies.get("locale")?.value).toBe("ar");
  expect(proxy(request("/sheraton/ar", { cookie: "locale=ar" })).cookies.get("locale")).toBe(
    undefined,
  );

  const unknown = proxy(request("/sheraton/fr"));
  expect(unknown.headers.get("location")).toBeNull();
  expect(unknown.cookies.get("locale")).toBeUndefined();
});
