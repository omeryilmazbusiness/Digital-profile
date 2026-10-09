import type * as React from "react";

import { cn } from "@/lib/utils";

/** Placeholder for loading content. The shimmer stops under reduced motion. */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden
      data-slot="skeleton"
      className={cn(
        "animate-shimmer rounded-sm bg-fill-tertiary bg-[length:200%_100%]",
        "bg-[linear-gradient(100deg,transparent_30%,var(--fill-quaternary)_50%,transparent_70%)]",
        className,
      )}
      {...props}
    />
  );
}

/** Lines of text-height skeletons; the last one is shorter, like a paragraph end. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("grid gap-2", className)} aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className={cn("h-3.5", i === lines - 1 && lines > 1 ? "w-3/5" : "w-full")}
        />
      ))}
    </div>
  );
}
