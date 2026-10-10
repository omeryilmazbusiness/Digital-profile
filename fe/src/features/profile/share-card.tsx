"use client";

import { IdCard, Share, UserPlus } from "lucide-react";
import { useSyncExternalStore } from "react";

import { toast } from "@/components/ui/toast";
import type { UiStrings } from "@/i18n/ui";
import { cn } from "@/lib/utils";

interface ShareCardProps {
  title: string;
  /** Absolute link to share; resolved against the current origin when it's a path. */
  url: string;
  /** Downloads the business card: the designed image when there is one, else the contact card. */
  cardHref: string;
  /** Name to save under; the server's is kept when absent. */
  cardFileName?: string;
  /** The card is an image rather than a contact card (.vcf). */
  cardIsImage?: boolean;
  ui: UiStrings;
  className?: string;
}

const noSubscribe = () => () => {};

/** Share and save buttons for the card. */
export function ShareCard({
  title,
  url,
  cardHref,
  cardFileName,
  cardIsImage = false,
  ui,
  className,
}: ShareCardProps) {
  // A path needs the browser's origin; sharing is offered once it's known.
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
        if ((error as DOMException).name !== "AbortError") await copy(href, ui);
      }
      return;
    }
    await copy(href, ui);
  }

  return (
    <div className={cn("flex w-full flex-col gap-3 sm:w-auto", className)}>
      <button
        type="button"
        onClick={share}
        disabled={!href}
        className="flex h-13 pressable items-center justify-center gap-2.5 rounded-full bg-white px-7 text-headline text-neutral-950 disabled:opacity-50"
      >
        <Share aria-hidden className="size-5" />
        {ui.shareCard}
      </button>
      <a
        href={cardHref}
        download={cardFileName ?? ""}
        type={cardIsImage ? "image/jpeg" : "text/vcard"}
        className="flex h-13 pressable items-center justify-center gap-2.5 rounded-full px-7 text-headline text-white ring-1 ring-white/25 hover:bg-white/5"
      >
        {cardIsImage ? (
          <IdCard aria-hidden className="size-5" />
        ) : (
          <UserPlus aria-hidden className="size-5" />
        )}
        {ui.saveBusinessCard}
      </a>
    </div>
  );
}

async function copy(href: string, ui: UiStrings) {
  try {
    await navigator.clipboard.writeText(href);
    toast.success(ui.linkCopied);
  } catch {
    toast.error(ui.copyFailed, { description: href });
  }
}
