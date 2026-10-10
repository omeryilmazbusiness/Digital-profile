import { afterEach, expect, test } from "vitest";

import { arrivalTarget, isInDocument, sectionForPath } from "./arrival";

function landing() {
  document.body.innerHTML = `
    <main data-path="/sheraton/en" data-landing="">
      <section id="tour"></section>
      <div id="momen" data-path="/sheraton/en/momen"></div>
    </main>`;
}

afterEach(() => {
  document.body.innerHTML = "";
  history.replaceState(null, "", "/");
});

test("treats the landing page's own sections as part of the page", () => {
  landing();
  history.replaceState(null, "", "/sheraton/en/momen");
  expect(isInDocument("/sheraton/en")).toBe(true);
  expect(isInDocument("/sheraton/en/momen")).toBe(true);
  expect(isInDocument("/sheraton/ar/momen")).toBe(false);
  expect(isInDocument("/design")).toBe(false);
  expect(sectionForPath("/sheraton/en/momen")).toHaveAttribute("id", "momen");
});

test("leaves other pages to the router", () => {
  history.replaceState(null, "", "/design");
  expect(isInDocument("/design")).toBe(true);
  expect(isInDocument("/sheraton/en")).toBe(false);
});

test("opens at the top, at the fragment, or at the section that owns the path", () => {
  landing();
  history.replaceState(null, "", "/sheraton/en");
  expect(arrivalTarget()).toBeNull();
  history.replaceState(null, "", "/sheraton/en#tour");
  expect(arrivalTarget()).toHaveAttribute("id", "tour");
  history.replaceState(null, "", "/sheraton/en/momen");
  expect(arrivalTarget()).toHaveAttribute("id", "momen");
});
