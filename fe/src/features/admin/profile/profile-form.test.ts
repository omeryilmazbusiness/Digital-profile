import { expect, test } from "vitest";

import type { Schemas } from "@/lib/api/client";

import { DEFAULT_LANGUAGES, missingFields, sameProfile, toForm, toPayload } from "./profile-form";

const profile: Schemas["Profile"] = {
  firstName: "Momen",
  lastName: "Tawfiq",
  fullName: "Momen Tawfiq",
  organization: "Sheraton",
  phone: "+966125456789",
  email: "momen@example.com",
  languages: ["ar", "en"],
  mapUrl: "https://maps.example/x",
  translations: {
    en: {
      title: "Director of Sales",
      bio: "Hello",
      address: { street: "Ibrahim Al Khalil Street", city: "Makkah" },
    },
    ar: { title: "مدير المبيعات", displayName: "مؤمن توفيق" },
  },
  complete: true,
  missing: [],
  updatedAt: "2026-01-01T00:00:00Z",
};

test("a saved profile survives the round trip through the form", () => {
  const payload = toPayload(toForm(profile));
  expect(payload).toEqual({
    firstName: "Momen",
    lastName: "Tawfiq",
    organization: "Sheraton",
    phone: "+966125456789",
    email: "momen@example.com",
    languages: ["ar", "en"],
    mapUrl: "https://maps.example/x",
    translations: {
      en: {
        title: "Director of Sales",
        bio: "Hello",
        address: { street: "Ibrahim Al Khalil Street", city: "Makkah" },
      },
      ar: { title: "مدير المبيعات", displayName: "مؤمن توفيق" },
    },
  });
  expect(JSON.parse(JSON.stringify(payload))).toEqual(payload);
});

test("leaves out blank fields and languages without text", () => {
  const form = toForm();
  expect(form.languages).toEqual(DEFAULT_LANGUAGES);
  form.firstName = "Momen";
  form.organization = "   ";
  form.texts.id.title = "Direktur";
  const payload = JSON.parse(JSON.stringify(toPayload(form)));
  expect(payload).toEqual({
    firstName: "Momen",
    languages: DEFAULT_LANGUAGES,
    translations: { id: { title: "Direktur" } },
  });
});

test("ignores whitespace when telling whether anything changed", () => {
  const form = toForm(profile);
  expect(sameProfile(form, { ...form, organization: "Sheraton  " })).toBe(true);
  expect(sameProfile(form, { ...form, organization: "Marriott" })).toBe(false);
});

test("asks for name, phone, e-mail and a title in every written language", () => {
  expect(missingFields(toForm(profile), "en")).toEqual([]);
  expect(missingFields(toForm(), "ar")).toEqual([
    "firstName",
    "phone",
    "email",
    "translations.ar.title",
  ]);
  const form = toForm(profile);
  form.texts.id.city = "Makkah";
  expect(missingFields(form, "en")).toEqual(["translations.id.title"]);
});

test("sends the chosen images by id, and clears one that was removed", () => {
  const image = (id: string): Schemas["Media"] => ({
    id,
    width: 1600,
    height: 1000,
    sourceType: "image/png",
    sourceBytes: 1,
    originalFilename: `${id}.png`,
    placeholder: "",
    altText: {},
    variants: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  });
  const form = toForm({ ...profile, portrait: image("p"), businessCard: image("card") });
  expect(toPayload(form)).toMatchObject({ portraitMediaId: "p", businessCardMediaId: "card" });
  expect(toPayload({ ...form, businessCard: undefined }).businessCardMediaId).toBeUndefined();
  expect(sameProfile(form, { ...form, businessCard: undefined })).toBe(false);
});
