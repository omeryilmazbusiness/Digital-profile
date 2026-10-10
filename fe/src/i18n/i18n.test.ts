import { expect, test } from "vitest";

import { directionOf } from "./locales";
import { negotiateLocale } from "./negotiate";
import { localeOfPath, localizeHref } from "./routing";

test("puts site links under /sheraton/<locale>", () => {
  expect(localizeHref("en", "/")).toBe("/sheraton/en");
  expect(localizeHref("ar", "/#tour")).toBe("/sheraton/ar#tour");
  expect(localizeHref("id", "/momen")).toBe("/sheraton/id/momen");
  expect(localizeHref("en", "/momen/vcard")).toBe("/sheraton/en/momen/vcard");
});

test("reads the language back from a path", () => {
  expect(localeOfPath("/sheraton/ar")).toBe("ar");
  expect(localeOfPath("/sheraton/id/momen")).toBe("id");
  expect(localeOfPath("/sheraton/fr/momen")).toBeUndefined();
  expect(localeOfPath("/momen")).toBeUndefined();
});

test("opens in the remembered language, else the browser's best match, else English", () => {
  expect(negotiateLocale({ cookie: "id", acceptLanguage: "ar" })).toBe("id");
  expect(negotiateLocale({ cookie: "fr", acceptLanguage: "ar-SA,ar;q=0.9,en;q=0.5" })).toBe("ar");
  expect(negotiateLocale({ acceptLanguage: "tr-TR,tr;q=0.9,id;q=0.8,en;q=0.7" })).toBe("id");
  expect(negotiateLocale({ acceptLanguage: "en;q=0.2,ar;q=0.8" })).toBe("ar");
  expect(negotiateLocale({ acceptLanguage: "ar;q=0,fr" })).toBe("en");
  expect(negotiateLocale({ acceptLanguage: null })).toBe("en");
});

test("writes Arabic right to left", () => {
  expect(directionOf("ar")).toBe("rtl");
  expect(directionOf("id")).toBe("ltr");
});
