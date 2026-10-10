"use client";

import { useId, useRef } from "react";

import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { gsap, useGSAP } from "@/lib/gsap";
import { cn } from "@/lib/utils";

export interface SignatureGlyph {
  /** SVG path in the signature's viewBox. */
  d: string;
  /** Outline length, which sets how long the pen spends on the glyph. */
  length: number;
}

/** A text pre-rendered as glyph outlines in writing order (scripts/generate-signature.mjs). */
export interface Signature {
  lang: string;
  dir: "ltr" | "rtl";
  text: string;
  viewBox: readonly number[];
  glyphs: readonly SignatureGlyph[];
}

export interface HandwritingProps {
  /** Written one after another, in a loop. */
  signatures: readonly Signature[];
  /** Pen time per signature. */
  writeSeconds?: number;
  /** How long a finished signature stays before giving way to the next. */
  holdSeconds?: number;
  className?: string;
}

/**
 * Writes each signature as if by hand — the pen traces every glyph outline at a steady pace,
 * the ink fills in behind it — then fades it out for the next, looping. Decorative: give the
 * text to assistive technology separately.
 *
 * Pauses while off screen. With reduced motion every signature is shown finished, stacked.
 */
export function Handwriting({
  signatures,
  writeSeconds = 2.8,
  holdSeconds = 2.2,
  className,
}: HandwritingProps) {
  const root = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  // React ids may contain characters that break url(#…) references.
  const gradient = `ink${useId().replace(/[^\w-]/g, "")}`;
  // Same scale for every signature: widths follow their viewBoxes.
  const widest = Math.max(...signatures.map((s) => s.viewBox[2] ?? 0));

  useGSAP(
    () => {
      const el = root.current;
      if (!el || reducedMotion) return;
      const timeline = gsap.timeline({ repeat: -1, paused: true });
      for (const svg of gsap.utils.toArray<SVGSVGElement>("[data-signature]", el)) {
        timeline.add(write(svg, writeSeconds, holdSeconds));
      }
      const observer = new IntersectionObserver(([entry]) => {
        if (entry?.isIntersecting) timeline.play();
        else timeline.pause();
      });
      observer.observe(el);
      return () => observer.disconnect();
    },
    {
      scope: root,
      dependencies: [signatures, reducedMotion, writeSeconds, holdSeconds],
      revertOnUpdate: true,
    },
  );

  return (
    <div
      ref={root}
      aria-hidden
      className={cn(
        "grid place-items-center motion-reduce:flex motion-reduce:flex-col motion-reduce:gap-8",
        className,
      )}
    >
      {signatures.map((signature, i) => {
        const [x = 0, y = 0, w = 0, h = 0] = signature.viewBox;
        const fill = `${gradient}-${signature.lang}`;
        return (
          <svg
            key={signature.lang}
            data-signature={signature.lang}
            viewBox={`${x} ${y} ${w} ${h}`}
            style={{ width: `${(w / widest) * 100}%` }}
            className={cn(
              "col-start-1 row-start-1 h-auto overflow-visible",
              // Later signatures wait their turn; the timeline reveals them.
              i > 0 && "invisible motion-reduce:visible",
            )}
          >
            <defs>
              <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fffdf8" />
                <stop offset="100%" stopColor="#e9d6b0" />
              </linearGradient>
            </defs>
            <g fill={`url(#${fill})`} stroke="#f6ead2" strokeWidth={1.4} strokeLinejoin="round">
              {signature.glyphs.map((glyph, j) => (
                <path
                  key={j}
                  data-glyph=""
                  data-length={glyph.length}
                  d={glyph.d}
                  pathLength={1}
                  strokeDasharray="1 1"
                  strokeDashoffset={1}
                  fillOpacity={0}
                  className="motion-reduce:[fill-opacity:1] motion-reduce:[stroke-opacity:0]"
                />
              ))}
            </g>
          </svg>
        );
      })}
    </div>
  );
}

/** One signature's turn: write, hold, fade out — leaving it reset for the next loop. */
function write(svg: SVGSVGElement, writeSeconds: number, holdSeconds: number) {
  const glyphs = gsap.utils.toArray<SVGPathElement>("[data-glyph]", svg);
  const lengths = glyphs.map((g) => Number(g.dataset.length) || 1);
  const total = lengths.reduce((sum, n) => sum + n, 0) || 1;

  const tl = gsap.timeline();
  tl.set(svg, { autoAlpha: 1, y: 0, filter: "blur(0px)" });
  tl.set(glyphs, { strokeDashoffset: 1, fillOpacity: 0, strokeOpacity: 1 });

  let at = 0.2;
  glyphs.forEach((glyph, i) => {
    const duration = Math.max(0.12, (writeSeconds * (lengths[i] ?? 0)) / total);
    tl.to(glyph, { strokeDashoffset: 0, duration, ease: "power1.inOut" }, at);
    tl.to(glyph, { fillOpacity: 1, duration: 0.7, ease: "power2.out" }, at + duration * 0.55);
    // The next stroke starts as this one finishes, like a pen lifting and landing.
    at += duration * 0.85;
  });

  tl.to(glyphs, { strokeOpacity: 0, duration: 0.8, ease: "power1.out" }, ">-0.3");
  tl.to(
    svg,
    { autoAlpha: 0, y: -12, filter: "blur(10px)", duration: 0.9, ease: "power2.in" },
    `+=${holdSeconds}`,
  );
  return tl;
}
