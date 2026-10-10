import { notFound } from "next/navigation";

import { isLocale, type Locale, locales } from "@/i18n/locales";

/** One prerendered copy of the site per language. */
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

/** The language a URL asks for; any other segment is a 404. */
export async function localeOf(params: Promise<{ locale: string }>): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return locale;
}
