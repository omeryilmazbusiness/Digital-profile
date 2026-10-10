import { afterEach, expect, test } from "vitest";

import { arrivalTarget, isInDocument, sectionForPath } from "./arrival";

function landing() {
  document.body.innerHTML = `<section id="tour"></section><div id="momen" data-path="/momen"></div>`;
}

afterEach(() => {
  document.body.innerHTML = "";
  history.replaceState(null, "", "/");
});

test("treats the landing page's own sections as part of the page", () => {
  landing();
  history.replaceState(null, "", "/momen");
  expect(isInDocument("/")).toBe(true);
  expect(isInDocument("/momen")).toBe(true);
  expect(isInDocument("/design")).toBe(false);
  expect(sectionForPath("/momen")).toHaveAttribute("id", "momen");
});

test("leaves other pages to the router", () => {
  history.replaceState(null, "", "/design");
  expect(isInDocument("/design")).toBe(true);
  expect(isInDocument("/")).toBe(false);
});

test("opens at the fragment, or at the section that owns the path", () => {
  landing();
  expect(arrivalTarget()).toBeNull();
  history.replaceState(null, "", "/#tour");
  expect(arrivalTarget()).toHaveAttribute("id", "tour");
  history.replaceState(null, "", "/momen");
  expect(arrivalTarget()).toHaveAttribute("id", "momen");
});
