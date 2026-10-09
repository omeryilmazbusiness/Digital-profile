"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type * as React from "react";

import { cn } from "@/lib/utils";

export interface NavBarProps {
  title: React.ReactNode;
  /**
   * iOS large title: shown big under the bar and moved into the bar once scrolled away.
   * The page's h1 is the large title when set, the bar title otherwise.
   */
  largeTitle?: boolean;
  /** Start slot, typically a NavBackLink. */
  leading?: React.ReactNode;
  /** End slot, typically one or two IconButtons. */
  trailing?: React.ReactNode;
  className?: string;
}

export function NavBar({ title, largeTitle = false, leading, trailing, className }: NavBarProps) {
  const header = useRef<HTMLElement>(null);
  const sentinel = useRef<HTMLHeadingElement>(null);
  const [collapsed, setCollapsed] = useState(!largeTitle);

  useEffect(() => {
    const el = sentinel.current;
    if (!largeTitle || !el) return;
    const barHeight = header.current?.offsetHeight ?? 0;
    const io = new IntersectionObserver(([entry]) => setCollapsed(!entry.isIntersecting), {
      rootMargin: `-${barHeight}px 0px 0px 0px`,
      threshold: 0,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [largeTitle]);

  const SmallTitle = largeTitle ? "span" : "h1";

  return (
    <>
      <header
        ref={header}
        data-slot="nav-bar"
        data-collapsed={collapsed}
        className={cn(
          "sticky top-0 z-40 pt-safe transition-[background-color,box-shadow] duration-(--duration-base)",
          "data-[collapsed=true]:material-chrome data-[collapsed=true]:shadow-[0_0.5px_0_var(--separator)]",
          className,
        )}
      >
        <div className="relative mx-auto grid h-(--nav-height) max-w-(--content-max) grid-cols-[1fr_auto_1fr] items-center gap-2 px-safe-2">
          <div className="flex min-w-0 items-center justify-start">{leading}</div>
          <SmallTitle
            aria-hidden={largeTitle || undefined}
            className={cn(
              "max-w-[60vw] truncate text-center text-headline text-label transition-opacity duration-(--duration-fast)",
              largeTitle && !collapsed && "opacity-0",
            )}
          >
            {title}
          </SmallTitle>
          <div className="flex min-w-0 items-center justify-end gap-1">{trailing}</div>
        </div>
      </header>
      {largeTitle && (
        <h1
          ref={sentinel}
          className="mx-auto max-w-(--content-max) px-safe-4 pt-1 pb-2 text-large-title font-bold text-label"
        >
          {title}
        </h1>
      )}
    </>
  );
}

/** Back link for the NavBar's leading slot; the chevron mirrors in RTL. */
export function NavBackLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "-ms-1 flex h-11 min-w-11 pressable items-center gap-0.5 rounded-full pe-2 text-body text-tint outline-none",
        className,
      )}
    >
      <ChevronLeft aria-hidden strokeWidth={2.5} className="size-6 shrink-0 rtl:-scale-x-100" />
      <span className="truncate">{children}</span>
    </Link>
  );
}
