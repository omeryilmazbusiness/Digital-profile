"use client";

import { useSyncExternalStore } from "react";

import type { Availability } from "@/features/site/content";
import type { UiStrings } from "@/i18n/ui";
import { isOpen, zonedClock } from "@/lib/availability";
import { cn } from "@/lib/utils";

function subscribe(onChange: () => void) {
  const id = setInterval(onChange, 10_000);
  return () => clearInterval(id);
}
/** The current minute: stable between renders until it changes. */
const currentMinute = () => Math.floor(Date.now() / 60_000);

/**
 * The office's local time and whether it's open now, live. Rendered on the client only: the
 * server can't know the visitor's moment, so it shows the hours without a status.
 */
export function OfficeStatus({ availability, ui }: { availability: Availability; ui: UiStrings }) {
  const minute = useSyncExternalStore(subscribe, currentMinute, () => null);
  const now = minute === null ? null : new Date(minute * 60_000);
  const open = now !== null && isOpen(now, availability);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <p className="text-caption-2 font-semibold tracking-[0.24em] whitespace-nowrap text-neutral-500 uppercase">
            {ui.localTime} · {availability.place}
          </p>
          <p className="mt-2 font-display text-6xl leading-none tabular-nums">
            {now ? zonedClock(now, availability.timeZone).time : "--:--"}
          </p>
        </div>
        <p
          className={cn(
            "flex items-center gap-2 rounded-full px-3.5 py-1.5 text-footnote font-medium whitespace-nowrap transition-opacity duration-500",
            now === null && "opacity-0",
            open ? "bg-neutral-950 text-white" : "bg-neutral-100 text-neutral-600",
          )}
        >
          <span aria-hidden className="relative flex size-2">
            {open && (
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-75" />
            )}
            <span
              className={cn(
                "relative size-2 rounded-full",
                open ? "bg-emerald-400" : "bg-neutral-400",
              )}
            />
          </span>
          {open ? ui.availableNow : ui.outsideHours}
        </p>
      </div>
      <div className="border-t border-neutral-200 pt-5 text-subheadline text-neutral-600">
        <p className="font-medium text-neutral-950">{availability.hoursLabel}</p>
        <p className="mt-1">{availability.responseTime}</p>
      </div>
    </div>
  );
}
