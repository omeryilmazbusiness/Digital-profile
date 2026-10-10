import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";

import { Toaster } from "@/components/ui/toast";
import { mockSiteContent } from "@/features/site/mock-content";

import { CountUp } from "./count-up";
import { OfficeStatus } from "./office-status";
import { ShareCard } from "./share-card";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const { availability } = mockSiteContent.profile;

test("shows the office's local time and that it's open", () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  // 07:15 UTC on Sunday = 10:15 in Makkah.
  vi.setSystemTime(new Date("2026-10-11T07:15:00Z"));
  render(<OfficeStatus availability={availability} />);
  expect(screen.getByText("10:15")).toBeInTheDocument();
  expect(screen.getByText("Available now")).toBeInTheDocument();
});

test("says when the office is closed", () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  // Friday.
  vi.setSystemTime(new Date("2026-10-16T09:00:00Z"));
  render(<OfficeStatus availability={availability} />);
  expect(screen.getByText("Outside office hours")).toBeInTheDocument();
});

test("draws a QR code of the card's address and copies the link where sharing isn't offered", async () => {
  const user = userEvent.setup();
  // user-event installs its own clipboard; watch that one.
  const writeText = vi.spyOn(navigator.clipboard, "writeText");
  render(
    <>
      <ShareCard title="Momen" url="/momen" vcardHref="/momen/vcard" vcardFileName="Momen.vcf" />
      <Toaster />
    </>,
  );

  const href = `${location.origin}/momen`;
  expect(screen.getByRole("img", { name: `QR code for ${href}` })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Share this card" }));
  expect(writeText).toHaveBeenCalledWith(href);
  expect(await screen.findByText("Link copied")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Save contact" })).toHaveAttribute(
    "download",
    "Momen.vcf",
  );
});

test("uses the system share sheet when there is one", async () => {
  const share = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { ...navigator, share });
  const user = userEvent.setup();
  render(
    <ShareCard
      title="Momen"
      url="https://example.com/momen"
      vcardHref="/momen/vcard"
      vcardFileName="Momen.vcf"
    />,
  );
  await user.click(screen.getByRole("button", { name: "Share this card" }));
  expect(share).toHaveBeenCalledWith({ title: "Momen", url: "https://example.com/momen" });
});

test("a counted figure reads as its final value", () => {
  render(<CountUp value={1200} suffix="+" />);
  expect(screen.getAllByText("1,200+")).not.toHaveLength(0);
});
