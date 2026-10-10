"use client";

import { usePathname } from "next/navigation";

import type { Locale } from "@/i18n/locales";
import { localeOfPath, SITE_BASE } from "@/i18n/routing";
import { translatedLocales } from "@/i18n/ui";
import { languageName } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Links to this page in the site's other translated languages, each named in its own language.
 * Plain links: every language is its own document (lang, dir), so the page reloads.
 */
export function LanguageSwitch({ label, className }: { label: string; className?: string }) {
  // Null outside the app router (tests, error pages).
  const pathname = usePathname() ?? "";
  const current = localeOfPath(pathname);
  const others = translatedLocales.filter((locale) => locale !== current);
  if (others.length === 0) return null;

  const pathIn = (locale: Locale) => {
    const rest = current ? pathname.slice(`${SITE_BASE}/${current}`.length) : "";
    return `${SITE_BASE}/${locale}${rest}`;
  };

  return (
    <nav aria-label={label} className={cn("flex items-center gap-4", className)}>
      {others.map((locale) => (
        <a key={locale} href={pathIn(locale)} lang={locale} hrefLang={locale}>
          {languageName(locale)}
        </a>
      ))}
    </nav>
  );
}
