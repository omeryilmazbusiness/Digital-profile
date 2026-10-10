import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";

import { uiStrings } from "@/i18n/ui";

import type { NavItem } from "./content";
import { SiteHeader } from "./site-header";

const nav: NavItem[] = [
  { label: "Discover", href: "/#discover" },
  { label: "Momen Tawfiq Alkiswani", href: "/momen", caption: "Digital business card" },
];

function renderHeader() {
  return render(
    <>
      <div data-header-overlay="" />
      <SiteHeader
        hotelName="Sheraton Makkah"
        home="/"
        nav={nav}
        cta={nav[1]!}
        quickActions={[{ label: "Call", href: "tel:+966500000000", icon: null }]}
        ui={uiStrings("en")}
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
    vi.fn(function (callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      // Links observe themselves for prefetching; only the header watches the top strip.
      if (options?.rootMargin?.endsWith("-94% 0px")) report = callback;
      return { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() };
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
  expect(within(main).getByRole("link", { name: "Discover" })).toHaveAttribute(
    "href",
    "/#discover",
  );
  // The highlighted link sits apart from the others.
  expect(within(main).queryByRole("link", { name: /Momen/ })).toBeNull();
  expect(within(banner).getByRole("link", { name: "Momen Tawfiq Alkiswani" })).toHaveAttribute(
    "href",
    "/momen",
  );
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

test("the phone menu offers the digital business card by name", async () => {
  mockObserver();
  const user = userEvent.setup();
  renderHeader();

  await user.click(screen.getByRole("button", { name: "Open menu" }));
  const menu = screen.getByRole("dialog", { name: "Menu" });
  const card = within(menu).getByRole("link", { name: /Momen Tawfiq Alkiswani/ });
  expect(card).toHaveAttribute("href", "/momen");
  expect(card).toHaveTextContent("Digital business card");
});
