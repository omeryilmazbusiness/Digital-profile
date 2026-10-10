/** Languages the public site is published in; the first is the default. */
export const locales = ["en", "ar", "id"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

/** Each language's name in that language, as speakers write it. */
export const nativeNames: Record<Locale, string> = {
  en: "English",
  ar: "العربية",
  id: "Bahasa Indonesia",
};

export function isLocale(value: string | undefined): value is Locale {
  return (locales as readonly string[]).includes(value ?? "");
}

export function directionOf(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

/** Cookie that remembers the language a visitor last read the site in. */
export const LOCALE_COOKIE = "locale";
