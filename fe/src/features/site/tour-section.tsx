import { ArrowUpRight, Rotate3d } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/motion";
import { frameUrl, type FrameSequence } from "@/lib/frame-sequence";

import type { UiStrings } from "@/i18n/ui";

import type { VirtualTour } from "./content";

interface TourSectionProps {
  tour: VirtualTour;
  ui: UiStrings;
  /** Footage the backdrop is taken from, and which frame. */
  backdrop: { sequence: FrameSequence; frame: number; alt: string };
}

/** The 360° tour: a full-bleed still with a slow drift, and the link out to the tour. */
export function TourSection({ tour, ui, backdrop }: TourSectionProps) {
  const { sequence, frame, alt } = backdrop;
  return (
    <section
      id="tour"
      aria-labelledby="tour-title"
      data-header-overlay=""
      // Full bleed under the transparent header: cancel the page's header scroll padding.
      className="relative isolate scroll-mt-[calc(-1*var(--nav-height)-env(safe-area-inset-top,0px))] overflow-hidden bg-black text-white"
    >
      <picture>
        <source media="(orientation: portrait)" srcSet={frameUrl(sequence, "portrait", frame)} />
        <img
          src={frameUrl(sequence, "landscape", frame)}
          alt={alt}
          width={sequence.sets.landscape.width}
          height={sequence.sets.landscape.height}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 -z-10 size-full animate-ken-burns object-cover opacity-75"
        />
      </picture>
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-linear-to-t from-black/85 via-black/35 to-black/55"
      />

      <div className="mx-auto flex min-h-[85dvh] max-w-6xl flex-col justify-end px-safe-5 pt-28 pb-20 md:justify-center md:pb-28">
        <Reveal className="max-w-xl">
          <p className="flex items-center gap-2 text-caption-1 font-semibold tracking-[0.24em] text-white/70 uppercase">
            <Rotate3d aria-hidden className="size-4" strokeWidth={1.75} />
            {tour.eyebrow}
          </p>
          <h2
            id="tour-title"
            className="mt-5 text-[2.5rem] leading-[1.05] font-semibold tracking-tight text-balance md:text-6xl"
          >
            {tour.title}
          </h2>
          <p className="mt-5 text-body text-pretty text-white/75 md:text-title-3 md:font-normal">
            {tour.body}
          </p>
          <div className="mt-9 flex flex-col items-start gap-3">
            <Button asChild size="lg" variant="glass">
              <a href={tour.url} target="_blank" rel="noopener noreferrer">
                {tour.cta}
                <ArrowUpRight aria-hidden />
              </a>
            </Button>
            <p className="text-caption-1 text-white/55">{ui.opensInNewTabShort}</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
