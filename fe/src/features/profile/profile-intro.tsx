"use client";

import { useRef } from "react";
import type * as React from "react";

import type { Signature } from "@/components/signature/handwriting";
import type { ContactProfile } from "@/features/site/content";
import type { UiStrings } from "@/i18n/ui";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { gsap, useGSAP } from "@/lib/gsap";
import { cn } from "@/lib/utils";

import { actionLinkProps, contactActions } from "./contact-actions";

interface ProfileIntroProps {
  profile: ContactProfile;
  organization: string;
  eyebrow: string;
  /** The name as glyph outlines, written as the visitor scrolls; set as text without one. */
  signature: Signature | undefined;
  ui: UiStrings;
}

/** Scroll distance the opening stays in place for, in viewport heights. */
const PIN_LENGTH = 1.6;

export const PROFILE_INTRO_ID = "profile-intro";

/**
 * The card's opening: the portrait develops out of the white as the section arrives, then —
 * as the visitor scrolls — moves up while the name writes itself beneath it, followed by the
 * role and the contact buttons, which rise with their shadows. The page scrolls on normally
 * afterwards.
 *
 * The name overlaps the bottom of the portrait: its accented first line ("Momen Tawfiq", over
 * the suit) is white, the rest black.
 *
 * With reduced motion (or before scripts run) everything is shown at rest.
 */
