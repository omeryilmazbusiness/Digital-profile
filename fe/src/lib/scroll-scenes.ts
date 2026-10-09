/** A text overlay shown during part of a scroll-driven sequence. */
export interface SceneTiming {
  /** Scroll progress (0–1) at which the scene is fully visible… */
  start: number;
  /** …and until which it stays visible. */
  end: number;
}

export interface Fade {
  /** Timeline position (0–1) where the fade begins. */
  at: number;
  duration: number;
}

export interface SceneKeyframes {
  /** Null when the scene starts at 0: it is visible on arrival. */
  fadeIn: Fade | null;
  /** Null when the scene lasts until 1: it stays as the section unpins. */
  fadeOut: Fade | null;
}

/** Default fade length, as a share of the whole sequence. */
export const DEFAULT_FADE = 0.06;

/**
 * Where a scene fades in and out on a timeline of length 1. Fades happen just outside the
 * [start, end] window so the scene is fully readable for all of it; they shrink to fit when
 * the window sits close to either end.
 */
export function sceneKeyframes(scene: SceneTiming, fade = DEFAULT_FADE): SceneKeyframes {
  if (!(scene.start >= 0 && scene.end <= 1 && scene.start < scene.end)) {
    throw new RangeError(`invalid scene window [${scene.start}, ${scene.end}]`);
  }
  const inDuration = Math.min(fade, scene.start);
  const outDuration = Math.min(fade, 1 - scene.end);
  return {
    fadeIn: inDuration > 0 ? { at: scene.start - inDuration, duration: inDuration } : null,
    fadeOut: outDuration > 0 ? { at: scene.end, duration: outDuration } : null,
  };
}
