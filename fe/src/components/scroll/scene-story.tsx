import { Fragment } from "react";
import type * as React from "react";

import { cn } from "@/lib/utils";

import { sceneReveal } from "./scene-reveal";

interface SceneStoryProps {
  /** Small number before the eyebrow, e.g. "02". */
  index?: string;
  eyebrow: string;
  title: string;
  /** Heading level of the title; use 1 for the scene that carries the page title. */
  level?: 1 | 2 | 3;
  /** Centered, or set from the start edge like an editorial caption. */
  align?: "center" | "start";
  children?: React.ReactNode;
  className?: string;
}

const word = { [sceneReveal.word]: "" };
const item = { [sceneReveal.item]: "" };
const line = { [sceneReveal.line]: "" };

/**
 * Editorial text for scroll-video scenes: a gold eyebrow with a drawn hairline, a large title
 * in the champagne ink of the opening signature, and a short lead. Always light on dark — it
 * sits on footage — with a soft vignette for legibility on bright frames.
 *
 * Marked up for the scene choreography (scene-reveal.ts); without it, e.g. under reduced
 * motion, everything is simply shown.
 */
export function SceneStory({
  index,
  eyebrow,
  title,
  level = 2,
  align = "center",
  children,
  className,
}: SceneStoryProps) {
  const Heading = `h${level}` as const;
  const centered = align === "center";

  return (
    <div
      className={cn(
        "relative flex w-full max-w-3xl flex-col text-white",
        centered ? "items-center text-center" : "items-start text-start sm:me-auto",
        className,
      )}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -inset-y-24 bg-[radial-gradient(closest-side,rgb(0_0_0/0.58),rgb(0_0_0/0.26)_60%,transparent)]",
          centered ? "-inset-x-[30vw]" : "-start-[30vw] -end-[10vw]",
        )}
      />

      <p
        {...item}
        className="relative flex items-center gap-3 text-caption-1 font-semibold tracking-[0.3em] text-[#e9d6b0] uppercase"
      >
        {index && <span className="font-mono tracking-normal">{index}</span>}
        <span
          {...line}
          aria-hidden
          className="h-px w-10 origin-left bg-current opacity-60 rtl:origin-right"
        />
        {eyebrow}
      </p>

      <Heading className="relative mt-5 text-[2.5rem] leading-[1.06] font-semibold tracking-tight text-balance sm:text-6xl md:text-7xl">
        {title.split(/\s+/).map((text, i) => (
          <Fragment key={i}>
            {i > 0 && " "}
            {/* The mask the word rises out of; padding keeps descenders unclipped. */}
            <span className="-mb-[0.14em] inline-block overflow-hidden pb-[0.14em] align-bottom">
              <span
                {...word}
                className="inline-block bg-linear-to-b from-[#fffdf8] to-[#e9d6b0] bg-clip-text text-transparent"
              >
                {text}
              </span>
            </span>
          </Fragment>
        ))}
      </Heading>

      {children && (
        <div
          {...item}
          className="relative mt-6 max-w-md text-body text-pretty text-white/80 sm:text-title-3 sm:font-normal"
        >
          {children}
        </div>
      )}
    </div>
  );
}
