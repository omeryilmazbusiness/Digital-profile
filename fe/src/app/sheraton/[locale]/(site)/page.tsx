import type { Metadata } from "next";

import { getSiteContent } from "@/features/site/content";
import { LandingPage } from "@/features/site/landing-page";
import { languageAlternates } from "@/i18n/routing";

import { localeOf } from "../locale";

// Allowed to block on navigation, like its layout: the whole page depends on the language.
export const instant = false;

export async function generateMetadata({
  params,
}: PageProps<"/sheraton/[locale]">): Promise<Metadata> {
  const { home, hotel, footer } = await getSiteContent(await localeOf(params));
  return {
    title: hotel.name,
    description: footer.tagline,
    alternates: { canonical: home, languages: languageAlternates("/") },
  };
}

export default async function Home({ params }: PageProps<"/sheraton/[locale]">) {
  return <LandingPage content={await getSiteContent(await localeOf(params))} />;
}
