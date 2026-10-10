"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { AnchorLink } from "@/components/scroll/anchor-link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { NavItem } from "./content";
import { MobileMenu, type MobileMenuProps } from "./mobile-menu";
import { Wordmark } from "./wordmark";

interface SiteHeaderProps extends Omit<MobileMenuProps, "className"> {
  cta: NavItem;
}

/**
 * Fixed top bar. Transparent with light text over the opening footage, frosted glass over
 * the content. Links on wider screens; a full-screen menu on phones.
 */
export function SiteHeader({ hotelName, nav, cta, quickActions }: SiteHeaderProps) {
  const overHero = useOverHero();

  return (
    <header
      data-over-hero={overHero || undefined}
      className={cn(
        "fixed inset-x-0 top-0 z-40 pt-safe transition-[background-color,color,box-shadow] duration-500 ease-ios",
        overHero ? "text-white" : "material-chrome text-label shadow-[0_0.5px_0_var(--separator)]",
      )}
    >
      <a
        href="#main"
        className="sr-only rounded-full bg-bg px-4 py-2 text-label focus:not-sr-only focus:absolute focus:start-4 focus:top-[calc(env(safe-area-inset-top,0px)+0.5rem)]"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-6 px-safe-5">
        <AnchorLink href="#" aria-label={`${hotelName} — back to top`} className="py-2">
          <Wordmark name={hotelName} />
        </AnchorLink>

        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex items-center gap-9">
            {nav.map((item) => (
              <li key={item.href}>
                <AnchorLink
                  href={item.href}
                  className={cn(
                    "relative py-2 text-subheadline font-medium opacity-80 transition-opacity hover:opacity-100",
                    "after:absolute after:inset-x-0 after:bottom-1 after:h-px after:origin-left after:scale-x-0 after:bg-current",
                    "after:transition-transform after:duration-300 after:ease-ios hover:after:scale-x-100",
                  )}
                >
                  {item.label}
                </AnchorLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <Button
            asChild
            size="sm"
            variant={overHero ? "glass" : "filled"}
            className="hidden md:inline-flex"
          >
            <AnchorLink href={cta.href}>{cta.label}</AnchorLink>
          </Button>
          <MobileMenu
            hotelName={hotelName}
            nav={nav}
            quickActions={quickActions}
            className="md:hidden"
          />
        </div>
      </div>
    </header>
  );
}

/** Whether dark, full-bleed media (sections marked data-header-overlay) is behind the header. */
function useOverHero(): boolean {
  const pathname = usePathname();
  const [over, setOver] = useState(true);

  useEffect(() => {
    const targets = Array.from(document.querySelectorAll("[data-header-overlay]"));
    const behind = new Set<Element>();
    // The root is the top strip of the viewport, where the header sits.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.target !== document.body) behind.add(entry.target);
          else behind.delete(entry.target);
        }
        setOver(behind.size > 0);
      },
      { rootMargin: "0px 0px -94% 0px" },
    );
    // Observing the body when nothing is marked still reports, turning the overlay off.
    for (const target of targets.length > 0 ? targets : [document.body]) observer.observe(target);
    return () => observer.disconnect();
  }, [pathname]);

  return over;
}
