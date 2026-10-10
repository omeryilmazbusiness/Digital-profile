import { render, screen, within } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { mockSiteContent } from "@/features/site/mock-content";

import Home from "./page";

// The page at rest. The scroll animations have their own tests; building them all in jsdom
// is slow.
beforeEach(() => {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query) =>
      ({
        matches: query.includes("reduced-motion"),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
});

test("renders the hotel name as the page heading, then every section", async () => {
  render(await Home());

  expect(
    screen.getByRole("heading", { level: 1, name: "Sheraton Makkah Jabal Al Kaaba" }),
  ).toBeInTheDocument();
  for (const id of ["discover", "tour", "momen"]) {
    expect(document.getElementById(id)).toBeInTheDocument();
  }
});

test("lists each topic's PDFs with preview and download links", async () => {
  render(await Home());
  const rooms = mockSiteContent.sections[0]!;
  const list = screen.getByRole("list", { name: `${rooms.title}: documents` });

  expect(within(list).getAllByRole("article")).toHaveLength(rooms.documents.length);
  const first = rooms.documents[0]!;
  expect(within(list).getByRole("link", { name: `Download: ${first.title}` })).toHaveAttribute(
    "download",
    first.fileName,
  );
  expect(
    within(list).getByRole("link", { name: `Preview: ${first.title} (opens in a new tab)` }),
  ).toHaveAttribute("target", "_blank");
});

test("links the virtual tour out in a new tab", async () => {
  render(await Home());
  const link = screen.getByRole("link", { name: mockSiteContent.tour.cta });
  expect(link).toHaveAttribute("href", mockSiteContent.tour.url);
  expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
});
