import { gsap } from "gsap";
import { expect, test } from "vitest";

import { sceneKeyframes } from "@/lib/scroll-scenes";

import { addSceneReveal, sceneReveal } from "./scene-reveal";

function overlay() {
  const root = document.createElement("div");
  root.innerHTML = `
    <p ${sceneReveal.item}><span ${sceneReveal.line}></span>Eyebrow</p>
    <h2><span ${sceneReveal.word}>Every</span> <span ${sceneReveal.word}>pilgrim</span></h2>`;
  return root;
}

const scene = { start: 0.3, end: 0.5 };

function build(root: HTMLElement) {
  const timeline = gsap.timeline({ paused: true, defaults: { ease: "none" } });
  addSceneReveal(timeline, root, scene, sceneKeyframes(scene));
  timeline.set({}, {}, 1);
  return timeline;
}

const words = (root: HTMLElement) => root.querySelectorAll(`[${sceneReveal.word}]`);

test("words wait below their mask, rise in by the scene's start, and lift away after its end", () => {
  const root = overlay();
  const timeline = build(root);
  const [first, last] = words(root);

  timeline.progress(0.2);
  expect(gsap.getProperty(first!, "yPercent")).toBe(115);
  expect(gsap.getProperty(first!, "opacity")).toBe(0);

  timeline.progress(0.4);
  expect(gsap.getProperty(first!, "yPercent")).toBe(0);
  expect(gsap.getProperty(last!, "opacity")).toBe(1);
  const line = root.querySelector(`[${sceneReveal.line}]`)!;
  expect(gsap.getProperty(line, "scaleX")).toBe(1);

  timeline.progress(0.6);
  expect(gsap.getProperty(first!, "yPercent")).toBe(-115);
});

test("scrubbing back restores the words", () => {
  const root = overlay();
  const timeline = build(root);
  const [first] = words(root);

  timeline.progress(0.6);
  timeline.progress(0.4);
  expect(gsap.getProperty(first!, "yPercent")).toBe(0);
  expect(gsap.getProperty(first!, "opacity")).toBe(1);
});

test("content without markers is left to the overlay fade", () => {
  const root = document.createElement("div");
  root.innerHTML = "<h2>Plain</h2>";
  const timeline = gsap.timeline({ paused: true });
  addSceneReveal(timeline, root, scene, sceneKeyframes(scene));
  expect(timeline.getChildren()).toHaveLength(0);
});
