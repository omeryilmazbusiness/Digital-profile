import type { Metadata } from "next";

import { getSiteContent } from "@/features/site/content";
import { SocialHub } from "@/features/social-hub/social-hub";
import { hubHref, hubLanguageAlternates } from "@/i18n/routing";

import { localeOf } from "../locale";

export const instant = false;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/social-media">): Promise<Metadata> {
  const locale = await localeOf(params);
  const { hotel, footer } = await getSiteContent(locale);
  return {
    title: hotel.name,
    description: footer.tagline,
    alternates: {
      canonical: hubHref(locale),
      languages: hubLanguageAlternates(),
    },
  };
}

export default async function SocialMediaPage({ params }: PageProps<"/[locale]/social-media">) {
  const locale = await localeOf(params);
  const { hotel, hero, ui } = await getSiteContent(locale);
  return <SocialHub hotelName={hotel.name} filmLabel={hero.film} ui={ui} />;
}
