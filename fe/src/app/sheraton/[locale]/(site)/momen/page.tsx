import type { Metadata } from "next";

import { getSiteContent } from "@/features/site/content";
import { LandingPage } from "@/features/site/landing-page";
import { languageAlternates } from "@/i18n/routing";

import { localeOf } from "../../locale";

export async function generateMetadata({
  params,
}: PageProps<"/sheraton/[locale]/momen">): Promise<Metadata> {
  const { hotel, contact } = await getSiteContent(await localeOf(params));
  const { profile } = contact;
  const title = `${profile.name} — ${profile.title}`;
  const description = `${profile.tagline} ${hotel.name}.`;
  return {
    title,
    description,
    alternates: { canonical: profile.href, languages: languageAlternates("/momen") },
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
export default async function ProfilePage({ params }: PageProps<"/sheraton/[locale]/momen">) {
  return <LandingPage content={await getSiteContent(await localeOf(params))} />;
}
