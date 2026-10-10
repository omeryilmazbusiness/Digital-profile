"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type * as React from "react";

import { useFramePreloader } from "@/hooks/use-frame-preloader";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useSaveData } from "@/hooks/use-save-data";
import { CanvasFrameRenderer, type Focus } from "@/lib/canvas-frame-renderer";
import {
  frameAt,
  frameUrl,
  frameUrls,
  pickFrameSet,
  type FrameSequence,
  type FrameSetName,
} from "@/lib/frame-sequence";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { sceneKeyframes, type SceneTiming } from "@/lib/scroll-scenes";
import { cn } from "@/lib/utils";

import { FrameLoader } from "./frame-loader";
import { addSceneReveal } from "./scene-reveal";
import { useScrollLock } from "./smooth-scroll-provider";

export interface Scene extends SceneTiming {
  id: string;
  content: React.ReactNode;
  /** Vertical placement of the content; defaults to "end" (bottom). */
  align?: "start" | "center" | "end";
}

export interface ScrollCanvasVideoProps {
  sequence: FrameSequence;
  scenes: readonly Scene[];
  /** Describes the footage for screen readers. */
  label: string;
  /** Scroll distance the sequence plays over, in viewport heights. */
  length?: number;
  /** Seconds the playhead takes to catch up with the scrollbar; true follows it exactly. */
  scrub?: number | true;
  focus?: Focus;
  /** Frame shown instead of the sequence under reduced motion or data saver. */
  posterFrame?: number;
  className?: string;
}

const alignClass = { start: "items-start", center: "items-center", end: "items-end" } as const;
const SCENE_SHIFT = 32;

/**
 * A full-screen image sequence that plays as the page scrolls: the section pins while the
 * scroll distance (`length` viewports) maps onto the frames, and scene overlays fade in and
 * out at their windows. Frames preload first, with scrolling locked so scrubbing is instant:
 * meanwhile the section stays black with the opening scenes on it and a progress bar at the
 * foot, and the footage fades in once ready.
 *
 * Users who prefer reduced motion or save data get a still poster with the scenes as
 * ordinary sections instead, and nothing beyond the poster is downloaded.
 */
export function ScrollCanvasVideo(props: ScrollCanvasVideoProps) {
  const hydrated = useHydrated();
  const reducedMotion = useReducedMotion();
  const saveData = useSaveData();
  // The server cannot know the preferences: it renders the loading state, which both
  // variants start from, rather than flashing the still version at everyone.
  const still = hydrated && (reducedMotion || saveData);
  return still ? <StillSequence {...props} /> : <ScrubbedSequence {...props} active={hydrated} />;
}

const noopSubscribe = () => () => {};

function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

