import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";

import { Toaster } from "@/components/ui/toast";
import { mockSiteContent } from "@/features/site/mock-content";
import { uiStrings } from "@/i18n/ui";

import { CountUp } from "./count-up";
import { OfficeStatus } from "./office-status";
import { ShareCard } from "./share-card";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const { availability } = mockSiteContent.profile;
const ui = uiStrings("en");

test("shows the office's local time and that it's open", () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  // 07:15 UTC on Sunday = 10:15 in Makkah.
  vi.setSystemTime(new Date("2026-10-11T07:15:00Z"));
  render(<OfficeStatus availability={availability} ui={ui} />);
  expect(screen.getByText("10:15")).toBeInTheDocument();
  expect(screen.getByText("Available now")).toBeInTheDocument();
});

test("says when the office is closed", () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  // Friday.
  vi.setSystemTime(new Date("2026-10-16T09:00:00Z"));
  render(<OfficeStatus availability={availability} ui={ui} />);
  expect(screen.getByText("Outside office hours")).toBeInTheDocument();
});

test("copies the card's address where sharing isn't offered", async () => {
  const user = userEvent.setup();
  // user-event installs its own clipboard; watch that one.
  const writeText = vi.spyOn(navigator.clipboard, "writeText");
  render(
    <>
      <ShareCard
        title="Momen"
        url="/momen"
        cardHref="/momen/vcard"
        cardFileName="Momen.vcf"
        ui={ui}
      />
      <Toaster />
    </>,
  );

  const href = `${location.origin}/momen`;
  await user.click(screen.getByRole("button", { name: "Share this card" }));
  expect(writeText).toHaveBeenCalledWith(href);
  expect(await screen.findByText("Link copied")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Save business card" })).toHaveAttribute(
    "download",
    "Momen.vcf",
  );
});

test("saves the uploaded business card image when there is one", () => {
  render(
    <ShareCard
      title="Momen"
      url="/momen"
      cardHref="/api/v1/public/profile/business-card?locale=en"
      cardIsImage
      ui={ui}
    />,
  );
  const link = screen.getByRole("link", { name: "Save business card" });
  expect(link).toHaveAttribute("href", "/api/v1/public/profile/business-card?locale=en");
  // Saved under the name the server gives it.
  expect(link).toHaveAttribute("download", "");
  expect(link).toHaveAttribute("type", "image/jpeg");
});

test("uses the system share sheet when there is one", async () => {
  const share = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { ...navigator, share });
  const user = userEvent.setup();
  render(
    <ShareCard
      title="Momen"
      url="https://example.com/momen"
      cardHref="/momen/vcard"
      cardFileName="Momen.vcf"
      ui={ui}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Share this card" }));
  expect(share).toHaveBeenCalledWith({ title: "Momen", url: "https://example.com/momen" });
});

test("a counted figure reads as its final value", () => {
  render(<CountUp value={1200} suffix="+" />);
  expect(screen.getAllByText("1,200+")).not.toHaveLength(0);
});
