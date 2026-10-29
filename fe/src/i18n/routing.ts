import { defaultLocale, isLocale, type Locale, locales } from "./locales";

/** The hotel site lives under /sheraton/<locale>. The social hub is /<locale>/social-media. */
export const SITE_BASE = "/sheraton";

/** Public address of the social hub, without a language. */
export const HUB_PATH = "/social-media" as const;

/** Language the hub opens in when the visitor didn't name one. */
export const HUB_LANDING_LOCALE: Locale = "ar";

/** /ar/social-media — the hub in `locale`. */
export function hubHref(locale: Locale): `/${string}` {
  return `/${locale}${HUB_PATH}`;
}

/** The language a hub path is in, if it is one: /ar/social-media → "ar". */
export function localeOfHubPath(pathname: string): Locale | undefined {
  const match = /^\/([^/]+)\/social-media\/?$/.exec(pathname);
  const locale = match?.[1];
  return isLocale(locale) ? locale : undefined;
}

/** Every language's address for the hub (hreflang), plus the default for anyone else. */
export function hubLanguageAlternates(): Record<string, string> {
  return Object.fromEntries([
    ...locales.map((locale) => [locale, hubHref(locale)]),
    ["x-default", hubHref(HUB_LANDING_LOCALE)],
  ]);
}

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
