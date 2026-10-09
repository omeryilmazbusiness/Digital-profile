import { expect, test, vi } from "vitest";

import { ScrollController } from "./scroll-controller";

function setup() {
  const root = document.createElement("div");
  const controller = new ScrollController(() => root);
  const scroller = { stop: vi.fn(), start: vi.fn() };
  return { root, controller, scroller };
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

test("a detached scroller is no longer driven", () => {
  const { controller, scroller } = setup();
  const detach = controller.attach(scroller);
  detach();
  controller.lock()();
  expect(scroller.stop).not.toHaveBeenCalled();
  expect(scroller.start).not.toHaveBeenCalled();
});
