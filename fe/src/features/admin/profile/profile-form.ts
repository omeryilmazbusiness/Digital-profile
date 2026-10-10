import { type Locale, locales } from "@/i18n/locales";
import type { Schemas } from "@/lib/api/client";

type Profile = Schemas["Profile"];
type ProfileInput = Schemas["ProfileInput"];
type Media = Schemas["Media"];
export type SpokenLanguage = Schemas["SpokenLanguage"];

/** Every language the API accepts, in the order the picker lists them. */
export const SPOKEN_LANGUAGES = [
  "ar",
  "en",
  "tr",
  "id",
  "ms",
  "ur",
  "fa",
  "fr",
  "de",
  "es",
  "it",
  "nl",
  "pt",
  "ru",
  "zh",
  "ja",
  "ko",
  "hi",
  "bn",
  "ta",
  "ml",
  "th",
  "tl",
  "ha",
  "so",
  "sw",
  "am",
  "az",
  "kk",
  "uz",
  "ky",
  "tg",
  "ps",
  "sq",
  "bs",
  "ku",
  "yo",
  "wo",
] as const satisfies readonly SpokenLanguage[];

export const DEFAULT_LANGUAGES: SpokenLanguage[] = ["ar", "en", "tr"];

export interface ProfileText {
  displayName: string;
  title: string;
  tagline: string;
  bio: string;
  whatsappMessage: string;
  street: string;
  city: string;
  country: string;
}

export interface ProfileForm {
  firstName: string;
  lastName: string;
  organization: string;
  portrait?: Media;
  vcardPhoto?: Media;
  phone: string;
  whatsapp: string;
  email: string;
  languages: SpokenLanguage[];
  postalCode: string;
  mapUrl: string;
  linkedinUrl: string;
  texts: Record<Locale, ProfileText>;
}

/** The form for a saved profile, or an empty one before the first save. */
export function toForm(profile?: Profile): ProfileForm {
  const texts = {} as Record<Locale, ProfileText>;
  for (const locale of locales) {
    const t = profile?.translations[locale];
    texts[locale] = {
      displayName: t?.displayName ?? "",
      title: t?.title ?? "",
      tagline: t?.tagline ?? "",
      bio: t?.bio ?? "",
      whatsappMessage: t?.whatsappMessage ?? "",
      street: t?.address?.street ?? "",
      city: t?.address?.city ?? "",
      country: t?.address?.country ?? "",
    };
  }
  return {
    firstName: profile?.firstName ?? "",
    lastName: profile?.lastName ?? "",
    organization: profile?.organization ?? "",
    portrait: profile?.portrait,
    vcardPhoto: profile?.vcardPhoto,
    phone: profile?.phone ?? "",
    whatsapp: profile?.whatsapp ?? "",
    email: profile?.email ?? "",
    languages: profile?.languages ?? [...DEFAULT_LANGUAGES],
    postalCode: profile?.postalCode ?? "",
    mapUrl: profile?.mapUrl ?? "",
    linkedinUrl: profile?.linkedinUrl ?? "",
    texts,
  };
}

/** Whether the admin wrote anything in this language. */
export function hasText(text: ProfileText): boolean {
  return Object.values(text).some((v) => v.trim() !== "");
}

const optional = (value: string) => value.trim() || undefined;

/**
 * The PUT body. Blank optional fields are left out (the API clears them), and so are languages
 * without any text.
 */
export function toPayload(form: ProfileForm): ProfileInput {
  const translations: ProfileInput["translations"] = {};
  for (const locale of locales) {
    const t = form.texts[locale];
    if (!hasText(t)) continue;
    const address = {
      street: optional(t.street),
      city: optional(t.city),
      country: optional(t.country),
    };
    translations[locale] = {
      title: t.title,
      displayName: optional(t.displayName),
      tagline: optional(t.tagline),
      bio: optional(t.bio),
      whatsappMessage: optional(t.whatsappMessage),
      address: Object.values(address).some(Boolean) ? address : undefined,
    };
  }
  return {
    firstName: form.firstName,
    lastName: optional(form.lastName),
    organization: optional(form.organization),
    portraitMediaId: form.portrait?.id,
    vcardPhotoMediaId: form.vcardPhoto?.id,
    phone: optional(form.phone),
    whatsapp: optional(form.whatsapp),
    email: optional(form.email),
    languages: form.languages,
    postalCode: optional(form.postalCode),
    mapUrl: optional(form.mapUrl),
    linkedinUrl: optional(form.linkedinUrl),
    translations,
  };
}

/** Compares what would be sent, so whitespace-only edits don't count as changes. */
export function sameProfile(a: ProfileForm, b: ProfileForm): boolean {
  return JSON.stringify(toPayload(a)) === JSON.stringify(toPayload(b));
}

/** Fields the form requires before it asks the API, keyed like the API's field errors. */
export function missingFields(form: ProfileForm, preferred: Locale): string[] {
  const missing: string[] = [];
  if (!form.firstName.trim()) missing.push("firstName");
  if (!form.phone.trim()) missing.push("phone");
  if (!form.email.trim()) missing.push("email");
  const filled = locales.filter((l) => hasText(form.texts[l]));
  if (filled.length === 0) missing.push(`translations.${preferred}.title`);
  for (const l of filled) {
    if (!form.texts[l].title.trim()) missing.push(`translations.${l}.title`);
  }
  return missing;
}
