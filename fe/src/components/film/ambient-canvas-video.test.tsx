import { render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import type { FrameSequence } from "@/lib/frame-sequence";

import { AmbientCanvasVideo } from "./ambient-canvas-video";

const sequence: FrameSequence = {
  basePath: "/frames/test-00000000",
  count: 3,
  sets: { landscape: { width: 1600, height: 1200 }, portrait: { width: 810, height: 1080 } },
};

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

afterEach(() => vi.unstubAllGlobals());

test("plays on a canvas, hidden until the first frame lands", () => {
  mockMatchMedia(false);
  render(<AmbientCanvasVideo sequence={sequence} label="Hotel walk" />);

  const canvas = screen.getByRole("img", { name: "Hotel walk" });
  expect(canvas.tagName).toBe("CANVAS");
  expect(canvas).toHaveClass("opacity-0");
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
});

test("reduced motion gets a still poster, without a loader", () => {
  mockMatchMedia(true);
  render(<AmbientCanvasVideo sequence={sequence} label="Hotel walk" />);

  const poster = screen.getByRole("img", { name: "Hotel walk" });
  expect(poster.tagName).toBe("IMG");
  expect(poster).toHaveAttribute("src", "/frames/test-00000000/landscape/frame_0001.webp");
  expect(screen.queryByRole("progressbar")).toBeNull();
});

test("a decorative film is hidden from assistive tech", () => {
  mockMatchMedia(false);
  render(<AmbientCanvasVideo sequence={sequence} label="Hotel walk" decorative />);
  expect(screen.queryByRole("img", { name: "Hotel walk" })).toBeNull();
  expect(screen.getByRole("progressbar")).toBeInTheDocument();
});
