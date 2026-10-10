import { vcardPhoto } from "@/features/profile/vcard-photo.gen";
import { getSiteContent } from "@/features/site/content";
import { siteUrl } from "@/lib/site-url";
import { attachmentDisposition, buildVCard } from "@/lib/vcard";

/**
 * The contact card behind "Save contact": opens the address book on phones. Built from the
 * mock content until the API's /public/profile/vcard takes over (PRF-03).
 */
export async function GET() {
  const { hotel, contact } = await getSiteContent();
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
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": attachmentDisposition(`${profile.name}.vcf`),
      "Cache-Control": "public, max-age=3600",
    },
  });
}
