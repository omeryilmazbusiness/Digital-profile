"use client";

import { useEffect, useState } from "react";

import type { ContactProfile } from "@/features/site/content";
import { cn } from "@/lib/utils";

import { actionLinkProps, contactActions } from "./contact-actions";

interface ContactDockProps {
  profile: ContactProfile;
  /** Shown once this element has scrolled above the viewport… */
  afterId: string;
  /** …and hidden again while this one is on screen. */
  hideWhileId: string;
}

/**
 * Floating bar that keeps WhatsApp and "Save contact" a thumb away while the visitor reads
 * the card, clear of the home indicator.
 */
export function ContactDock({ profile, afterId, hideWhileId }: ContactDockProps) {
  const [past, setPast] = useState(false);
  const [hidden, setHidden] = useState(false);
  const visible = past && !hidden;
  const actions = contactActions(profile);
  const whatsapp = actions.find((a) => a.id === "whatsapp")!;
  const save = actions.find((a) => a.id === "save")!;

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
        "fixed inset-x-0 bottom-0 z-30 px-safe-3 pb-safe-3 transition-[translate,opacity] duration-500 ease-ios",
        visible ? "translate-y-0 opacity-100" : "translate-y-[calc(100%+1rem)] opacity-0",
      )}
    >
      <div className="mx-auto flex max-w-md items-center gap-2 rounded-full bg-neutral-950/92 p-1.5 text-white shadow-[0_24px_60px_-16px_rgb(0_0_0/0.55)] ring-1 ring-white/10 backdrop-blur-xl">
        {profile.portrait && (
          // eslint-disable-next-line @next/next/no-img-element -- a 3 KB pre-sized avatar
          <img
            src={profile.portrait.avatar}
            alt=""
            width={40}
            height={40}
            className="size-10 shrink-0 rounded-full"
          />
        )}
        <p className="min-w-0 flex-1 ps-1 leading-tight">
          <span className="block truncate text-subheadline font-semibold">{profile.name}</span>
          <span className="block truncate text-caption-1 text-white/60">{profile.title}</span>
        </p>
        <a
          {...actionLinkProps(save)}
          className="flex h-10 shrink-0 pressable items-center gap-2 rounded-full bg-white px-4 text-subheadline font-semibold text-neutral-950 [&_svg]:size-4"
        >
          {save.icon}
          Save
          <span className="sr-only"> contact</span>
        </a>
        <a
          {...actionLinkProps(whatsapp)}
          aria-label={whatsapp.description}
          className="grid size-10 shrink-0 pressable place-items-center rounded-full bg-white/12 [&_svg]:size-5"
        >
          {whatsapp.icon}
        </a>
      </div>
    </div>
  );
}