export function ProfileIntro({ profile, organization, eyebrow, signature, ui }: ProfileIntroProps) {
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const actions = contactActions(profile, ui);
  const [x = 0, y = 0, w = 0, h = 0] = signature?.viewBox ?? [];
  // Width, against the portrait's, at which the white line stays over the suit. Arabic sets
  // taller for its width.
  const nameWidth = signature?.dir === "rtl" ? 0.6 : 0.78;

  useGSAP(
    () => {
      const section = root.current;
      const rail = track.current;
      if (!section || !rail || reducedMotion) return;
      const q = gsap.utils.selector(section);
      const stage = q("[data-intro=stage]");
      const below = q("[data-intro=below]")[0] as HTMLElement | undefined;
      const glyphs = gsap.utils.toArray<SVGPathElement>("[data-name] path", section);

      // Arrival, on its own clock once the section comes into view: the portrait develops
      // out of the soft, faint state it is first painted in (so it counts as painted).
      const arrival = { trigger: section, start: "top 80%", once: true };
      const portrait = q("[data-intro=portrait]");
      gsap.fromTo(
        portrait,
        { opacity: 0.4, scale: 1.08, filter: "blur(24px)" },
        {
          opacity: 1,
          scale: 1,
          filter: "blur(0px)",
          duration: 1.8,
          ease: "power3.out",
          clearProps: "scale",
          // Inline, over the classes that set the first paint.
          onComplete: () => gsap.set(portrait, { filter: "none" }),
          scrollTrigger: arrival,
        },
      );
      gsap.fromTo(
        q("[data-intro=arrive]"),
        { autoAlpha: 0, y: 10 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 1,
          delay: 0.7,
          stagger: 0.2,
          ease: "power2.out",
          scrollTrigger: arrival,
        },
      );

      const timeline = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: rail,
          start: "top top",
          // The section sticks for the track's extra height, laid out by the server.
          end: () => `+=${rail.offsetHeight - section.offsetHeight}`,
          scrub: 0.8,
          invalidateOnRefresh: true,
        },
      });

      // The portrait starts centered on its own and rises to make room for the name.
      timeline.fromTo(
        stage,
        { y: () => (below?.offsetHeight ?? 0) / 2, scale: 1.06 },
        { y: 0, scale: 1, duration: 0.32, ease: "power1.inOut" },
        0,
      );
      timeline.to(q("[data-intro=hint]"), { autoAlpha: 0, duration: 0.08 }, 0);

      // The name, glyph by glyph: the pen traces each outline, the ink follows.
      const lengths = glyphs.map((g) => Number(g.dataset.length) || 1);
      const total = lengths.reduce((sum, n) => sum + n, 0) || 1;
      let at = 0.12;
      glyphs.forEach((glyph, i) => {
        const duration = Math.max(0.012, (0.5 * (lengths[i] ?? 0)) / total);
        timeline.fromTo(
          glyph,
          { strokeDashoffset: 1, strokeOpacity: 0 },
          { strokeDashoffset: 0, strokeOpacity: 1, duration },
          at,
        );
        timeline.fromTo(
          glyph,
          { fillOpacity: 0 },
          { fillOpacity: 1, duration: duration * 1.6, ease: "power1.out" },
          at + duration * 0.5,
        );
        at += duration * 0.82;
      });

      timeline.fromTo(
        q("[data-intro=rule]"),
        { autoAlpha: 0, scaleX: 0 },
        { autoAlpha: 1, scaleX: 1, duration: 0.14 },
        0.6,
      );
      timeline.fromTo(
        q("[data-intro=meta]"),
        { autoAlpha: 0, y: 14, filter: "blur(6px)" },
        { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 0.12, stagger: 0.04 },
        0.62,
      );
      // The buttons lift off the page: their shadows deepen as they rise.
      timeline.fromTo(
        q("[data-intro=action]"),
        { autoAlpha: 0, y: 28, scale: 0.86 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.14, stagger: 0.035, ease: "back.out(1.7)" },
        0.74,
      );
      timeline.fromTo(
        q("[data-intro=action] .shadow-lift"),
        { "--lift": 0 },
        { "--lift": 1, duration: 0.18, stagger: 0.035 },
        0.76,
      );
      timeline.set({}, {}, 1);
    },
    { scope: root, dependencies: [reducedMotion], revertOnUpdate: true },
  );

  return (
    <div ref={track} style={{ "--track": `${PIN_LENGTH * 100}svh` } as React.CSSProperties}>
      <section
        ref={root}
        id={PROFILE_INTRO_ID}
        aria-labelledby="profile-name"
        style={{ "--portrait": "min(94vw, 32rem, 54svh)" } as React.CSSProperties}
        className="relative top-0 flex min-h-svh flex-col items-center justify-center overflow-hidden bg-white px-safe-5 pt-safe-20 pb-safe-10 motion-safe:sticky"
      >
        <p
          data-intro="arrive"
          className="mb-6 flex items-center gap-3 text-caption-2 font-medium tracking-[0.36em] text-neutral-500 uppercase motion-safe:invisible"
        >
          <span aria-hidden className="h-px w-6 bg-neutral-300" />
          {eyebrow}
          <span aria-hidden className="h-px w-6 bg-neutral-300" />
        </p>

        <div data-intro="stage" className="relative w-(--portrait)">
          {profile.portrait && (
            // eslint-disable-next-line @next/next/no-img-element -- pre-sized WebP set, prepared for the white page
            <img
              data-intro="portrait"
              src={profile.portrait.src}
              srcSet={profile.portrait.srcSet}
              sizes="(min-width: 640px) 32rem, 94vw"
              width={profile.portrait.width}
              height={profile.portrait.height}
              alt={profile.portrait.alt}
              decoding="async"
              className="h-auto w-full select-none motion-safe:opacity-40 motion-safe:blur-xl"
              draggable={false}
            />
          )}
        </div>

        <div
          data-intro="below"
          className="relative z-10 -mt-[calc(var(--portrait)*0.22)] flex w-full flex-col items-center text-center"
        >
          <h2 id="profile-name" className={cn(signature && "sr-only")}>
            {!signature && <NameText name={profile.name} />}
            {signature && profile.name}
          </h2>
          {signature && (
            <svg
              data-name
              aria-hidden
              viewBox={`${x} ${y} ${w} ${h}`}
              strokeWidth={0.7}
              style={{ "--name": nameWidth } as React.CSSProperties}
              className="block h-auto w-[calc(var(--portrait)*var(--name))] overflow-visible"
            >
              {signature.glyphs.map((glyph, i) => (
                <path
                  key={i}
                  data-length={glyph.length}
                  d={glyph.d}
                  fill={glyph.accent ? "#fff" : "#0a0a0a"}
                  stroke={glyph.accent ? "#fff" : "#0a0a0a"}
                  pathLength={1}
                  strokeDasharray="1 1"
                  strokeDashoffset={1}
                  strokeOpacity={0}
                  fillOpacity={0}
                  className={cn(
                    "motion-reduce:[fill-opacity:1]",
                    // Keeps the white letters legible where they cross the shirt.
                    glyph.accent && "drop-shadow-[0_1px_5px_rgb(0_0_0/0.45)]",
                  )}
                />
              ))}
            </svg>
          )}

          <span
            data-intro="rule"
            aria-hidden
            className="mt-5 h-px w-12 bg-neutral-950 motion-safe:invisible"
          />
          <p
            data-intro="meta"
            className="mt-4 text-footnote font-semibold tracking-[0.28em] text-neutral-950 uppercase motion-safe:invisible"
          >
            {profile.title}
          </p>
          <p
            data-intro="meta"
            className="mt-1.5 text-footnote text-neutral-500 motion-safe:invisible"
          >
            {organization}
          </p>

          <ul
            aria-label={ui.contact}
            className="mt-8 flex items-start justify-center gap-5 sm:gap-7"
          >
            {actions.map((action) => (
              <li key={action.id} data-intro="action" className="motion-safe:invisible">
                <a
                  {...actionLinkProps(action)}
                  aria-label={action.description}
                  className="group flex w-16 pressable flex-col items-center gap-2.5"
                >
                  <span
                    className={cn(
                      "grid size-14 place-items-center rounded-full shadow-lift [&_svg]:size-[1.35rem] [&_svg]:stroke-[1.6]",
                      action.id === "save"
                        ? "bg-white text-neutral-950 ring-1 ring-neutral-950/10"
                        : "bg-neutral-950 text-white",
                    )}
                  >
                    {action.icon}
                  </span>
                  <span className="text-caption-2 font-medium tracking-[0.18em] text-neutral-600 uppercase">
                    {action.label}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div
          data-intro="hint"
          aria-hidden
          className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 pb-safe-6 motion-reduce:hidden"
        >
          <span
            data-intro="arrive"
            className="text-caption-2 font-medium tracking-[0.32em] text-neutral-500 uppercase motion-safe:invisible"
          >
            {ui.scroll}
          </span>
          <span className="relative h-10 w-px overflow-hidden bg-neutral-200">
            <span className="absolute inset-x-0 top-0 h-1/2 animate-scroll-hint bg-linear-to-b from-transparent to-neutral-900" />
          </span>
        </div>

        {/* Without scripts nothing would reveal the hidden pieces. */}
        <noscript>
          <style>{`[data-intro]{visibility:visible!important;transform:none!important}[data-intro=portrait]{opacity:1!important;filter:none!important}[data-name] path{fill-opacity:1}`}</style>
        </noscript>
      </section>
      {/* The scroll distance; a sticky element only travels within its parent's content. */}
      <div aria-hidden className="motion-safe:h-(--track)" />
    </div>
  );
}

/**
 * The name as text, for when it can't be written as outlines: the first words white over the
 * portrait like the written name's first line, the last word beneath.
 */
function NameText({ name }: { name: string }) {
  const words = name.trim().split(/\s+/);
  const last = words.length > 1 ? words.pop() : undefined;
  return (
    <span
      data-intro="meta"
      className="flex flex-col items-center text-[clamp(2rem,9vw,3rem)] leading-[1.08] font-semibold tracking-tight motion-safe:invisible"
    >
      <span className="text-white drop-shadow-[0_1px_5px_rgb(0_0_0/0.45)]">{words.join(" ")}</span>
      {last && <span className="text-neutral-950">{last}</span>}
    </span>
  );
}
