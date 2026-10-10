import { ArrivalScript } from "@/components/scroll/arrival-script";
import { ArrivalScroll } from "@/components/scroll/arrival-scroll";
import { HomeHero } from "@/features/home/home-hero";
import { heroFrames } from "@/features/home/hero-frames.gen";
import { displayFont } from "@/features/profile/fonts";
import { ProfileSection } from "@/features/profile/profile-section";

import type { SiteContent } from "./content";
import { DiscoverSection } from "./discover-section";
import { TourSection } from "./tour-section";

/**
 * The public site as one page: the film, the hotel, the tour, and Momen's business card.
 * Served at the site's home (/sheraton/<locale>) and at the card's own address, which opens it
 * at the card.
 */
export function LandingPage({ content }: { content: SiteContent }) {
  const { locale, discover, sections, tour, home, footer, hotel, hero, ui } = content;
  return (
    <main id="main" data-path={home} data-landing="" className={displayFont.variable}>
      <HomeHero locale={locale} hotelName={hotel.name} hero={hero} ui={ui} credit={footer.credit} />
      <DiscoverSection discover={discover} sections={sections} ui={ui} />
      <TourSection
        tour={tour}
        ui={ui}
        backdrop={{
          sequence: heroFrames,
          frame: heroFrames.count - 1,
          alt: hero.lobbyAlt,
        }}
      />
      <ProfileSection content={content} />
      <ArrivalScript />
      <ArrivalScroll />
    </main>
  );
}
