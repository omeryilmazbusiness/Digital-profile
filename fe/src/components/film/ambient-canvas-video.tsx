"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type * as React from "react";

import { FrameLoader } from "@/components/scroll/frame-loader";
import { useFramePreloader } from "@/hooks/use-frame-preloader";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useSaveData } from "@/hooks/use-save-data";
import { CanvasFrameRenderer } from "@/lib/canvas-frame-renderer";
import { AMBIENT_DURATION_MS, pingPongFrame } from "@/lib/frame-playback";
import {
  frameUrl,
  frameUrls,
  pickFrameSet,
  type FrameSequence,
  type FrameSetName,
} from "@/lib/frame-sequence";
import { cn } from "@/lib/utils";

export interface AmbientCanvasVideoProps {
  sequence: FrameSequence;
  /** Describes the footage for screen readers; ignored when decorative. */
  label: string;
  loadingLabel?: string;
  /** One-way duration of the ping-pong loop. */
  durationMs?: number;
  posterFrame?: number;
  /** Hide the film from assistive tech: atmosphere, not content. */
  decorative?: boolean;
  className?: string;
}

/**
 * The hotel's image sequence as a full-bleed, blurred, self-playing loop. Reduced motion and
 * data saver get a still of the same crop. Playback starts as soon as any frame has landed
 * (gaps use the nearest loaded frame) and pauses while the tab is hidden.
 */
export function AmbientCanvasVideo(props: AmbientCanvasVideoProps) {
  const hydrated = useHydrated();
  const reducedMotion = useReducedMotion();
  const saveData = useSaveData();
  // Mount the player only on the client so the frame set is chosen once, with a real viewport.
  if (!hydrated) return <div className={cn("absolute inset-0 bg-black", props.className)} />;
  return reducedMotion || saveData ? <StillFilm {...props} /> : <LoopingFilm {...props} />;
}

const noopSubscribe = () => () => {};

function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

function LoopingFilm({
  sequence,
  label,
  loadingLabel,
  durationMs = AMBIENT_DURATION_MS,
  decorative = false,
  className,
}: AmbientCanvasVideoProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [set] = useState<FrameSetName>(() => pickFrameSet(window.innerWidth, window.innerHeight));
  const urls = useMemo(() => frameUrls(sequence, set), [sequence, set]);
  const { frames, loadingProgress, isLoaded } = useFramePreloader(urls);
  const ready = loadingProgress > 0;

  useEffect(() => {
    const el = canvas.current;
    if (!ready || !el) return;

    const renderer = new CanvasFrameRenderer(el, () => frames.current);
    const resize = () =>
      renderer.resize(el.clientWidth, el.clientHeight, Math.min(window.devicePixelRatio || 1, 2));
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();

    let raf = 0;
    let elapsed = 0;
    let last = performance.now();
    let painted = -1;

    const tick = (now: number) => {
      if (!document.hidden) {
        elapsed += now - last;
        const index = pingPongFrame(elapsed, sequence.count, durationMs);
        if (index !== painted) {
          painted = index;
          renderer.setFrame(index);
        }
      }
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [ready, sequence, durationMs, frames]);

  return (
    <div className={cn("absolute inset-0 bg-black", className)}>
      <BlurredPlate decorative={decorative}>
        <canvas
          ref={canvas}
          role={decorative ? undefined : "img"}
          aria-label={decorative ? undefined : label}
          aria-hidden={decorative || undefined}
          className={cn(
            "absolute inset-0 size-full transition-opacity duration-1000 ease-(--ease-ios)",
            !ready && "opacity-0",
          )}
        />
      </BlurredPlate>
      <FrameLoader progress={loadingProgress} done={ready && isLoaded} label={loadingLabel} />
    </div>
  );
}

function StillFilm({
  sequence,
  label,
  posterFrame = 0,
  decorative = false,
  className,
}: AmbientCanvasVideoProps) {
  const index = Math.min(Math.max(0, posterFrame), sequence.count - 1);
  return (
    <div className={cn("absolute inset-0 bg-black", className)}>
      <BlurredPlate decorative={decorative}>
        <picture className="block size-full">
          <source media="(orientation: portrait)" srcSet={frameUrl(sequence, "portrait", index)} />
          <img
            src={frameUrl(sequence, "landscape", index)}
            alt={decorative ? "" : label}
            width={sequence.sets.landscape.width}
            height={sequence.sets.landscape.height}
            fetchPriority="high"
            className="size-full object-cover"
          />
        </picture>
      </BlurredPlate>
    </div>
  );
}

/** Blur plus a dark vignette so type on top stays legible and the smear at the edges is cropped. */
function BlurredPlate({
  decorative,
  children,
}: {
  decorative: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden={decorative || undefined}>
      <div className="absolute inset-0 scale-[1.18] blur-[36px] contrast-[1.04] saturate-[1.12]">
        {children}
      </div>
      <div className="absolute inset-0 bg-black/48" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgb(0_0_0/0.28)_52%,rgb(0_0_0/0.78)_100%)]" />
      <div className="absolute inset-0 bg-linear-to-b from-black/60 via-transparent via-45% to-black/70" />
    </div>
  );
}
