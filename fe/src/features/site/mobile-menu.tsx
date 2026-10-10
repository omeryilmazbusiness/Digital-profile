"use client";

import { X } from "lucide-react";
import { usePathname } from "next/navigation";
import { Dialog } from "radix-ui";
import { useState } from "react";
import type * as React from "react";

import { AnchorLink } from "@/components/scroll/anchor-link";
import { useScrollLock } from "@/components/scroll/smooth-scroll-provider";
import { Button } from "@/components/ui/button";
import { Entrance } from "@/components/ui/motion";
import { cn } from "@/lib/utils";

import type { NavItem } from "./content";
import { Wordmark } from "./wordmark";

export interface QuickAction {
  label: string;
  href: string;
  icon: React.ReactNode;
  /** Opens in a new tab (external apps such as WhatsApp). */
  external?: boolean;
}

export interface MobileMenuProps {
  hotelName: string;
  nav: readonly NavItem[];
  /** Contact shortcuts at the foot of the menu. */
  quickActions: readonly QuickAction[];
  className?: string;
}

/** Full-screen navigation for phones, opened from a two-line menu button. */
export function MobileMenu({ hotelName, nav, quickActions, className }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const pathname = usePathname();
  useScrollLock(open);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        aria-label="Open menu"
        className={cn("-me-2.5 grid size-11 pressable place-items-center rounded-full", className)}
      >
        <span aria-hidden className="flex w-5 flex-col gap-1.5">
          <span className="h-[1.5px] w-full rounded-full bg-current" />
          <span className="h-[1.5px] w-3/5 self-end rounded-full bg-current" />
        </span>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            "fixed inset-0 z-50 flex flex-col material-thick pt-safe text-label outline-none",
            "data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in",
          )}
        >
          <Dialog.Title className="sr-only">Menu</Dialog.Title>
          <div className="flex h-14 items-center justify-between px-safe-5">
            <AnchorLink href="/" onNavigate={close} aria-label={`${hotelName} — home`}>
              <Wordmark name={hotelName} />
            </AnchorLink>
            <Dialog.Close
              aria-label="Close menu"
              className="-me-2.5 grid size-11 pressable place-items-center rounded-full"
            >
              <X aria-hidden className="size-6" strokeWidth={1.5} />
            </Dialog.Close>
          </div>

          <nav aria-label="Main" className="flex-1 overflow-y-auto px-safe-6 pt-10">
            <ul className="flex flex-col gap-1">
              {nav.map((item, i) => (
                <li key={item.href}>
                  <Entrance delay={80 + i * 70}>
                    <AnchorLink
                      href={item.href}
                      onNavigate={close}
                      aria-current={pathname === item.href ? "page" : undefined}
                      className={cn(
                        "flex items-baseline gap-4 py-2.5 text-[2.5rem] leading-tight font-semibold tracking-tight",
                        item.image && "mt-6 items-center border-t border-separator pt-8",
                      )}
                    >
                      <span
                        aria-hidden
                        className="w-6 shrink-0 self-baseline font-mono text-caption-1 text-label-tertiary"
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className={cn(item.image && "text-[1.75rem] leading-[1.15]")}>
                          {item.label}
                        </span>
                        {item.caption && (
                          <span className="mt-1.5 text-caption-1 font-medium tracking-[0.24em] text-label-secondary uppercase">
                            {item.caption}
                          </span>
                        )}
                      </span>
                      {item.image && (
                        // eslint-disable-next-line @next/next/no-img-element -- a 3 KB pre-sized avatar
                        <img
                          src={item.image}
                          alt=""
                          width={56}
                          height={56}
                          className="size-14 shrink-0 rounded-full shadow-card"
                        />
                      )}
                    </AnchorLink>
                  </Entrance>
                </li>
              ))}
            </ul>
          </nav>

          <Entrance delay={80 + nav.length * 70} className="px-safe-6 pb-safe-8">
            <div className="flex gap-3 border-t border-separator pt-6">
              {quickActions.map((action) => (
                <Button key={action.href} asChild variant="gray" block className="flex-1">
                  <a
                    href={action.href}
                    {...(action.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  >
                    {action.icon}
                    {action.label}
                  </a>
                </Button>
              ))}
            </div>
          </Entrance>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
