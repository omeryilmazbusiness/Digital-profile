import { render } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { Handwriting, type Signature } from "./handwriting";

const signatures: Signature[] = [
  {
    lang: "en",
    dir: "ltr",
    text: "Hi",
    viewBox: [0, 0, 200, 100],
    glyphs: [
      { d: "M0 0h10v10z", length: 30 },
      { d: "M20 0h10v10z", length: 10 },
    ],
  },
  {
    lang: "ar",
    dir: "rtl",
    text: "مرحبا",
    viewBox: [0, 0, 100, 100],
    glyphs: [{ d: "M0 0h10v10z", length: 40 }],
  },
];

function mockMotion(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: reduce && query.includes("reduce"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

function mockObserver() {
  const observer = { observe: vi.fn(), disconnect: vi.fn() };
  vi.stubGlobal(
    "IntersectionObserver",
    vi.fn(function () {
      return observer;
    }),
  );
  return observer;
}

afterEach(() => vi.unstubAllGlobals());

test("draws every signature as decorative glyph outlines, at one shared scale", () => {
  mockMotion(false);
  mockObserver();
  const { container } = render(<Handwriting signatures={signatures} />);

  expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  const [en, ar] = container.querySelectorAll<SVGSVGElement>("svg[data-signature]");
  expect(en?.querySelectorAll("[data-glyph]")).toHaveLength(2);
  expect(ar?.querySelectorAll("[data-glyph]")).toHaveLength(1);
  expect(en?.style.width).toBe("100%");
  expect(ar?.style.width).toBe("50%");
  // Unwritten until the pen reaches them; later signatures wait their turn.
  expect(en?.querySelector("path")).toHaveAttribute("stroke-dashoffset", "1");
  expect(ar).toHaveClass("invisible");
});

test("animates only while on screen, and stops observing when removed", () => {
  mockMotion(false);
  const observer = mockObserver();
  const { container, unmount } = render(<Handwriting signatures={signatures} />);

  expect(observer.observe).toHaveBeenCalledWith(container.firstElementChild);
  unmount();
  expect(observer.disconnect).toHaveBeenCalled();
});

test("with reduced motion nothing animates", () => {
  mockMotion(true);
  const observer = mockObserver();
  render(<Handwriting signatures={signatures} />);
  expect(observer.observe).not.toHaveBeenCalled();
});
