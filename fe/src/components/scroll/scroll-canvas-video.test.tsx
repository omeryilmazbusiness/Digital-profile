import { render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import type { FrameSequence } from "@/lib/frame-sequence";

import { ScrollCanvasVideo, type Scene } from "./scroll-canvas-video";
import { SmoothScrollProvider } from "./smooth-scroll-provider";

const sequence: FrameSequence = {
  basePath: "/frames/test-00000000",
  count: 3,
  sets: { landscape: { width: 1600, height: 1200 }, portrait: { width: 810, height: 1080 } },
};

const scenes: Scene[] = [
  { id: "one", start: 0, end: 0.3, content: <h2>First scene</h2> },
  { id: "two", start: 0.5, end: 0.8, content: <h2>Second scene</h2> },
];

function mockMatchMedia(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: reduce && query.includes("prefers-reduced-motion: reduce"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.style.overflow = "";
});

function renderVideo() {
  return render(
    <SmoothScrollProvider>
      <ScrollCanvasVideo sequence={sequence} scenes={scenes} label="Hotel walk" />
    </SmoothScrollProvider>,
  );
}

test("plays on a canvas, hidden with scrolling locked until frames load", () => {
  mockMatchMedia(false);
  const { container } = renderVideo();

  const canvas = screen.getByRole("img", { name: "Hotel walk" });
  expect(canvas.tagName).toBe("CANVAS");
  expect(canvas).toHaveClass("opacity-0");
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  expect(document.documentElement.style.overflow).toBe("hidden");

  const overlays = container.querySelectorAll<HTMLElement>("[data-scene]");
  expect(overlays).toHaveLength(2);
  // Only the scene visible on arrival shows before the timeline takes over.
  expect(overlays[0].style.visibility).toBe("");
  expect(overlays[1].style.visibility).toBe("hidden");
});

test("reduced motion gets a still poster and every scene as a section, without a loader", () => {
  mockMatchMedia(true);
  renderVideo();

  const poster = screen.getByRole("img", { name: "Hotel walk" });
  expect(poster.tagName).toBe("IMG");
  expect(poster).toHaveAttribute("src", "/frames/test-00000000/landscape/frame_0001.webp");
  expect(screen.getByRole("heading", { name: "First scene" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Second scene" })).toBeVisible();
  expect(screen.queryByRole("progressbar")).toBeNull();
  expect(document.documentElement.style.overflow).toBe("");
});
