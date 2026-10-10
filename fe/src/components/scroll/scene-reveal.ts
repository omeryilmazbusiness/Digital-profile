import type { gsap } from "gsap";

import type { SceneKeyframes, SceneTiming } from "@/lib/scroll-scenes";

/**
 * Markers a scene's content uses to take part in its entrance and exit. Without them the
 * scene simply fades with its overlay.
 */
export const sceneReveal = {
  /** A word that rises out of a mask (wrap it in an overflow-hidden inline box). */
  word: "data-scene-word",
  /** A block that sharpens into view: eyebrow, paragraph, button row. */
  item: "data-scene-item",
  /** A hairline that draws itself from its start edge. */
  line: "data-scene-line",
} as const;

const select = (root: HTMLElement, marker: string) =>
  Array.from(root.querySelectorAll<HTMLElement>(`[${marker}]`));

/**
 * Adds a scene's choreography to a scrubbed timeline of length 1: hairlines draw, words rise
 * one by one, blocks come into focus, all while the overlay fades in; on the way out the words
 * lift away first. Scrubbing backwards plays it in reverse.
 */
export function addSceneReveal(
  timeline: gsap.core.Timeline,
  overlay: HTMLElement,
  scene: SceneTiming,
  { fadeIn, fadeOut }: SceneKeyframes,
): void {
  const words = select(overlay, sceneReveal.word);
  const items = select(overlay, sceneReveal.item);
  const lines = select(overlay, sceneReveal.line);
  if (words.length + items.length + lines.length === 0) return;

  const hold = scene.end - scene.start;

  if (fadeIn) {
    // The entrance runs a little past the fade, into the readable window.
    const at = fadeIn.at;
    const span = fadeIn.duration + Math.min(0.05, hold * 0.25);
    timeline.fromTo(
      items,
      { autoAlpha: 0, y: 18, filter: "blur(8px)" },
      {
        autoAlpha: 1,
        y: 0,
        filter: "blur(0px)",
        duration: span * 0.45,
        stagger: { amount: span * 0.5 },
        ease: "power2.out",
      },
      at,
    );
    timeline.fromTo(
      lines,
      { scaleX: 0 },
      { scaleX: 1, duration: span * 0.55, ease: "power2.inOut" },
      at + span * 0.08,
    );
    timeline.fromTo(
      words,
      { yPercent: 115, autoAlpha: 0 },
      {
        yPercent: 0,
        autoAlpha: 1,
        duration: span * 0.5,
        stagger: { amount: span * 0.4 },
        ease: "power3.out",
      },
      at + span * 0.12,
    );
  }

  if (fadeOut) {
    // Leaves slightly before the overlay fades, so the motion is seen.
    const at = fadeOut.at - Math.min(0.03, hold * 0.15);
    const span = fadeOut.at + fadeOut.duration - at;
    timeline.to(
      words,
      {
        yPercent: -115,
        autoAlpha: 0,
        duration: span * 0.6,
        stagger: { amount: span * 0.3 },
        ease: "power2.in",
      },
      at,
    );
    timeline.to(
      [...items, ...lines],
      { autoAlpha: 0, y: -12, filter: "blur(6px)", duration: span * 0.6, ease: "power2.in" },
      at + span * 0.15,
    );
  }
}
