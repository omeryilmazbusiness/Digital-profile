import type { SiteContent } from "@/features/site/content";
import { siteUrl } from "@/lib/site-url";
import { cn } from "@/lib/utils";

import { ContactDock } from "./contact-dock";
import { displayFont } from "./fonts";
import { PROFILE_CLOSING_ID, ProfileContent } from "./profile-content";
import { PROFILE_INTRO_ID, ProfileIntro } from "./profile-intro";
import { profileSignatures } from "./profile-signature.gen";

/**
 * Momen's digital business card, the landing page's last chapter. It also has an address of
 * its own (`contact.profile.href`, e.g. /momen) that opens the page right here.
 */
export function ProfileSection({ content }: { content: SiteContent }) {
  const { hotel, contact, profile } = content;
  const card = contact.profile;
  const origin = siteUrl();

  return (
    <div
      id={card.href.slice(1)}
      data-path={card.href}
      data-theme="light"
      className={cn(
        displayFont.variable,
        "bg-white text-neutral-950 selection:bg-neutral-950/10",
        // The opening pins at the very top, under the header: land exactly there.
        "scroll-mt-[calc(-1*(var(--nav-height)+env(safe-area-inset-top,0px)))]",
      )}
    >
      <PersonJsonLd card={card} organization={hotel.name} origin={origin} />
      <ProfileIntro
        profile={card}
        organization={hotel.name}
        eyebrow={profile.eyebrow}
        signature={profileSignatures[0]!}
      />
      <ProfileContent
        card={card}
        profile={profile}
        hotel={hotel}
        shareUrl={origin ? new URL(card.href, origin).href : card.href}
      />
      <ContactDock profile={card} afterId={PROFILE_INTRO_ID} hideWhileId={PROFILE_CLOSING_ID} />
    </div>
  );
}

/** schema.org Person, so search engines can show the card's details. */
function PersonJsonLd({
  card,
  organization,
  origin,
}: {
  card: SiteContent["contact"]["profile"];
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
