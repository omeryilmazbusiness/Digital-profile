"use client";

import { Check, Globe } from "lucide-react";
import { usePathname } from "next/navigation";
import { DropdownMenu } from "radix-ui";

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

/**
 * A globe button that opens the list of languages, the current one ticked. `showCurrent` names
 * the current language beside the icon.
 */
export function LanguageMenu({
  label,
  showCurrent = false,
  className,
}: {
  label: string;
  showCurrent?: boolean;
  className?: string;
}) {
  const links = useLanguageLinks();
  const current = links.find((link) => link.current);
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        aria-label={current ? `${label}: ${current.name}` : label}
        className={cn(
          "flex pressable items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-current",
          showCurrent ? "h-11 ps-1 pe-4" : "size-11 justify-center",
          className,
        )}
      >
        <span
          className={cn(
            "grid shrink-0 place-items-center rounded-full",
            showCurrent && "size-9 bg-fill-tertiary",
          )}
        >
          <Globe aria-hidden className="size-5" strokeWidth={1.6} />
        </span>
        {showCurrent && current && (
          <span lang={current.locale} className="text-subheadline font-medium">
            {current.name}
          </span>
        )}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={8}
          collisionPadding={16}
          className={cn(
            "z-[60] min-w-52 rounded-[1.25rem] material-thick p-1.5 text-label shadow-float ring-1 ring-label/[0.06]",
            "origin-(--radix-dropdown-menu-content-transform-origin) data-[state=closed]:animate-fade-out data-[state=open]:animate-pop-in",
          )}
        >
          <DropdownMenu.Label className="px-3 pt-2 pb-1.5 text-caption-2 font-semibold tracking-[0.22em] text-label-secondary uppercase">
            {label}
          </DropdownMenu.Label>
          {links.map((link) => (
            <DropdownMenu.Item key={link.locale} asChild>
              <a
                href={link.href}
                lang={link.locale}
                hrefLang={link.locale}
                aria-current={link.current ? "true" : undefined}
                className={cn(
                  "flex h-11 items-center justify-between gap-6 rounded-xl px-3 text-body outline-none select-none",
                  "data-highlighted:bg-fill-quaternary",
                  link.current && "font-semibold",
                )}
              >
                {link.name}
                {link.current && <Check aria-hidden className="size-4" strokeWidth={2.2} />}
              </a>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
