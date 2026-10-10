import { expect, test } from "vitest";

import { locales } from "@/i18n/locales";

import { adminStrings, fieldMessage } from "./strings";

test("every language has every word, with the same placeholders", () => {
  const en = adminStrings("en");
  for (const locale of locales) {
    const t = adminStrings(locale);
    expect(Object.keys(t).sort()).toEqual(Object.keys(en).sort());
    for (const [key, value] of Object.entries(t)) {
      expect(value, `${locale}.${key}`).not.toBe("");
      const holes = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
      expect(holes(value), `${locale}.${key}`).toEqual(holes(en[key as keyof typeof en]));
    }
  }
});

test("puts the API's field messages in the admin's words", () => {
  const t = adminStrings("id");
  expect(fieldMessage(t, "must not be blank")).toBe(t.errRequired);
  expect(fieldMessage(t, "must be a full https:// address")).toBe(t.errUrl);
  expect(fieldMessage(t, "must be at most 120 characters")).toBe(
    t.errTooLong.replace("{max}", "120"),
  );
  expect(fieldMessage(t, "something new")).toBe("something new");
});
