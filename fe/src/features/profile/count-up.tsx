"use client";

import { useRef } from "react";

import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { gsap, useGSAP } from "@/lib/gsap";

const number = new Intl.NumberFormat("en-US");

interface CountUpProps {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

/**
 * A figure that counts up from zero the first time it scrolls into view; its prefix and
 * suffix ("<", "+", "h") are set small beside it. Assistive technology reads the final
 * figure only.
 */
export function CountUp({ value, prefix = "", suffix = "", className }: CountUpProps) {
  const digits = useRef<HTMLSpanElement>(null);
  const reducedMotion = useReducedMotion();

  useGSAP(
    () => {
      const el = digits.current;
      if (!el || reducedMotion) return;
      const counter = { n: 0 };
      el.textContent = number.format(0);
      const tween = gsap.to(counter, {
        n: value,
        duration: 1.8,
        ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 90%", once: true },
        onUpdate: () => {
          el.textContent = number.format(Math.round(counter.n));
        },
      });
      return () => {
        tween.kill();
        el.textContent = number.format(value);
      };
    },
    { dependencies: [reducedMotion, value], revertOnUpdate: true },
  );

  const affix =
    "mx-[0.08em] inline-block pt-[0.3em] align-top font-sans text-[0.42em] leading-none font-light tracking-normal text-neutral-500";
  return (
    <span className={className}>
      <span aria-hidden>
        {prefix && <span className={affix}>{prefix}</span>}
        <span ref={digits}>{number.format(value)}</span>
        {suffix && <span className={affix}>{suffix}</span>}
      </span>
      <span className="sr-only">{`${prefix}${number.format(value)}${suffix}`}</span>
    </span>
  );
}
