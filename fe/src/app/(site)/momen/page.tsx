import type { Metadata } from "next";

import { getSiteContent } from "@/features/site/content";
import { LandingPage } from "@/features/site/landing-page";

export async function generateMetadata(): Promise<Metadata> {
  const { hotel, contact } = await getSiteContent();
  const { profile } = contact;
  const title = `${profile.name} — ${profile.title}`;
  const description = `${profile.tagline} ${hotel.name}.`;
  return {
    title,
    description,
    alternates: { canonical: profile.href },
    openGraph: {
      type: "profile",
      title,
      description,
      url: profile.href,
      firstName: profile.givenName,
      lastName: profile.familyName,
      images: profile.portrait
        ? [{ url: profile.portrait.ogImage, width: 1200, height: 630, alt: profile.name }]
        : undefined,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

/** Momen's business card: the landing page, opened at the card. */
export default async function ProfilePage() {
  return <LandingPage content={await getSiteContent()} />;
}
