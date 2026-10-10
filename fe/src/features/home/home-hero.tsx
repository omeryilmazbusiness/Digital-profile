import { ScrollCanvasVideo, type Scene } from "@/components/scroll/scroll-canvas-video";
import { SceneCard } from "@/components/scroll/scene-card";
import { Handwriting } from "@/components/signature/handwriting";

import { heroFrames } from "./hero-frames.gen";
import { hotelSignatures } from "./hotel-signature.gen";

export const HOTEL_NAME = "Sheraton Makkah Jabal Al Kaaba";

// Placeholder copy until localized content arrives from the CMS (FE-02, CNT-*).
const scenes: readonly Scene[] = [
  {
    id: "arrival",
    start: 0,
    end: 0.2,
    align: "center",
    content: (
      <div className="relative flex w-full flex-col items-center text-center text-white">
        {/* Keeps the white ink legible over bright footage; leaves with the scene. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-x-[40vw] -inset-y-32 bg-[radial-gradient(closest-side,rgb(0_0_0/0.62),rgb(0_0_0/0.3)_55%,transparent)]"
        />
        <p className="relative text-caption-1 font-medium tracking-[0.42em] text-white/75 uppercase">
          Welcome to
        </p>
        <h1 className="sr-only">{HOTEL_NAME}</h1>
        <Handwriting signatures={hotelSignatures} className="relative mt-6 w-[min(88vw,46rem)]" />
        <p className="relative mt-8 max-w-xs text-subheadline text-pretty text-white/80 sm:max-w-sm sm:text-body">
          Moments from Masjid al-Haram. Scroll to step inside.
        </p>
        <ScrollHint />
      </div>
    ),
  },
  {
    id: "welcome",
    start: 0.3,
    end: 0.5,
    align: "center",
    content: (
      <SceneCard eyebrow="For travel partners" title="Every pilgrim, received with care">
        <p>
          Dedicated support for Umrah and Hajj groups — from the first enquiry to the final
          farewell.
        </p>
      </SceneCard>
    ),
  },
  {
    id: "lobby",
    start: 0.6,
    end: 0.9,
    content: (
      <SceneCard eyebrow="Inside" title="A calm arrival after a long journey">
        <p>
          Smooth group check-in, multilingual service and one point of contact for every booking.
        </p>
      </SceneCard>
    ),
  },
];

/** The home page opening: the hotel name writes itself, then the walk into the lobby. */
export function HomeHero() {
  return (
    <div data-header-overlay="">
      <ScrollCanvasVideo
        sequence={heroFrames}
        scenes={scenes}
        label={`Walking from the entrance of ${HOTEL_NAME} into its lobby`}
        length={4}
        scrub={0.5}
      />
    </div>
  );
}

function ScrollHint() {
  return (
    <div aria-hidden className="relative mt-12 flex flex-col items-center gap-3">
      <span className="text-caption-2 font-medium tracking-[0.32em] text-white/60 uppercase">
        Scroll
      </span>
      <span className="relative h-12 w-px overflow-hidden bg-white/20">
        <span className="absolute inset-x-0 top-0 h-1/2 animate-scroll-hint bg-linear-to-b from-transparent to-white" />
      </span>
    </div>
  );
}
