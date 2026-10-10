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

test("sends visitors without a session from the admin panel to sign-in, and back after", () => {
  const response = proxy(request("/sheraton/ar/admin/profile"));
  expect(response.status).toBe(307);
  expect(response.headers.get("location")).toBe(
    "https://example.com/sheraton/ar/admin/login?next=%2Fsheraton%2Far%2Fadmin%2Fprofile",
  );
  expect(proxy(request("/sheraton/en/admin")).headers.get("location")).toBe(
    "https://example.com/sheraton/en/admin/login?next=%2Fsheraton%2Fen%2Fadmin",
  );
});

test("lets the sign-in page and signed-in admins through", () => {
  expect(proxy(request("/sheraton/en/admin/login")).headers.get("location")).toBeNull();
  for (const cookie of ["dp_access=x", "__Host-dp_access=x"]) {
    expect(
      proxy(request("/sheraton/id/admin/discover", { cookie })).headers.get("location"),
    ).toBeNull();
  }
});
