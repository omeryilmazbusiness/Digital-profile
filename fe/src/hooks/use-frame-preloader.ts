"use client";

import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

import { loadOrder } from "@/lib/frame-sequence";

export interface FramePreloader {
  /**
   * Decoded images by frame index; null until loaded (or when loading failed). Mutated in
   * place as frames arrive, so drawing code reads it without re-rendering.
   */
  frames: RefObject<(HTMLImageElement | null)[]>;
  /** 0–100, counting failed frames as settled so progress always completes. */
  loadingProgress: number;
  isLoaded: boolean;
  failed: number;
}

interface Options {
  /** Parallel requests. HTTP/2 multiplexes them; this bounds decoding work and memory spikes. */
  concurrency?: number;
  enabled?: boolean;
}

interface Progress {
  urls: readonly string[] | null;
  settled: number;
  failed: number;
}

/**
 * Downloads and decodes every frame of a sequence up front, so scrubbing never waits on the
 * network or shows a blank frame. Frames load coarse-to-fine (see loadOrder): any prefix of
 * the work already spans the whole sequence. Unmounting or changing urls cancels pending
 * requests. Pass a stable urls array: a new array restarts loading.
 */
export function useFramePreloader(
  urls: readonly string[],
  { concurrency = 6, enabled = true }: Options = {},
): FramePreloader {
  const frames = useRef<(HTMLImageElement | null)[]>([]);
  const [progress, setProgress] = useState<Progress>({ urls: null, settled: 0, failed: 0 });

  useEffect(() => {
    if (!enabled || urls.length === 0) return;
    const images: (HTMLImageElement | null)[] = Array.from({ length: urls.length }, () => null);
    frames.current = images;
    const queue = loadOrder(urls.length);
    const inFlight = new Set<HTMLImageElement>();
    let cancelled = false;
    let settled = 0;
    let failed = 0;

    const report = () => setProgress({ urls, settled, failed });

    const worker = async () => {
      for (let index = queue.shift(); index !== undefined; index = queue.shift()) {
        const img = new Image();
        img.decoding = "async";
        inFlight.add(img);
        const ok = await load(img, urls[index]);
        inFlight.delete(img);
        if (cancelled) return;
        if (ok) images[index] = img;
        else failed++;
        settled++;
        report();
      }
    };
    for (let i = 0; i < Math.min(concurrency, urls.length); i++) void worker();

    return () => {
      cancelled = true;
      // Clearing src aborts the request.
      for (const img of inFlight) img.src = "";
      inFlight.clear();
    };
  }, [urls, concurrency, enabled]);

  const current = progress.urls === urls && enabled;
  const settled = current ? progress.settled : 0;
  const total = urls.length;
  return {
    frames,
    // Disabled (as during server rendering) reads 0, so server and client markup agree.
    loadingProgress: !enabled ? 0 : total === 0 ? 100 : Math.round((settled / total) * 100),
    isLoaded: enabled && settled === total,
    failed: current ? progress.failed : 0,
  };
}

async function load(img: HTMLImageElement, url: string): Promise<boolean> {
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`failed to load ${url}`));
      img.src = url;
    });
    // Decode off the main thread now rather than on first draw, which would stutter.
    await img.decode?.().catch(() => undefined);
    return true;
  } catch {
    return false;
  } finally {
    img.onload = img.onerror = null;
  }
}
