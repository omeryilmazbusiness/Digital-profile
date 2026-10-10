"use client";

import { useRef } from "react";
import type * as React from "react";

import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";

/** Marks an element inside <RiseGroup> to rise into place as it scrolls into view. */
export const rise = { "data-rise": "" } as const;

/**
 * Marks a rule inside <RiseGroup> to draw across, from its start edge, as it scrolls into
 * view. Give it its origin (e.g. `origin-left rtl:origin-right`).
 */
export const draw = { "data-draw": "" } as const;

/**
 * Elements marked with `rise` come up out of a soft blur as they enter the viewport, a few at
 * a time; cards with `shadow-lift` settle onto the page as their shadow deepens. Rules marked
 * with `draw` extend across. Each plays once. Without scripts, or with reduced motion,
 * everything is simply there.
 */
export function RiseGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useGSAP(
    () => {
      if (!root.current || reducedMotion) return;
      const items = gsap.utils.toArray<HTMLElement>("[data-rise]", root.current);
      const rules = gsap.utils.toArray<HTMLElement>("[data-draw]", root.current);
      const lifted = (el: Element) => el.classList.contains("shadow-lift");
      gsap.set(items, { autoAlpha: 0, y: 56 });
      gsap.set(items.filter(lifted), { "--lift": 0 });
      gsap.set(rules, { scaleX: 0 });

      ScrollTrigger.batch(items, {
        start: "top 90%",
        once: true,
        onEnter: (batch) => {
          gsap.fromTo(
            batch,
            { autoAlpha: 0, y: 56, scale: 0.97, filter: "blur(10px)" },
            {
              autoAlpha: 1,
              y: 0,
              scale: 1,
              filter: "blur(0px)",
              duration: 1.1,
              ease: "expo.out",
              stagger: 0.09,
              clearProps: "filter,transform",
            },
          );
          gsap.to(batch.filter(lifted), {
            "--lift": 1,
            duration: 1.4,
            delay: 0.15,
            ease: "power2.out",
            stagger: 0.09,
          });
        },
      });

      ScrollTrigger.batch(rules, {
        start: "top 92%",
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, {
            scaleX: 1,
            duration: 1.6,
            ease: "expo.inOut",
            stagger: 0.12,
            clearProps: "transform",
          }),
      });
    },
    { scope: root, dependencies: [reducedMotion], revertOnUpdate: true },
  );

  return (
    <div ref={root} className={className}>
      {children}
    </div>
  );
}
