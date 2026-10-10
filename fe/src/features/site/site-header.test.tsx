import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";

import type { NavItem } from "./content";
import { SiteHeader } from "./site-header";

const nav: NavItem[] = [
  { label: "Discover", href: "#discover" },
  { label: "Contact", href: "#contact" },
];

function renderHeader() {
  return render(
    <>
      <div data-header-overlay="" />
      <SiteHeader
        hotelName="Sheraton Makkah"
        nav={nav}
        cta={nav[1]!}
        quickActions={[{ label: "Call", href: "tel:+966500000000", icon: null }]}
      />
      <section id="discover">Discover</section>
    </>,
  );
}

/** Captures the header's IntersectionObserver so tests can move the hero. */
function mockObserver() {
  let report: IntersectionObserverCallback = () => {};
  vi.stubGlobal(
    "IntersectionObserver",
    vi.fn(function (callback: IntersectionObserverCallback) {
      report = callback;
      return { observe: vi.fn(), disconnect: vi.fn() };
    }),
  );
  return (target: Element, isIntersecting: boolean) =>
    act(() =>
      report([{ target, isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver),
    );
}

afterEach(() => vi.unstubAllGlobals());

test("links to each section, with a skip link first", () => {
  mockObserver();
  renderHeader();
  const banner = screen.getByRole("banner");
  const links = within(banner).getAllByRole("link");

  expect(links[0]).toHaveAccessibleName("Skip to content");
  const main = within(banner).getByRole("navigation", { name: "Main" });
  expect(within(main).getByRole("link", { name: "Discover" })).toHaveAttribute("href", "#discover");
});

test("is transparent over the hero and frosted once it has scrolled past", () => {
  const move = mockObserver();
  const { container } = renderHeader();
  const header = screen.getByRole("banner");
  const hero = container.querySelector("[data-header-overlay]")!;

  move(hero, true);
  expect(header).toHaveClass("text-white");
  move(hero, false);
  expect(header).toHaveClass("material-chrome");
});

test("the phone menu closes and scrolls to the chosen section", async () => {
  mockObserver();
  const scrollTo = vi.fn();
  vi.stubGlobal("scrollTo", scrollTo);
  const user = userEvent.setup();
  renderHeader();

  await user.click(screen.getByRole("button", { name: "Open menu" }));
  const menu = screen.getByRole("dialog", { name: "Menu" });
  expect(within(menu).getByRole("link", { name: "Call" })).toHaveAttribute(
    "href",
    "tel:+966500000000",
  );

  await user.click(within(menu).getByRole("link", { name: /Discover/ }));
  expect(screen.queryByRole("dialog")).toBeNull();
  // The scroll waits a frame for the menu's scroll lock to be released.
  await vi.waitFor(() => expect(scrollTo).toHaveBeenCalledWith({ top: expect.any(Number) }));
  expect(location.hash).toBe("#discover");
});
