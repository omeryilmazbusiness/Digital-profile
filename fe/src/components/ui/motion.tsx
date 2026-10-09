import type * as React from "react";

import { cn } from "@/lib/utils";

type Effect = "up" | "fade" | "scale";

interface MotionProps {
  /** Element to render; defaults to a div. */
  as?: React.ElementType;
  effect?: Effect;
  className?: string;
  children: React.ReactNode;
}

/**
 * Animates its content in as it scrolls into view. Pure CSS (scroll-driven animations): no
 * JavaScript, no hydration cost. Browsers without support, and users who prefer reduced
 * motion, simply see the content.
 */
export function Reveal({ as: Comp = "div", effect = "up", className, children }: MotionProps) {
  return (
    <Comp data-reveal={effect} className={cn("reveal", className)}>
      {children}
    </Comp>
  );
}

/**
 * Plays once on first paint, e.g. the hero's intro; stagger siblings with `delay`. Skipped
 * entirely under reduced motion.
 */
export function Entrance({
  as: Comp = "div",
  effect = "up",
  delay = 0,
  className,
  children,
}: MotionProps & { delay?: number }) {
  return (
    <Comp
      data-entrance={effect}
      className={cn("entrance", className)}
      style={delay ? ({ "--entrance-delay": `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </Comp>
  );
}
