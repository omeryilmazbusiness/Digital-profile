import type { Metadata } from "next";

import { ContactDock } from "@/features/profile/contact-dock";
import { displayFont } from "@/features/profile/fonts";
import { PROFILE_CLOSING_ID, ProfileContent } from "@/features/profile/profile-content";
import { PROFILE_INTRO_ID, ProfileIntro } from "@/features/profile/profile-intro";
import { profileSignatures } from "@/features/profile/profile-signature.gen";
import { getSiteContent } from "@/features/site/content";
import { siteUrl } from "@/lib/site-url";
import { cn } from "@/lib/utils";

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

/** Momen's digital business card. */
export default async function ProfilePage() {
  const { hotel, contact, profile } = await getSiteContent();
  const card = contact.profile;
  const origin = siteUrl();
  const signature = profileSignatures[0]!;

  return (
    <main
      id="main"
      data-theme="light"
      className={cn(displayFont.variable, "bg-white text-neutral-950 selection:bg-neutral-950/10")}
    >
      <PersonJsonLd card={card} organization={hotel.name} origin={origin} />
      <ProfileIntro
        profile={card}
        organization={hotel.name}
        eyebrow={profile.eyebrow}
        signature={signature}
      />
      <ProfileContent
        card={card}
        profile={profile}
        hotel={hotel}
        shareUrl={origin ? new URL(card.href, origin).href : card.href}
      />
      <ContactDock profile={card} afterId={PROFILE_INTRO_ID} hideWhileId={PROFILE_CLOSING_ID} />
    </main>
  );
}

/** schema.org Person, so search engines can show the card's details. */
function PersonJsonLd({
  card,
  organization,
  origin,
}: {
  card: Awaited<ReturnType<typeof getSiteContent>>["contact"]["profile"];
  organization: string;
  origin: URL | undefined;
}) {
  const absolute = (path: string) => (origin ? new URL(path, origin).href : undefined);
  const data = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: card.name,
    givenName: card.givenName,
    familyName: card.familyName,
    jobTitle: card.title,
    worksFor: { "@type": "Hotel", name: organization },
    telephone: card.phone.e164,
    email: `mailto:${card.email}`,
    knowsLanguage: card.languages,
    url: absolute(card.href),
    image: card.portrait ? absolute(card.portrait.src) : undefined,
  };
  return (
    <script
      type="application/ld+json"
      // JSON can't close the script element once "<" is escaped.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
