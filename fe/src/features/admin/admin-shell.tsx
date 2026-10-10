"use client";

import { Compass, ExternalLink, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import type * as React from "react";

import { LanguageMenu } from "@/features/site/language-switch";
import { SITE_BASE } from "@/i18n/routing";
import { cn } from "@/lib/utils";

import { adminHref } from "./paths";
import { useSession } from "./session";

/**
 * The panel's frame. On phones: a translucent top bar and a tab bar within thumb reach; from
 * tablets up: a sidebar. Pages render their own title and content.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const { locale, t } = useSession();
  const pathname = usePathname() ?? "";
  const tabs = [
    { href: adminHref(locale, "/discover"), label: t.discover, icon: Compass },
    { href: adminHref(locale, "/profile"), label: t.profile, icon: UserRound },
  ];
  const isCurrent = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="min-h-dvh bg-bg-grouped md:grid md:grid-cols-[16.5rem_1fr]">
      {/* Sidebar (tablet and up) */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-8 border-e border-separator bg-bg-grouped-secondary px-4 py-6 md:flex">
        <Brand />
        <nav aria-label={t.sections} className="grid gap-1">
          {tabs.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isCurrent(href) ? "page" : undefined}
              className={cn(
                "flex h-11 items-center gap-3 rounded-md px-3 text-body font-medium text-label transition-colors",
                "hover:bg-fill-quaternary aria-[current=page]:bg-tint/12 aria-[current=page]:text-tint",
              )}
            >
              <Icon aria-hidden className="size-5" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto grid gap-2">
          <LanguageMenu label={t.language} showCurrent className="w-full justify-start" />
          <AccountMenu />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Top bar (phones) */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-separator/60 material-chrome px-safe-4 pt-safe md:hidden">
          <div className="flex h-14 items-center">
            <Brand compact />
          </div>
          <div className="flex items-center gap-1">
            <LanguageMenu label={t.language} />
            <AccountMenu compact />
          </div>
        </header>

        <main className="mx-auto w-full max-w-3xl flex-1 px-safe-4 pt-6 pb-[calc(env(safe-area-inset-bottom,0px)+6.5rem)] md:px-10 md:pt-12 md:pb-16">
          {children}
        </main>

        {/* Tab bar (phones) */}
        <nav
          aria-label={t.sections}
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 border-t border-separator/60 material-chrome pb-safe md:hidden"
        >
          {tabs.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isCurrent(href) ? "page" : undefined}
              className="flex h-14 pressable flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium text-label-secondary aria-[current=page]:text-tint"
            >
              <Icon aria-hidden className="size-6" />
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  const { t } = useSession();
  return (
    <div className="flex items-center gap-3 px-1">
      <span
        aria-hidden
        className="grid size-9 place-items-center rounded-[0.6rem] bg-label font-display text-[1.05rem] font-semibold text-bg"
      >
        S
      </span>
      <span className="grid leading-tight">
        <span className="text-[0.625rem] font-semibold tracking-[0.24em] text-gold uppercase">
          {t.brand}
        </span>
        <span className={cn("font-semibold", compact ? "text-headline" : "text-title-3")}>
          {t.admin}
        </span>
      </span>
    </div>
  );
}

function AccountMenu({ compact = false }: { compact?: boolean }) {
  const { admin, locale, t, signOut } = useSession();
  const initial = admin.email.charAt(0).toUpperCase();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={`${t.account}: ${admin.email}`}
        className={cn(
          "flex pressable items-center gap-3 rounded-md text-start outline-none focus-visible:ring-2 focus-visible:ring-tint",
          compact ? "size-11 justify-center" : "h-12 w-full px-2 hover:bg-fill-quaternary",
        )}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gold/15 text-subheadline font-semibold text-gold">
          {initial}
        </span>
        {!compact && (
          <span className="min-w-0 truncate text-subheadline text-label-secondary" dir="ltr">
            {admin.email}
          </span>
        )}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-[60] min-w-56 rounded-lg bg-bg-elevated p-1.5 shadow-float ring-1 ring-label/[0.06] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <DropdownMenu.Label
            className="truncate px-3 py-2 text-footnote text-label-secondary"
            dir="ltr"
          >
            {admin.email}
          </DropdownMenu.Label>
          <DropdownMenu.Item asChild className={menuItem}>
            <a href={`${SITE_BASE}/${locale}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden className="size-4" />
              {t.viewSite}
            </a>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-separator" />
          <DropdownMenu.Item
            className={cn(menuItem, "text-system-red")}
            onSelect={() => void signOut()}
          >
            <LogOut aria-hidden className="size-4 rtl:-scale-x-100" />
            {t.signOut}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

const menuItem =
  "flex h-11 cursor-pointer items-center gap-3 rounded-md px-3 text-body outline-none select-none data-[highlighted]:bg-fill-quaternary";

/** A page's title and lead, the same on every screen size. */
export function PageHeader({
  title,
  lead,
  trailing,
}: {
  title: string;
  lead?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex items-start justify-between gap-4">
      <div className="grid gap-2">
        <h1 className="font-display text-[2rem] leading-tight font-semibold tracking-tight md:text-[2.5rem]">
          {title}
        </h1>
        {lead && <p className="max-w-prose text-body text-label-secondary">{lead}</p>}
      </div>
      {trailing}
    </div>
  );
}
