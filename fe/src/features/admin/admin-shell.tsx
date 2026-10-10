"use client";

import { Compass, ExternalLink, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import { useEffect, useRef, useState } from "react";
import type * as React from "react";

import { LanguageMenu } from "@/features/site/language-switch";
import { SITE_BASE } from "@/i18n/routing";
import { cn } from "@/lib/utils";

import { adminHref } from "./paths";
import { useSession } from "./session";

/**
 * The panel's frame, built like an iPhone app: each page opens with a large title that folds
 * into a translucent bar as it scrolls, and a floating tab bar sits within thumb reach. From
 * tablets up a sidebar takes the tab bar's place.
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
    <div className="min-h-dvh bg-bg-grouped md:grid md:grid-cols-[17rem_1fr]">
      {/* Sidebar (tablet and up) */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-8 border-e-[0.5px] border-separator bg-bg-grouped px-4 py-6 md:flex">
        <Brand />
        <nav aria-label={t.sections} className="grid gap-1">
          {tabs.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isCurrent(href) ? "page" : undefined}
              className={cn(
                "group flex h-11 items-center gap-3 rounded-xl px-2.5 text-body font-medium text-label transition-colors",
                "hover:bg-fill-quaternary aria-[current=page]:bg-bg-grouped-secondary aria-[current=page]:shadow-card",
              )}
            >
              <span className="grid size-7 place-items-center rounded-[0.5rem] bg-fill-tertiary text-label-secondary transition-colors group-aria-[current=page]:bg-tint group-aria-[current=page]:text-white">
                <Icon aria-hidden className="size-4" strokeWidth={2.2} />
              </span>
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
        <main
          className={cn(
            "mx-auto w-full max-w-3xl flex-1 px-(--gutter) pb-[calc(env(safe-area-inset-bottom,0px)+7rem)] md:pb-16",
            "[--gutter:calc(max(env(safe-area-inset-left,0px),env(safe-area-inset-right,0px))+1rem)] md:[--gutter:2.5rem]",
          )}
        >
          {children}
        </main>

        {/* Tab bar (phones): a floating glass capsule. */}
        <nav
          aria-label={t.sections}
          className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-6 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] md:hidden"
        >
          <div className="pointer-events-auto grid w-full max-w-[19rem] grid-cols-2 gap-1 rounded-full material-chrome p-1.5 shadow-[0_10px_40px_-12px_rgb(0_0_0/0.35),0_0_0_0.5px_rgb(0_0_0/0.06)]">
            {tabs.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={isCurrent(href) ? "page" : undefined}
                className={cn(
                  "flex h-13 pressable flex-col items-center justify-center gap-0.5 rounded-full text-[0.6875rem] font-semibold text-label-secondary",
                  "aria-[current=page]:bg-fill-tertiary aria-[current=page]:text-tint",
                )}
              >
                <Icon aria-hidden className="size-[1.375rem]" strokeWidth={2} />
                {label}
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}

function Brand() {
  const { t } = useSession();
  return (
    <div className="flex items-center gap-3 px-1">
      <span
        aria-hidden
        className="grid size-10 place-items-center rounded-[0.7rem] bg-linear-to-b from-neutral-800 to-black font-display text-[1.15rem] font-semibold text-white shadow-card"
      >
        S
      </span>
      <span className="grid leading-tight">
        <span className="text-[0.625rem] font-semibold tracking-[0.24em] text-gold uppercase">
          {t.brand}
        </span>
        <span className="text-title-3 font-semibold">{t.admin}</span>
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
          "flex pressable items-center gap-3 rounded-full text-start outline-none focus-visible:ring-2 focus-visible:ring-tint",
          compact
            ? "size-11 justify-center"
            : "h-12 w-full rounded-xl px-2 hover:bg-fill-quaternary",
        )}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-linear-to-b from-[#c9a46a] to-[#8a6526] text-subheadline font-semibold text-white shadow-card">
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
          collisionPadding={12}
          className="z-[60] min-w-60 rounded-2xl material-chrome p-1.5 shadow-float ring-[0.5px] ring-label/10 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
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
          <DropdownMenu.Separator className="mx-3 my-1 h-px scale-y-50 bg-separator" />
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
  "flex h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-body outline-none select-none data-[highlighted]:bg-fill-tertiary";

/**
 * A page's iOS navigation: the large title (with its lead) under a bar that turns translucent
 * and shows the title small once the large one scrolls away. The bar carries the language and
 * account buttons on phones, plus `actions` (e.g. Save) on every screen size.
 */
export function PageHeader({
  title,
  lead,
  trailing,
  actions,
}: {
  title: string;
  lead?: string;
  /** Beside the large title, e.g. a status badge. */
  trailing?: React.ReactNode;
  /** In the bar, before the account button. */
  actions?: React.ReactNode;
}) {
  const { t } = useSession();
  const heading = useRef<HTMLHeadingElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const el = heading.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setCollapsed(!entry!.isIntersecting), {
      rootMargin: `-${bar.current?.offsetHeight ?? 0}px 0px 0px 0px`,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <div
        ref={bar}
        data-collapsed={collapsed}
        className={cn(
          "sticky top-0 z-30 -mx-(--gutter) px-(--gutter) pt-safe transition-[background-color,box-shadow] duration-(--duration-base)",
          "data-[collapsed=true]:material-chrome data-[collapsed=true]:shadow-[0_0.5px_0_var(--separator)]",
        )}
      >
        <div className="grid h-13 grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="-ms-2.5 flex items-center md:hidden">
            <LanguageMenu label={t.language} />
          </div>
          <span
            aria-hidden
            className={cn(
              "col-start-2 max-w-[50vw] truncate text-center text-headline transition-opacity duration-(--duration-fast)",
              !collapsed && "opacity-0",
            )}
          >
            {title}
          </span>
          <div className="-me-1.5 flex items-center justify-end gap-1">
            {actions}
            <span className="md:hidden">
              <AccountMenu compact />
            </span>
          </div>
        </div>
      </div>
      <div className="mb-7 flex items-end justify-between gap-4 pt-1 md:pt-6">
        <div className="grid min-w-0 gap-1.5">
          <h1
            ref={heading}
            className="text-large-title font-bold tracking-[-0.02em] md:text-[2.5rem] md:leading-tight"
          >
            {title}
          </h1>
          {lead && <p className="max-w-prose text-subheadline text-label-secondary">{lead}</p>}
        </div>
        {trailing && <div className="shrink-0 pb-1">{trailing}</div>}
      </div>
    </>
  );
}
