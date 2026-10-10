import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(cleanup);

// next/font is compiled by Next; tests only need the class names.
vi.mock("next/font/local", () => ({
  default: () => ({ className: "font-local", variable: "font-local-variable", style: {} }),
}));

// "use cache" only means something inside Next; tests run every call uncached.
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  cacheTag: () => {},
  cacheLife: () => {},
}));

// Browser APIs that jsdom lacks but the components (and Radix) use. Server-side tests run
// in node, without a window.
if (typeof window !== "undefined") installBrowserShims();

function installBrowserShims() {
  if (!window.matchMedia) {
    window.matchMedia = vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    }));
  }

  class NoopObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  globalThis.IntersectionObserver ??= NoopObserver as unknown as typeof IntersectionObserver;
  globalThis.ResizeObserver ??= NoopObserver as unknown as typeof ResizeObserver;

  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
  // jsdom's scrollTo only logs "not implemented".
  window.scrollTo = () => {};
}
