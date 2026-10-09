"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/** Matches the fade-out duration below. */
const EXIT_MS = 700;

interface FrameLoaderProps {
  /** 0–100. */
  progress: number;
  done: boolean;
  /** Shown above the bar, e.g. the brand name. */
  title: string;
  /** Accessible name of the progress bar. */
  label?: string;
}

/**
 * Full-screen loading curtain with a thin progress bar. When done it fades out, then
 * unmounts so it never intercepts input.
 */
export function FrameLoader({ progress, done, title, label = "Loading" }: FrameLoaderProps) {
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
        "fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-black px-8 text-white",
        "transition-opacity duration-700 ease-(--ease-ios)",
        done && "pointer-events-none opacity-0",
      )}
    >
      <p className="text-center text-footnote font-medium tracking-[0.3em] text-white/70 uppercase">
        {title}
      </p>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        className="h-px w-48 overflow-hidden bg-white/15"
      >
        <div
          className="h-full origin-left bg-white transition-transform duration-300 ease-out rtl:origin-right"
          style={{ transform: `scaleX(${value / 100})` }}
        />
      </div>
      <p className="font-mono text-caption-1 text-white/60 tabular-nums" aria-hidden>
        {value}%
      </p>
      {/* Without JavaScript the sequence never loads; show the page underneath instead. */}
      <noscript>
        <style>{"[data-frame-loader]{display:none}"}</style>
      </noscript>
    </div>
  );
}
