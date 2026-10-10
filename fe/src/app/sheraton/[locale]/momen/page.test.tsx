import { render, screen, within } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { getSiteContent } from "@/features/site/content";
import { mockSiteContent } from "@/features/site/mock-content";

import ProfilePage, { generateMetadata } from "./page";
import { GET } from "./vcard/route";

const card = mockSiteContent.contact.profile;
const params = Promise.resolve({ locale: "en" });
const props = { params } as PageProps<"/sheraton/[locale]/momen">;

// The page at rest: with reduced motion nothing waits hidden for a scroll animation.
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

test("is the landing page, with the card as its own section at this address", async () => {
  render(await ProfilePage(props));
  expect(
    screen.getByRole("heading", { level: 1, name: "Sheraton Makkah Jabal Al Kaaba" }),
  ).toBeInTheDocument();
  expect(document.getElementById("discover")).toBeInTheDocument();
  expect(document.querySelector('[data-path="/sheraton/en/momen"]')).toHaveAttribute("id", "momen");
  expect(screen.getByRole("heading", { level: 2, name: card.name })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: card.portrait!.alt })).toHaveAttribute(
    "srcset",
    card.portrait!.srcSet,
  );
});

test("offers call, WhatsApp, email and save right under the name", async () => {
  render(await ProfilePage(props));
  const actions = screen.getByRole("list", { name: "Contact" });

  expect(within(actions).getByRole("link", { name: `Call ${card.name}` })).toHaveAttribute(
    "href",
    `tel:${card.phone.e164}`,
  );
  const whatsapp = within(actions).getByRole("link", { name: /on WhatsApp/ });
  expect(whatsapp).toHaveAttribute("href", card.whatsappUrl);
  expect(whatsapp).toHaveAttribute("rel", expect.stringContaining("noopener"));
  expect(within(actions).getByRole("link", { name: `Email ${card.name}` })).toHaveAttribute(
    "href",
    `mailto:${card.email}`,
  );
  const save = within(actions).getByRole("link", { name: `Save ${card.name} to your contacts` });
  expect(save).toHaveAttribute("href", "/sheraton/en/momen/vcard");
  expect(save).toHaveAttribute("download", `${card.name}.vcf`);
});

test("lays out every part of the card", async () => {
  render(await ProfilePage(props));
  const { profile } = mockSiteContent;
  for (const title of [
    profile.about.title,
    profile.services.title,
    profile.reach.title,
    profile.resources.title,
    profile.share.title,
    profile.closing.title,
  ]) {
    expect(screen.getByRole("heading", { level: 2, name: title })).toBeInTheDocument();
  }
  // Set word by word for the scroll effect, read as one paragraph.
  expect(
    screen.getByText((_, el) => el?.tagName === "P" && el.textContent === profile.statement),
  ).toBeInTheDocument();
  for (const stat of profile.stats) expect(screen.getByText(stat.label)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Fact sheets & guides/ })).toHaveAttribute(
    "href",
    "/sheraton/en#discover",
  );
});

test("writes the name white across the suit and black at its ends", async () => {
  const { container } = render(await ProfilePage(props));
  const fills = [...container.querySelectorAll("[data-name] path")].map((p) =>
    p.getAttribute("fill") === "#fff" ? "w" : "b",
  );
  // M · o m e n T a w fi · q, then Alkiswani.
  expect(fills.join("")).toBe(`b${"w".repeat(8)}b${"b".repeat(9)}`);
});

test("offers the CV to view and to download", async () => {
  render(await ProfilePage(props));
  const cv = mockSiteContent.profile.cv!;
  expect(screen.getByRole("heading", { level: 2, name: cv.title })).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: `View: ${cv.document.title} (opens in a new tab)` }),
  ).toHaveAttribute("href", cv.document.url);
  expect(screen.getByRole("link", { name: `Download: ${cv.document.title}` })).toHaveAttribute(
    "download",
    cv.document.fileName,
  );
});

test("describes the person for search engines", async () => {
  const { container } = render(await ProfilePage(props));
  const script = container.querySelector('script[type="application/ld+json"]');
  expect(JSON.parse(script!.textContent!)).toMatchObject({
    "@type": "Person",
    name: card.name,
    jobTitle: card.title,
    telephone: card.phone.e164,
  });

  const metadata = await generateMetadata(props);
  expect(metadata.title).toBe(`${card.name} — ${card.title}`);
  expect(metadata.alternates).toMatchObject({
    canonical: "/sheraton/en/momen",
    languages: { ar: "/sheraton/ar/momen", "x-default": "/sheraton/en/momen" },
  });
  expect(metadata.openGraph).toMatchObject({ type: "profile" });
});

test("serves the contact card with the photo, as a download", async () => {
  const response = await GET(new Request("https://example.com"), { params });
  expect(response.headers.get("content-type")).toBe("text/vcard; charset=utf-8");
  expect(response.headers.get("content-disposition")).toContain(`filename="${card.name}.vcf"`);
  const body = (await response.text()).replace(/\r\n /g, "");
  expect(body).toContain(`FN:${card.name}\r\n`);
  expect(body).toContain("ORG:Sheraton Makkah Jabal Al Kaaba\r\n");
  expect(body).toMatch(/PHOTO;ENCODING=b;TYPE=JPEG:\/9j\//);
});

test("links every page of the card in the language it is read in", async () => {
  const { contact, nav, home } = await getSiteContent("ar");
  expect(home).toBe("/sheraton/ar");
  expect(contact.profile.href).toBe("/sheraton/ar/momen");
  expect(contact.profile.vcardHref).toBe("/sheraton/ar/momen/vcard");
  expect(nav.map((item) => item.href)).toEqual([
    "/sheraton/ar#discover",
    "/sheraton/ar#tour",
    "/sheraton/ar/momen",
  ]);
});
