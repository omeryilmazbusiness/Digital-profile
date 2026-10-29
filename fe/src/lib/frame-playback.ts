import { frameAt } from "./frame-sequence";

/** One-way duration of the ambient lobby loop, in milliseconds. */
export const AMBIENT_DURATION_MS = 20_000;

/**
 * Maps elapsed time onto a frame index that walks the sequence forward, then back, forever.
 * Ping-pong avoids a jump cut at the loop point of a one-way walk.
 */
export function pingPongFrame(elapsedMs: number, count: number, durationMs: number): number {
  if (count <= 1 || durationMs <= 0) return 0;
  const period = durationMs * 2;
  const t = ((elapsedMs % period) + period) % period;
  const progress = t < durationMs ? t / durationMs : 2 - t / durationMs;
  return frameAt(progress, count);
}
