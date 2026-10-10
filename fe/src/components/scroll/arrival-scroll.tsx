"use client";

import { useEffect } from "react";

import { arrivalTarget } from "@/lib/arrival";
import { ScrollTrigger } from "@/lib/gsap";

/**
 * Opens the landing page at the section the URL names (/#tour, /momen). Runs once the page's
 * pinned sections exist, and again when images and fonts have loaded — they can move the
 * target — unless the visitor has started scrolling by then.
 */
export function ArrivalScroll() {
  useEffect(() => {
    if (!arrivalTarget()) return;
    let touched = false;
    const touch = () => {
      touched = true;
    };
    const jump = () => {
      if (touched) return;
      ScrollTrigger.refresh();
      arrivalTarget()?.scrollIntoView({ behavior: "instant", block: "start" });
    };
    const events = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
    for (const type of events) window.addEventListener(type, touch, { once: true, passive: true });
    jump();
    const onLoad = () => requestAnimationFrame(jump);
    if (document.readyState !== "complete") window.addEventListener("load", onLoad, { once: true });
    return () => {
      for (const type of events) window.removeEventListener(type, touch);
      window.removeEventListener("load", onLoad);
    };
  }, []);

  return null;
}
