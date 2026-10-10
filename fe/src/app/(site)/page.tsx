import { HOTEL_NAME, HomeHero } from "@/features/home/home-hero";
import { heroFrames } from "@/features/home/hero-frames.gen";
import { ContactSection } from "@/features/site/contact-section";
import { getSiteContent } from "@/features/site/content";
import { DiscoverSection } from "@/features/site/discover-section";
import { TourSection } from "@/features/site/tour-section";

export default async function Home() {
  const { discover, sections, tour, contact } = await getSiteContent();
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
      <ContactSection contact={contact} />
    </main>
  );
}
