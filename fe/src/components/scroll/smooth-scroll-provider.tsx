"use client";

import Lenis, { type LenisOptions } from "lenis";
import "lenis/dist/lenis.css";
import { createContext, useContext, useEffect, useState } from "react";
import type * as React from "react";

import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { ScrollController } from "@/lib/scroll-controller";

const fallback = new ScrollController();
const ScrollControllerContext = createContext<ScrollController>(fallback);

/** The page's scroll controller; works outside a provider too (native scrolling only). */
export function useScrollController(): ScrollController {
  return useContext(ScrollControllerContext);
}

/** Locks page scrolling while `locked` is true. */
export function useScrollLock(locked: boolean): void {
  const controller = useScrollController();
  useEffect(() => (locked ? controller.lock() : undefined), [controller, locked]);
}

interface SmoothScrollProviderProps {
  children: React.ReactNode;
  options?: Omit<LenisOptions, "autoRaf">;
}

/**
 * Inertial smooth scrolling (Lenis) driven by GSAP's ticker, so ScrollTrigger animations and
 * the scroll position update in the same frame. Disabled for users who prefer reduced motion:
 * they keep native scrolling.
 */
export function SmoothScrollProvider({ children, options }: SmoothScrollProviderProps) {
  const reducedMotion = useReducedMotion();
  const [controller] = useState(() => new ScrollController());

  useEffect(() => {
    if (reducedMotion) return;
    const lenis = new Lenis({ lerp: 0.1, ...options, autoRaf: false });
    const detach = controller.attach(lenis);
    const offScroll = lenis.on("scroll", ScrollTrigger.update);
    const tick = (seconds: number) => lenis.raf(seconds * 1000);
    gsap.ticker.add(tick);
    // Lenis already smooths; GSAP's lag compensation would make scrubbed animations jump.
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);
      offScroll();
      detach();
      lenis.destroy();
    };
  }, [controller, options, reducedMotion]);

  return <ScrollControllerContext value={controller}>{children}</ScrollControllerContext>;
}
