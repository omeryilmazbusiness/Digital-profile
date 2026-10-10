import type { Locale } from "@/i18n/locales";
import { SITE_BASE } from "@/i18n/routing";

/** Where an admin page lives: /sheraton/<locale>/admin/<path>. */
export function adminHref(locale: Locale, path = ""): string {
  return `${SITE_BASE}/${locale}/admin${path}`;
}

/** Only pages of the admin panel may follow sign-in, never another site. */
export function safeNext(next: string | null, locale: Locale): string {
  const home = adminHref(locale, "/discover");
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return home;
  const admin = /^\/sheraton\/[a-z]{2}\/admin(\/|$)/;
  if (!admin.test(next) || next.includes("/admin/login")) return home;
  return next;
}
