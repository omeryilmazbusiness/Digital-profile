import { ChevronDown } from "lucide-react";

import { SceneCard } from "@/components/scroll/scene-card";
import { ScrollCanvasVideo, type Scene } from "@/components/scroll/scroll-canvas-video";

import { heroFrames } from "./hero-frames.gen";

export const HOTEL_NAME = "Sheraton Makkah Jabal Al Kaaba";

// Placeholder copy until localized content arrives from the CMS (FE-02, CNT-*).
const scenes: readonly Scene[] = [
  {
    id: "arrival",
    start: 0,
    end: 0.2,
    content: (
      <SceneCard eyebrow="Digital sales experience" title={HOTEL_NAME} level={1}>
        <p>Moments from Masjid al-Haram. Scroll to step inside.</p>
        <ChevronDown
          aria-hidden
          className="mx-auto mt-6 size-6 text-white/70 motion-safe:animate-bounce"
        />
      </SceneCard>
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

/** The home page opening: the walk from the hotel entrance into the lobby. */
export function HomeHero() {
  return (
    <ScrollCanvasVideo
      sequence={heroFrames}
      scenes={scenes}
      label={`Walking from the entrance of ${HOTEL_NAME} into its lobby`}
      loaderTitle={HOTEL_NAME}
      length={4}
      scrub={0.5}
    />
  );
}
