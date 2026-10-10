import { render, screen, within } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { mockSiteContent } from "@/features/site/mock-content";

import ProfilePage, { generateMetadata } from "./page";
import { GET } from "./vcard/route";

const card = mockSiteContent.contact.profile;

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

test("names the person as the page heading, with the portrait", async () => {
  render(await ProfilePage());
  expect(screen.getByRole("heading", { level: 1, name: card.name })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: card.portrait!.alt })).toHaveAttribute(
    "srcset",
    card.portrait!.srcSet,
  );
});

test("offers call, WhatsApp, email and save right under the name", async () => {
  render(await ProfilePage());
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
  expect(save).toHaveAttribute("href", "/momen/vcard");
  expect(save).toHaveAttribute("download", `${card.name}.vcf`);
});

test("lays out every part of the card", async () => {
  render(await ProfilePage());
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
    "/#discover",
  );
});

test("describes the person for search engines", async () => {
  const { container } = render(await ProfilePage());
  const script = container.querySelector('script[type="application/ld+json"]');
  expect(JSON.parse(script!.textContent!)).toMatchObject({
    "@type": "Person",
    name: card.name,
    jobTitle: card.title,
    telephone: card.phone.e164,
  });

  const metadata = await generateMetadata();
  expect(metadata.title).toBe(`${card.name} — ${card.title}`);
  expect(metadata.openGraph).toMatchObject({ type: "profile" });
});

test("serves the contact card with the photo, as a download", async () => {
  const response = await GET();
  expect(response.headers.get("content-type")).toBe("text/vcard; charset=utf-8");
  expect(response.headers.get("content-disposition")).toContain(`filename="${card.name}.vcf"`);
  const body = (await response.text()).replace(/\r\n /g, "");
  expect(body).toContain(`FN:${card.name}\r\n`);
  expect(body).toContain("ORG:Sheraton Makkah Jabal Al Kaaba\r\n");
  expect(body).toMatch(/PHOTO;ENCODING=b;TYPE=JPEG:\/9j\//);
});
