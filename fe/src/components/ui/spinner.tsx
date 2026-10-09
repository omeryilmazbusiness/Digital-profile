import type * as React from "react";

import { cn } from "@/lib/utils";

const SPOKES = 8;

const sizes = {
  sm: "size-4",
  md: "size-5",
  lg: "size-8",
} as const;

export interface SpinnerProps extends Omit<React.ComponentProps<"span">, "children"> {
  size?: keyof typeof sizes;
  /** Announced to assistive technology; null when a parent already conveys the busy state. */
  label?: string | null;
}

/** iOS activity indicator. It keeps spinning under reduced motion: it conveys state. */
export function Spinner({ size = "md", label = "Loading", className, ...props }: SpinnerProps) {
  const a11y = label === null ? { "aria-hidden": true } : { role: "status", "aria-label": label };
  return (
    <span
      data-slot="spinner"
      data-motion="essential"
      className={cn("relative inline-block shrink-0", sizes[size], className)}
      {...a11y}
      {...props}
    >
      {Array.from({ length: SPOKES }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className="absolute inset-0 animate-spinner-fade"
          style={{
            transform: `rotate(${(360 / SPOKES) * i}deg)`,
            animationDelay: `${(i - SPOKES) / SPOKES}s`,
          }}
        >
          <span className="absolute top-0 left-1/2 h-[28%] w-[10%] -translate-x-1/2 rounded-full bg-current" />
        </span>
      ))}
    </span>
  );
}
