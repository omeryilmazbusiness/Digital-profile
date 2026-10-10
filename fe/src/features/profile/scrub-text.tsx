"use client";

import { Fragment, useRef } from "react";

import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { gsap, useGSAP } from "@/lib/gsap";
import { cn } from "@/lib/utils";

/** A statement that inks in word by word as it scrolls through the viewport. */
export function ScrubText({ text, className }: { text: string; className?: string }) {
  const root = useRef<HTMLParagraphElement>(null);
  const reducedMotion = useReducedMotion();
  const words = text.split(/\s+/u).filter(Boolean);

  useGSAP(
    () => {
      if (!root.current || reducedMotion) return;
      gsap.fromTo(
        root.current.querySelectorAll("[data-word]"),
        { opacity: 0.12 },
        {
          opacity: 1,
          ease: "none",
          stagger: 0.1,
          scrollTrigger: {
            trigger: root.current,
            start: "top 82%",
            end: "bottom 50%",
            scrub: true,
          },
        },
      );
    },
    { scope: root, dependencies: [reducedMotion, text], revertOnUpdate: true },
  );

  return (
    <p ref={root} className={cn(className)}>
      {words.map((word, i) => (
        <Fragment key={i}>
          <span data-word="">{word}</span>
          {i < words.length - 1 && " "}
        </Fragment>
      ))}
    </p>
  );
}
