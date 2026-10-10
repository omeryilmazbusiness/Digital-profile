import { expect, test, vi } from "vitest";

import { ScrollController } from "./scroll-controller";

function setup() {
  const root = document.createElement("div");
  const controller = new ScrollController(() => root);
  const scroller = { stop: vi.fn(), start: vi.fn(), scrollTo: vi.fn() };
  return { root, controller, scroller };
}

function section(top: number, scrollMargin = "") {
  const el = document.createElement("section");
  el.style.scrollMarginTop = scrollMargin;
  el.getBoundingClientRect = () => ({ top }) as DOMRect;
  return el;
}

test("locks nest and release once", () => {
  const { root, controller, scroller } = setup();
  controller.attach(scroller);

  const a = controller.lock();
  const b = controller.lock();
  expect(root.style.overflow).toBe("hidden");
  expect(scroller.stop).toHaveBeenCalledTimes(1);

  a();
  a();
  expect(controller.locked).toBe(true);
  expect(scroller.start).not.toHaveBeenCalled();

  b();
  expect(controller.locked).toBe(false);
  expect(root.style.overflow).toBe("");
  expect(scroller.start).toHaveBeenCalledTimes(1);
});

test("a scroller attached while locked is stopped right away", () => {
  const { controller, scroller } = setup();
  const release = controller.lock();
  controller.attach(scroller);
  expect(scroller.stop).toHaveBeenCalledTimes(1);
  release();
  expect(scroller.start).toHaveBeenCalledTimes(1);
});

test("scrolls a section clear of the header, like a native anchor", () => {
  const { root, controller, scroller } = setup();
  root.style.scrollPaddingTop = "56px";
  vi.stubGlobal("scrollY", 100);
  controller.attach(scroller);

  controller.scrollTo(section(500, "24px"));
  expect(scroller.scrollTo).toHaveBeenCalledWith(100 + 500 - 56 - 24);
  vi.unstubAllGlobals();
});

test("scrolls natively without a smooth scroller, and not at all while locked", () => {
  const { controller } = setup();
  const scrollTo = vi.fn();
  vi.stubGlobal("scrollTo", scrollTo);

  const release = controller.lock();
  controller.scrollTo(0);
  expect(scrollTo).not.toHaveBeenCalled();

  release();
  controller.scrollTo(0);
  expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
  vi.unstubAllGlobals();
});

test("a detached scroller is no longer driven", () => {
  const { controller, scroller } = setup();
  const detach = controller.attach(scroller);
  detach();
  controller.lock()();
  expect(scroller.stop).not.toHaveBeenCalled();
  expect(scroller.start).not.toHaveBeenCalled();
});
