import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { useFramePreloader } from "./use-frame-preloader";

/** Loads succeed asynchronously unless the URL contains "broken"; records every request. */
class FakeImage {
  static requested: string[] = [];
  static aborted = 0;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  decoding = "auto";
  private _src = "";

  get src() {
    return this._src;
  }
  set src(url: string) {
    if (url === "") {
      FakeImage.aborted++;
      this._src = url;
      return;
    }
    this._src = url;
    FakeImage.requested.push(url);
    setTimeout(() => (url.includes("broken") ? this.onerror?.() : this.onload?.()), 0);
  }
  decode() {
    return Promise.resolve();
  }
}

beforeEach(() => {
  FakeImage.requested = [];
  FakeImage.aborted = 0;
  vi.stubGlobal("Image", FakeImage);
});
afterEach(() => vi.unstubAllGlobals());

const urls = (n: number, broken: number[] = []) =>
  Array.from({ length: n }, (_, i) => (broken.includes(i) ? `/f/broken_${i}` : `/f/${i}`));

test("loads every frame, coarse-to-fine, and reports progress", async () => {
  const list = urls(5);
  const { result } = renderHook(() => useFramePreloader(list, { concurrency: 1 }));
  expect(result.current.isLoaded).toBe(false);
  expect(result.current.loadingProgress).toBe(0);

  await waitFor(() => expect(result.current.isLoaded).toBe(true));
  expect(result.current.loadingProgress).toBe(100);
  expect(result.current.failed).toBe(0);
  expect(FakeImage.requested).toEqual(["/f/0", "/f/4", "/f/2", "/f/1", "/f/3"]);
  expect(result.current.frames.current.every((img) => img !== null)).toBe(true);
});

test("failed frames count as settled and stay empty", async () => {
  const list = urls(4, [2]);
  const { result } = renderHook(() => useFramePreloader(list));
  await waitFor(() => expect(result.current.isLoaded).toBe(true));
  expect(result.current.failed).toBe(1);
  expect(result.current.frames.current[2]).toBeNull();
  expect(result.current.frames.current[1]).not.toBeNull();
});

test("disabled loads nothing", async () => {
  const list = urls(3);
  const { result } = renderHook(() => useFramePreloader(list, { enabled: false }));
  await act(() => new Promise((r) => setTimeout(r, 10)));
  expect(FakeImage.requested).toEqual([]);
  expect(result.current.isLoaded).toBe(false);
  expect(result.current.loadingProgress).toBe(0);

  const empty = renderHook(() => useFramePreloader([], { enabled: false }));
  expect(empty.result.current.loadingProgress).toBe(0);
});

test("unmounting aborts pending requests", () => {
  const list = urls(10);
  const { unmount } = renderHook(() => useFramePreloader(list, { concurrency: 3 }));
  expect(FakeImage.requested).toHaveLength(3);
  unmount();
  expect(FakeImage.aborted).toBe(3);
});

test("new urls restart progress", async () => {
  const { result, rerender } = renderHook(({ list }) => useFramePreloader(list), {
    initialProps: { list: urls(2) },
  });
  await waitFor(() => expect(result.current.isLoaded).toBe(true));
  rerender({ list: ["/g/0", "/g/1", "/g/2"] });
  expect(result.current.isLoaded).toBe(false);
  expect(result.current.loadingProgress).toBe(0);
  await waitFor(() => expect(result.current.isLoaded).toBe(true));
});
