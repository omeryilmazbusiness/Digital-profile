import { render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { mockSiteContentAr } from "@/features/site/mock-content.ar";
import { hubDestinations, whatsappUrl } from "@/features/social-hub/destinations";
import { HUB_CALL, HUB_LOCKUP } from "@/features/social-hub/social-hub";
import { uiStrings } from "@/i18n/ui";

import SocialMediaPage, { generateMetadata } from "./page";

const props = {
  params: Promise.resolve({ locale: "ar" }),
} as PageProps<"/[locale]/social-media">;

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

test("opens as a hub: mark, social accounts, WhatsApp and a call for each number, and no menu", async () => {
  render(await SocialMediaPage(props));

  expect(screen.getByRole("heading", { level: 1, name: HUB_LOCKUP })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /Snapchat/ })).toBeNull();
  expect(screen.getByRole("navigation", { name: uiStrings("ar").socialMedia })).toBeInTheDocument();
  expect(
    screen.getAllByRole("link").filter((el) => el.getAttribute("target") === "_blank"),
  ).toHaveLength(hubDestinations.social.length + hubDestinations.lines.length);
  const whatsapp = screen.getAllByRole("link", { name: /واتساب/ });
  const call = screen.getAllByRole("link", { name: new RegExp(HUB_CALL) });
  expect(whatsapp).toHaveLength(2);
  expect(call).toHaveLength(2);
  hubDestinations.lines.forEach((line, i) => {
    expect(whatsapp[i]).toHaveAttribute("href", whatsappUrl(line.e164));
    expect(call[i]).toHaveAttribute("href", `tel:${line.e164}`);
  });
  expect(screen.queryByRole("button", { name: uiStrings("ar").openMenu })).toBeNull();
});

test("describes the hub for search engines at /ar/social-media", async () => {
  const metadata = await generateMetadata(props);
  expect(metadata.title).toBe(mockSiteContentAr.hotel.name);
  expect(metadata.alternates).toMatchObject({
    canonical: "/ar/social-media",
    languages: { ar: "/ar/social-media", en: "/en/social-media", "x-default": "/ar/social-media" },
  });
});
