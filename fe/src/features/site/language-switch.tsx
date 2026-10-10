"use client";

import { Check } from "lucide-react";
import { usePathname } from "next/navigation";

import type { Locale } from "@/i18n/locales";
import { localeOfPath, SITE_BASE } from "@/i18n/routing";
import { translatedLocales } from "@/i18n/ui";
import { languageName } from "@/lib/format";
import { cn } from "@/lib/utils";

interface LanguageLink {
  locale: Locale;
  /** The language's name in that language: "English", "العربية", "Bahasa Indonesia". */
  name: string;
  /** This page in that language. */
  href: string;
  current: boolean;
}

/** This page in every translated language. */
function useLanguageLinks(): LanguageLink[] {
  // Null outside the app router (tests, error pages).
  const pathname = usePathname() ?? "";
  const current = localeOfPath(pathname);
  const rest = current ? pathname.slice(`${SITE_BASE}/${current}`.length) : "";
  return translatedLocales.map((locale) => ({
    locale,
    name: languageName(locale),
    href: `${SITE_BASE}/${locale}${rest}`,
    current: locale === current,
  }));
}

// Plain links: every language is its own document (lang, dir), so the page reloads.

/** Links to this page in the other languages, inline (header, footer). */
export function LanguageSwitch({ label, className }: { label: string; className?: string }) {
  const others = useLanguageLinks().filter((link) => !link.current);
  if (others.length === 0) return null;
  return (
    <nav aria-label={label} className={cn("flex items-center gap-4", className)}>
      {others.map((link) => (
        <a key={link.locale} href={link.href} lang={link.locale} hrefLang={link.locale}>
          {link.name}
        </a>
      ))}
    </nav>
  );
}

/** Every language as a choice, the current one marked (the phone menu). */
export function LanguagePicker({ label, className }: { label: string; className?: string }) {
  const links = useLanguageLinks();
  return (
    <nav aria-label={label} className={className}>
      <p className="text-caption-1 font-medium tracking-[0.24em] text-label-secondary uppercase">
        {label}
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {links.map((link) => (
          <li key={link.locale}>
            <a
              href={link.href}
              lang={link.locale}
              hrefLang={link.locale}
              aria-current={link.current ? "true" : undefined}
              className={cn(
                "flex h-10 pressable items-center gap-1.5 rounded-full px-4 text-subheadline font-medium transition-colors",
                link.current
                  ? "bg-label text-bg"
                  : "text-label ring-1 ring-label/15 ring-inset hover:bg-fill-quaternary",
              )}
            >
              {link.current && <Check aria-hidden className="size-4" strokeWidth={2} />}
              {link.name}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
