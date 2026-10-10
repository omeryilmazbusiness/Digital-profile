import { render, screen, within } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { mockSiteContent } from "@/features/site/mock-content";

import Home from "./page";

const props = { params: Promise.resolve({ locale: "en" }) } as PageProps<"/sheraton/[locale]">;

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
  render(await Home(props));

  expect(
    screen.getByRole("heading", { level: 1, name: "Sheraton Makkah Jabal Al Kaaba" }),
  ).toBeInTheDocument();
  for (const id of ["discover", "tour", "momen"]) {
    expect(document.getElementById(id)).toBeInTheDocument();
  }
});

test("lists each topic's PDFs with preview and download links", async () => {
  render(await Home(props));
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
  render(await Home(props));
  const link = screen.getByRole("link", { name: mockSiteContent.tour.cta });
  expect(link).toHaveAttribute("href", mockSiteContent.tour.url);
  expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
});

test("signs the opening and the closing with the studio's credit", async () => {
  render(await Home(props));
  const credit = mockSiteContent.footer.credit!;
  const links = screen.getAllByRole("link", { name: `by ${credit.name} (opens in a new tab)` });
  expect(links).toHaveLength(2);
  for (const link of links) {
    expect(link).toHaveAttribute("href", credit.href);
    expect(link).toHaveAttribute("target", "_blank");
  }
});

test("reads entirely in Arabic at /ar", async () => {
  render(await Home({ params: Promise.resolve({ locale: "ar" }) } as typeof props));
  expect(
    screen.getByRole("heading", { level: 1, name: "شيراتون مكة جبل الكعبة" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "ابدأ الجولة الافتراضية" })).toBeInTheDocument();
  const list = screen.getByRole("list", { name: "غرف وأجنحة على بُعد لحظات من الحرم: المستندات" });
  expect(
    within(list).getByRole("link", { name: "تنزيل: النشرة التعريفية للغرف والأجنحة" }),
  ).toBeInTheDocument();
  expect(within(list).getByText(/8 صفحات/)).toBeInTheDocument();
});
