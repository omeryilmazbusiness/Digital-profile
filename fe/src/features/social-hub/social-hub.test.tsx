import { render, screen, within } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { uiStrings } from "@/i18n/ui";

import { hubDestinations, whatsappUrl } from "./destinations";
import { HUB_CALL, HUB_LOCKUP, SocialHub } from "./social-hub";

const ui = uiStrings("en");

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

function renderHub() {
  return render(
    <SocialHub
      hotelName="Sheraton Makkah Jabal Al Kaaba"
      filmLabel="Walking into the lobby"
      ui={ui}
    />,
  );
}

test("puts only the hotel mark in the header, with no menu", () => {
  renderHub();
  const banner = screen.getByRole("banner");
  expect(within(banner).getByRole("heading", { level: 1, name: HUB_LOCKUP })).toBeInTheDocument();
  expect(within(banner).getByRole("img", { name: HUB_LOCKUP })).toHaveAttribute(
    "src",
    "/brand/sheraton-logo.png",
  );
  expect(within(banner).queryByRole("button")).toBeNull();
  expect(within(banner).queryByRole("navigation")).toBeNull();
  expect(screen.queryByRole("button", { name: ui.openMenu })).toBeNull();
});

test("keeps the English lockup on the Arabic page, and never lists Snapchat", () => {
  render(
    <SocialHub
      hotelName="شيراتون مكة جبل الكعبة"
      filmLabel="السير إلى البهو"
      ui={uiStrings("ar")}
    />,
  );
  expect(screen.getByRole("heading", { level: 1, name: HUB_LOCKUP })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /Snapchat/ })).toBeNull();
});

test("lists each social account, then a WhatsApp and a call for each number", () => {
  renderHub();
  const social = screen.getByRole("navigation", { name: ui.socialMedia });
  expect(within(social).getAllByRole("link")).toHaveLength(hubDestinations.social.length);
  for (const item of hubDestinations.social) {
    const link = within(social).getByRole("link", { name: new RegExp(item.label) });
    expect(link).toHaveAttribute("href", item.href);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  }

  const contact = screen.getByRole("list", { name: ui.contact });
  const actions = within(contact).getAllByRole("link");
  expect(actions).toHaveLength(hubDestinations.lines.length * 2);
  hubDestinations.lines.forEach((line, i) => {
    const whatsapp = actions[i * 2];
    const call = actions[i * 2 + 1];
    expect(whatsapp).toHaveAttribute("href", whatsappUrl(line.e164));
    expect(whatsapp).toHaveAttribute("target", "_blank");
    expect(whatsapp).toHaveAccessibleName(expect.stringContaining(line.display));
    expect(call).toHaveAttribute("href", `tel:${line.e164}`);
    expect(call).toHaveAccessibleName(`${HUB_CALL} ${line.display}`);
    expect(call).not.toHaveTextContent(HUB_CALL);
  });
});

test("reads the actions in Arabic", () => {
  render(
    <SocialHub
      hotelName="شيراتون مكة جبل الكعبة"
      filmLabel="السير إلى البهو"
      ui={uiStrings("ar")}
    />,
  );
  expect(screen.getByRole("navigation", { name: "وسائل التواصل" })).toBeInTheDocument();
  expect(screen.getAllByRole("link", { name: /واتساب/ })).toHaveLength(2);
  expect(screen.getAllByRole("link", { name: new RegExp(HUB_CALL) })).toHaveLength(2);
});
