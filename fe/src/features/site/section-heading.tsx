import type * as React from "react";

import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  /** Id of the heading, for the section's aria-labelledby. */
  id: string;
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
  className?: string;
}

/** Eyebrow, large title and lead paragraph that open a page section. */
export function SectionHeading({ id, eyebrow, title, children, className }: SectionHeadingProps) {
  return (
    <div className={cn("max-w-2xl", className)}>
      <p className="flex items-center gap-3 text-caption-1 font-semibold tracking-[0.24em] text-gold uppercase">
        <span aria-hidden className="h-px w-8 bg-current opacity-50" />
        {eyebrow}
      </p>
      <h2
        id={id}
        className="mt-5 text-[2rem] leading-[1.1] font-semibold tracking-tight text-balance md:text-5xl"
      >
        {title}
      </h2>
      {children && (
        <div className="mt-5 text-body text-pretty text-label-secondary md:text-title-3 md:font-normal">
          {children}
        </div>
      )}
    </div>
  );
}
