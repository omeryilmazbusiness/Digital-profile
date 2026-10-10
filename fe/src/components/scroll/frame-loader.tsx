"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/** Matches the fade-out duration below. */
const EXIT_MS = 700;

interface FrameLoaderProps {
  /** 0–100. */
  progress: number;
  done: boolean;
  /** Accessible name of the progress bar. */
  label?: string;
}

/**
 * A hairline progress bar with its percentage, at the foot of the screen, so whatever the
 * opening shows stays in view while frames load. Fades out when done, then unmounts.
 */
export function FrameLoader({ progress, done, label = "Loading" }: FrameLoaderProps) {
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (!done) return;
    const id = window.setTimeout(() => setGone(true), EXIT_MS);
    return () => window.clearTimeout(id);
  }, [done]);

  if (done && gone) return null;
  const value = Math.min(100, Math.max(0, Math.round(progress)));

  return (
    <div
      data-frame-loader=""
      aria-hidden={done || undefined}
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-50 flex items-center justify-center gap-4 pb-safe-8 text-white",
        "transition-opacity duration-700 ease-(--ease-ios)",
        done && "opacity-0",
      )}
    >
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        className="h-px w-32 overflow-hidden bg-white/20"
      >
        <div
          className="h-full origin-left bg-white/90 transition-transform duration-300 ease-out rtl:origin-right"
          style={{ transform: `scaleX(${value / 100})` }}
        />
      </div>
      <p className="w-9 font-mono text-caption-2 text-white/60 tabular-nums" aria-hidden>
        {value}%
      </p>
      {/* Without JavaScript the sequence never loads; don't promise that it will. */}
      <noscript>
        <style>{"[data-frame-loader]{display:none}"}</style>
      </noscript>
    </div>
  );
}
