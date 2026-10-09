/**
 * Image sequences played by scrolling (see components/scroll-video). Generated from a video
 * by scripts/extract-frames.sh, which also writes the matching FrameSequence manifest.
 */

/** "portrait" is a centered crop for screens taller than wide; "landscape" the full frame. */
export type FrameSetName = "landscape" | "portrait";

export interface FrameSize {
  width: number;
  height: number;
}

export interface FrameSequence {
  /** Public path of the sequence, e.g. "/frames/hero-1a2b3c4d". */
  basePath: string;
  count: number;
  sets: Record<FrameSetName, FrameSize>;
}

export function pickFrameSet(viewportWidth: number, viewportHeight: number): FrameSetName {
  return viewportWidth < viewportHeight ? "portrait" : "landscape";
}

export function frameUrl(sequence: FrameSequence, set: FrameSetName, index: number): string {
  return `${sequence.basePath}/${set}/frame_${String(index + 1).padStart(4, "0")}.webp`;
}

export function frameUrls(sequence: FrameSequence, set: FrameSetName): string[] {
  return Array.from({ length: sequence.count }, (_, i) => frameUrl(sequence, set, i));
}

/** The frame shown at a scroll progress between 0 and 1. */
export function frameAt(progress: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(progress * (count - 1))));
}

/**
 * Coarse-to-fine load order: first and last frame, then midpoints of ever smaller gaps. A
 * partially loaded sequence then covers the whole timeline evenly instead of only its start.
 */
export function loadOrder(count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [0];
  const order = [0, count - 1];
  const seen = new Set(order);
  let gaps: [number, number][] = [[0, count - 1]];
  while (gaps.length > 0) {
    const next: [number, number][] = [];
    for (const [a, b] of gaps) {
      if (b - a < 2) continue;
      const mid = Math.floor((a + b) / 2);
      if (!seen.has(mid)) {
        seen.add(mid);
        order.push(mid);
      }
      next.push([a, mid], [mid, b]);
    }
    gaps = next;
  }
  return order;
}

/** The loaded frame closest to index, preferring earlier frames on ties; null if none. */
export function nearestLoaded<T>(frames: readonly (T | null)[], index: number): T | null {
  for (let d = 0; d < frames.length; d++) {
    const before = frames[index - d];
    if (before) return before;
    const after = frames[index + d];
    if (after) return after;
  }
  return null;
}
