import { vcardPhoto } from "@/features/profile/vcard-photo.gen";
import { getSiteContent } from "@/features/site/content";
import { fetchProfileVCard } from "@/features/site/site-api";
import { siteUrl } from "@/lib/site-url";
import { attachmentDisposition, buildVCard } from "@/lib/vcard";

import { localeOf } from "../../../locale";

export { generateStaticParams } from "../../../locale";

const headers = {
  "Content-Type": "text/vcard; charset=utf-8",
  "Cache-Control": "public, max-age=300",
};

/**
 * The contact card behind "Save contact": opens the address book on phones. The published
 * profile's card (photo and address as set in the admin panel) when there is one, otherwise
 * one built from the site's content.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/sheraton/[locale]/momen/vcard">,
) {
  const locale = await localeOf(params);
  const published = await fetchProfileVCard(locale);
  if (published) {
    return new Response(published.body, {
      headers: { ...headers, "Content-Disposition": published.disposition },
    });
  }

  const { hotel, contact } = await getSiteContent(locale);
  const { profile } = contact;
  const origin = siteUrl();

  const card = buildVCard({
    givenName: profile.givenName,
    familyName: profile.familyName,
    fullName: profile.name,
    organization: hotel.name,
    title: profile.title,
    phones: [{ e164: profile.phone.e164 }],
    email: profile.email,
    url: origin ? new URL(profile.href, origin).href : undefined,
    address: hotel.postalAddress,
    photo: profile.portrait ? vcardPhoto : undefined,
  });

  return new Response(card, {
    headers: { ...headers, "Content-Disposition": attachmentDisposition(`${profile.name}.vcf`) },
  });
}
