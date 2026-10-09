import type * as React from "react";

import { cn } from "@/lib/utils";

interface SceneCardProps {
  eyebrow?: string;
  title: string;
  /** Heading level of the title; use 1 for the scene that carries the page title. */
  level?: 1 | 2 | 3;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Glass text card for scroll-video scenes. Always dark: it sits on footage, whatever the
 * site's color scheme.
 */
export function SceneCard({ eyebrow, title, level = 2, children, className }: SceneCardProps) {
  const Heading = `h${level}` as const;
  return (
    <div
      className={cn(
        "w-full max-w-xl rounded-[28px] border border-white/15 material-dark p-6 text-white shadow-2xl shadow-black/30 sm:p-8",
        className,
      )}
    >
      {eyebrow && (
        <p className="mb-3 text-caption-1 font-semibold tracking-[0.24em] text-white/70 uppercase">
          {eyebrow}
        </p>
      )}
      <Heading className="text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
        {title}
      </Heading>
      {children && (
        <div className="mt-4 text-body text-pretty text-white/80 sm:text-lg">{children}</div>
      )}
    </div>
  );
}
