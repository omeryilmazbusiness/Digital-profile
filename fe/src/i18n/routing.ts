import { defaultLocale, isLocale, type Locale, locales } from "./locales";

/** Every public page lives under /sheraton/<locale>. */
export const SITE_BASE = "/sheraton";

/**
 * A link written without a language — "/" (the landing page), "/#tour" (one of its sections)
 * or "/momen" (a page) — as the URL of that page in `locale`.
 */
export function localizeHref(locale: Locale, href: `/${string}`): `/${string}` {
  const home = `${SITE_BASE}/${locale}` as const;
  if (href === "/") return home;
  if (href.startsWith("/#")) return `${home}${href.slice(1)}`;
  return `${home}${href}`;
}

/** Every language's address for a page (hreflang), plus the default for anyone else. */
export function languageAlternates(href: `/${string}`): Record<string, string> {
  return Object.fromEntries([
    ...locales.map((locale) => [locale, localizeHref(locale, href)]),
    ["x-default", localizeHref(defaultLocale, href)],
  ]);
}

/** The language a site path is in, if it is one: /sheraton/ar/momen → "ar". */
export function localeOfPath(pathname: string): Locale | undefined {
  const [, base, locale] = pathname.split("/");
  return `/${base}` === SITE_BASE && isLocale(locale) ? locale : undefined;
}
