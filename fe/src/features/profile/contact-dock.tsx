"use client";

import { useEffect, useState } from "react";

import type { ContactProfile } from "@/features/site/content";
import { fill, type UiStrings } from "@/i18n/ui";
import { cn } from "@/lib/utils";

import { actionLinkProps, contactActions } from "./contact-actions";

interface ContactDockProps {
  profile: ContactProfile;
  ui: UiStrings;
  /** Shown once this element has scrolled above the viewport… */
  afterId: string;
  /** …and hidden again while this one is on screen. */
  hideWhileId: string;
}

/**
 * A slim black capsule floating above the home indicator while the visitor reads the card:
 * who it is, and call, WhatsApp and save a thumb away.
 */
export function ContactDock({ profile, ui, afterId, hideWhileId }: ContactDockProps) {
  const [past, setPast] = useState(false);
  const [hidden, setHidden] = useState(false);
  const visible = past && !hidden;
  const actions = contactActions(profile, ui).filter((a) => a.id !== "email");

  useEffect(() => {
    const after = document.getElementById(afterId);
    const hideWhile = document.getElementById(hideWhileId);
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === after) {
          setPast(!entry.isIntersecting && entry.boundingClientRect.top < 0);
        } else {
          setHidden(entry.isIntersecting);
        }
      }
    });
    if (after) observer.observe(after);
    if (hideWhile) observer.observe(hideWhile);
    return () => observer.disconnect();
  }, [afterId, hideWhileId]);

  return (
    <div
      inert={!visible}
      aria-hidden={!visible}
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-safe-4 pb-safe-4 transition-[translate,opacity,filter] duration-700 ease-ios",
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0 blur-sm",
      )}
    >
      <nav
        aria-label={fill(ui.contactName, { name: profile.name })}
        className="pointer-events-auto flex items-center gap-1 rounded-full bg-neutral-950 p-1 text-white shadow-[0_18px_40px_-14px_rgb(0_0_0/0.55),0_0_0_0.5px_rgb(255_255_255/0.12)_inset]"
      >
        {profile.portrait && (
          // eslint-disable-next-line @next/next/no-img-element -- a 3 KB pre-sized avatar
          <img
            src={profile.portrait.avatar}
            alt=""
            width={36}
            height={36}
            className="size-9 shrink-0 rounded-full"
          />
        )}
        <span className="ps-2 pe-3 font-display text-[1.0625rem] leading-none whitespace-nowrap">
          {profile.givenName.split(" ")[0]} {profile.familyName}
        </span>
        <span aria-hidden className="h-5 w-px bg-white/15" />
        {actions.map((action) => (
          <a
            key={action.id}
            {...actionLinkProps(action)}
            aria-label={action.description}
            className="grid size-9 shrink-0 pressable place-items-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white [&_svg]:size-[1.05rem] [&_svg]:stroke-[1.6]"
          >
            {action.icon}
          </a>
        ))}
      </nav>
    </div>
  );
}
