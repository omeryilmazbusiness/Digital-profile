"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { AnchorLink } from "@/components/scroll/anchor-link";
import { Button } from "@/components/ui/button";
import { fill } from "@/i18n/ui";
import { cn } from "@/lib/utils";

import type { NavItem } from "./content";
import { LanguageMenu } from "./language-switch";
import { MobileMenu, type MobileMenuProps } from "./mobile-menu";
import { Wordmark } from "./wordmark";

interface SiteHeaderProps extends Omit<MobileMenuProps, "className"> {
  /** The highlighted link at the end of the bar on wider screens; left out of the links. */
  cta: NavItem;
}

/**
 * Fixed top bar. Transparent with light text over the opening footage, frosted glass over
 * the content. Links on wider screens; a full-screen menu on phones.
 */
export function SiteHeader({ hotelName, home, nav, cta, quickActions, ui }: SiteHeaderProps) {
  const overHero = useOverHero(home);
  const pathname = usePathname();
  const links = nav.filter((item) => item.href !== cta.href);

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
        {ui.skipToContent}
      </a>
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-6 px-safe-5">
        <AnchorLink
          href={home}
          aria-label={fill(ui.homeLink, { hotel: hotelName })}
          className="py-2"
        >
          <Wordmark name={hotelName} />
        </AnchorLink>

        <nav aria-label={ui.mainNav} className="hidden md:block">
          <ul className="flex items-center gap-9">
            {links.map((item) => (
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
          <LanguageMenu
            label={ui.language}
            className="me-1 hidden opacity-80 transition-opacity hover:opacity-100 md:flex"
          />
          <Button
            asChild
            size="sm"
            variant={overHero ? "glass" : "filled"}
            className={cn(
              "hidden md:inline-flex",
              cta.image && "ps-1",
              !overHero && "bg-label text-bg hover:bg-label/85",
            )}
          >
            <AnchorLink href={cta.href} aria-current={pathname === cta.href ? "page" : undefined}>
              {cta.image && (
                // eslint-disable-next-line @next/next/no-img-element -- a 3 KB pre-sized avatar
                <img
                  src={cta.image}
                  alt=""
                  width={24}
                  height={24}
                  className="size-6 rounded-full object-cover object-top"
                />
              )}
              {cta.label}
            </AnchorLink>
          </Button>
          <MobileMenu
            hotelName={hotelName}
            home={home}
            nav={nav}
            quickActions={quickActions}
            ui={ui}
            className="md:hidden"
          />
        </div>
      </div>
    </header>
  );
}

/** Whether dark, full-bleed media (sections marked data-header-overlay) is behind the header. */
function useOverHero(home: string): boolean {
  const pathname = usePathname();
  // Only the landing page opens on dark footage; starting right avoids a flash before the
  // observer reports.
  const opensOverMedia = pathname === home;
  const [state, setState] = useState({ pathname, over: opensOverMedia });
  if (state.pathname !== pathname) setState({ pathname, over: opensOverMedia });

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
        setState({ pathname, over: behind.size > 0 });
      },
      { rootMargin: "0px 0px -94% 0px" },
    );
    // Observing the body when nothing is marked still reports, turning the overlay off.
    for (const target of targets.length > 0 ? targets : [document.body]) observer.observe(target);
    return () => observer.disconnect();
  }, [pathname]);

  return state.over;
}