function ScrubbedSequence({
  sequence,
  scenes,
  label,
  length = 4,
  scrub = 0.5,
  focus,
  className,
  active,
}: ScrollCanvasVideoProps & { active: boolean }) {
  const root = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const arrived = useRef(false);
  // Chosen once: switching sets on rotation would reload every frame mid-scroll; cover
  // cropping keeps either set filling the screen.
  const [set] = useState<FrameSetName | null>(() =>
    typeof window === "undefined" ? null : pickFrameSet(window.innerWidth, window.innerHeight),
  );
  const urls = useMemo(() => (set ? frameUrls(sequence, set) : []), [sequence, set]);
  const { frames, loadingProgress, isLoaded } = useFramePreloader(urls, {
    enabled: active && set !== null,
  });
  const ready = active && set !== null && isLoaded;
  useScrollLock(!ready);
  useOpenAtTop();

  useGSAP(
    () => {
      const section = root.current;
      const el = canvas.current;
      if (!ready || !section || !el) return;

      const renderer = new CanvasFrameRenderer(el, () => frames.current, focus);
      const resize = () =>
        renderer.resize(el.clientWidth, el.clientHeight, window.devicePixelRatio);
      const observer = new ResizeObserver(resize);
      observer.observe(el);
      resize();

      const playhead = { progress: 0 };
      const timeline = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: `+=${length * 100}%`,
          pin: true,
          anticipatePin: 1,
          scrub,
          invalidateOnRefresh: true,
        },
      });
      timeline.to(
        playhead,
        {
          progress: 1,
          duration: 1,
          onUpdate: () => renderer.setFrame(frameAt(playhead.progress, sequence.count)),
        },
        0,
      );

      const overlays = gsap.utils.toArray<HTMLElement>("[data-scene]", section);
      scenes.forEach((scene, i) => {
        const overlay = overlays[i];
        if (!overlay) return;
        const keyframes = sceneKeyframes(scene);
        const { fadeIn, fadeOut } = keyframes;
        gsap.set(overlay, { autoAlpha: fadeIn ? 0 : 1, y: fadeIn ? SCENE_SHIFT : 0 });
        if (fadeIn) {
          timeline.to(
            overlay,
            { autoAlpha: 1, y: 0, duration: fadeIn.duration, ease: "power2.out" },
            fadeIn.at,
          );
        }
        if (fadeOut) {
          timeline.to(
            overlay,
            { autoAlpha: 0, y: -SCENE_SHIFT, duration: fadeOut.duration, ease: "power2.in" },
            fadeOut.at,
          );
        }
        addSceneReveal(timeline, overlay, scene, keyframes);
      });
      // A timeline shorter than 1 would compress the scroll mapping.
      if (timeline.duration() < 1) timeline.set({}, {}, 1);

      // Pinning added spacing below the section: positions of later triggers changed.
      ScrollTrigger.refresh();
      // A link into the page (/#tour from another page) was resolved before that spacing
      // existed. Wait a frame for the loading scroll lock to be released.
      let frame = 0;
      if (!arrived.current && location.hash) {
        const id = decodeURIComponent(location.hash.slice(1));
        frame = requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
      }
      arrived.current = true;
      return () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
      };
    },
    {
      scope: root,
      dependencies: [ready, sequence, scenes, length, scrub, focus],
      revertOnUpdate: true,
    },
  );

  return (
    <>
      <section
        ref={root}
        aria-label={label}
        className={cn("relative h-dvh w-full overflow-hidden bg-black", className)}
      >
        <canvas
          ref={canvas}
          role="img"
          aria-label={label}
          className={cn(
            "absolute inset-0 size-full transition-opacity duration-1000 ease-(--ease-ios)",
            !ready && "opacity-0",
          )}
        />
        <Scrim />
        {scenes.map((scene) => (
          <div
            key={scene.id}
            data-scene={scene.id}
            className={cn(
              "absolute inset-0 flex justify-center px-safe-5 pt-safe-20 pb-safe-12 sm:px-safe-10",
              alignClass[scene.align ?? "end"],
            )}
            // Until the timeline takes over, only scenes visible on arrival show.
            style={scene.start > 0 ? { opacity: 0, visibility: "hidden" } : undefined}
          >
            {scene.content}
          </div>
        ))}
      </section>
      <FrameLoader progress={loadingProgress} done={ready} />
    </>
  );
}

/**
 * The sequence plays from the top: a restored mid-page position would open on a half-faded
 * scene while the page is still locked for loading. Links to a section keep their target.
 */
function useOpenAtTop() {
  useEffect(() => {
    if (location.hash) return;
    const previous = history.scrollRestoration;
    history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    return () => {
      history.scrollRestoration = previous;
    };
  }, []);
}

function StillSequence({
  sequence,
  scenes,
  label,
  posterFrame = 0,
  className,
}: ScrollCanvasVideoProps) {
  const index = Math.min(Math.max(0, posterFrame), sequence.count - 1);
  return (
    <section aria-label={label} className={cn("relative bg-black", className)}>
      <div className="sticky top-0 h-dvh w-full overflow-hidden">
        <picture>
          <source media="(orientation: portrait)" srcSet={frameUrl(sequence, "portrait", index)} />
          <img
            src={frameUrl(sequence, "landscape", index)}
            alt={label}
            width={sequence.sets.landscape.width}
            height={sequence.sets.landscape.height}
            fetchPriority="high"
            className="size-full object-cover"
          />
        </picture>
        <Scrim />
      </div>
      <div className="relative -mt-[100dvh]">
        {scenes.map((scene) => (
          <div
            key={scene.id}
            className={cn(
              "flex min-h-dvh justify-center px-safe-5 pt-safe-20 pb-safe-12 sm:px-safe-10",
              alignClass[scene.align ?? "end"],
            )}
          >
            {scene.content}
          </div>
        ))}
      </div>
    </section>
  );
}

/** Darkens the top and bottom edges so status bar and text stay legible on bright footage. */
function Scrim() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 bg-linear-to-b from-black/45 via-transparent via-40% to-black/60"
    />
  );
}
