import { ArrivalScroll } from "@/components/scroll/arrival-scroll";
import { HOTEL_NAME, HomeHero } from "@/features/home/home-hero";
import { heroFrames } from "@/features/home/hero-frames.gen";
import { ProfileSection } from "@/features/profile/profile-section";

import type { SiteContent } from "./content";
import { DiscoverSection } from "./discover-section";
import { TourSection } from "./tour-section";

/**
 * The public site as one page: the film, the hotel, the tour, and Momen's business card.
 * Served at "/" and at the card's own address, which opens it at the card.
 */
export function LandingPage({ content }: { content: SiteContent }) {
  const { discover, sections, tour } = content;
  return (
    <main id="main">
      <HomeHero />
      <DiscoverSection discover={discover} sections={sections} />
      <TourSection
        tour={tour}
        backdrop={{
          sequence: heroFrames,
          frame: heroFrames.count - 1,
          alt: `The lobby of ${HOTEL_NAME}`,
        }}
      />
      <ProfileSection content={content} />
      <ArrivalScroll />
    </main>
  );
}
