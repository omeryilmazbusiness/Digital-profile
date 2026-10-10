"use client";

import { Share, UserPlus } from "lucide-react";
import { useSyncExternalStore } from "react";
import { encode } from "uqr";

import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface ShareCardProps {
  title: string;
  /** Absolute link to share; resolved against the current origin when it's a path. */
  url: string;
  vcardHref: string;
  vcardFileName: string;
  className?: string;
}

const noSubscribe = () => () => {};

/** QR code of the card's link, plus share and save buttons. */
export function ShareCard({ title, url, vcardHref, vcardFileName, className }: ShareCardProps) {
  // A path needs the browser's origin; the code appears once it's known.
  const href = useSyncExternalStore(
    noSubscribe,
    () => new URL(url, location.origin).href,
    () => (URL.canParse(url) ? url : null),
  );

  async function share() {
    if (!href) return;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url: href });
      } catch (error) {
        if ((error as DOMException).name !== "AbortError") await copy(href);
      }
      return;
    }
    await copy(href);
  }

  return (
    <div className={cn("flex flex-col items-center gap-8 sm:flex-row sm:gap-10", className)}>
      <div className="shrink-0 rounded-[1.75rem] bg-white p-3.5 shadow-[0_30px_60px_-20px_rgb(0_0_0/0.6)]">
        {href ? (
          <QrCode value={href} label={`QR code for ${href}`} />
        ) : (
          <div className="size-40 animate-pulse rounded-xl bg-neutral-100" />
        )}
      </div>
      <div className="flex w-full flex-col gap-3 sm:w-auto">
        <button
          type="button"
          onClick={share}
          disabled={!href}
          className="flex h-13 pressable items-center justify-center gap-2.5 rounded-full bg-white px-7 text-headline text-neutral-950 disabled:opacity-50"
        >
          <Share aria-hidden className="size-5" />
          Share this card
        </button>
        <a
          href={vcardHref}
          download={vcardFileName}
          className="flex h-13 pressable items-center justify-center gap-2.5 rounded-full px-7 text-headline text-white ring-1 ring-white/25 hover:bg-white/5"
        >
          <UserPlus aria-hidden className="size-5" />
          Save business card
        </a>
      </div>
    </div>
  );
}

async function copy(href: string) {
  try {
    await navigator.clipboard.writeText(href);
    toast.success("Link copied");
  } catch {
    toast.error("Couldn't copy the link", { description: href });
  }
}

/** A QR code drawn as one SVG path; crisp at any size. */
function QrCode({ value, label }: { value: string; label: string }) {
  // With the card's padding, the one-module border makes the quiet zone scanners expect.
  const { data, size } = encode(value, { ecc: "M", border: 1 });
  let d = "";
  data.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) d += `M${x} ${y}h1v1h-1z`;
    }),
  );
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className="size-40"
    >
      <path d={d} fill="#0a0a0a" />
    </svg>
  );
}
