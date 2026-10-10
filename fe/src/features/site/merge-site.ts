import type { Locale } from "@/i18n/locales";
import type { Schemas } from "@/lib/api/client";

import type { ContentSection, Portrait, SiteContent, SiteDocument } from "./content";
import type { PublicSite } from "./site-api";

type Content = Omit<SiteContent, "ui">;
type PublicProfile = Schemas["PublicProfile"];
type PublicImage = Schemas["PublicImage"];

/**
 * Lays what the admin panel published over the built-in content: each part the admin has
 * filled in (topics, the tour link, the profile) replaces its built-in counterpart, and
 * anything not yet entered keeps showing the built-in edition, so the page is never empty.
 */
export function mergeSite(base: Content, site: PublicSite, locale: Locale): Content {
  let content: Content = base;
  if (site.sections.length > 0) {
    content = { ...content, sections: site.sections.map(toSection) };
  }
  if (site.tour) {
    content = { ...content, tour: { ...content.tour, url: site.tour.url } };
  }
  if (site.profile) {
    content = withProfile(content, site.profile, locale);
  }
  return content;
}

function toSection(section: PublicSite["sections"][number]): ContentSection {
  return {
    id: section.id,
    eyebrow: section.eyebrow,
    title: section.title,
    body: section.body,
    documents: section.documents.map((d): SiteDocument => ({
      id: d.id,
      title: d.title,
      language: d.language,
      url: d.url,
      downloadUrl: d.downloadUrl,
      fileName: d.fileName,
      sizeBytes: d.byteSize,
      pages: d.pageCount,
      updatedAt: d.updatedAt,
    })),
  };
}

function withProfile(content: Content, p: PublicProfile, locale: Locale): Content {
  const card = content.contact.profile;
  const phone = p.phone ?? p.whatsapp ?? card.phone;
  const whatsappUrl =
    p.whatsapp?.url ?? (p.phone ? `https://wa.me/${p.phone.e164.slice(1)}` : card.whatsappUrl);
  const paragraphs = p.bio
    ?.split(/\n\s*\n/)
    .map((s) => s.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);

  const hotel = { ...content.hotel };
  if (p.address) {
    const { street, city, postalCode, country } = p.address;
    hotel.postalAddress = { street, city, postalCode: postalCode || undefined, country };
    const separator = locale === "ar" ? "، " : ", ";
    hotel.address = [street, [city, postalCode].filter(Boolean).join(" "), country]
      .filter(Boolean)
      .join(separator);
  }
  if (p.mapUrl) hotel.mapUrl = p.mapUrl;

  const social = p.linkedinUrl
    ? [
        { label: "LinkedIn", href: p.linkedinUrl },
        ...content.profile.social.filter((s) => s.label !== "LinkedIn"),
      ]
    : content.profile.social;

  const portrait = p.portrait ? toPortrait(p.portrait, card.portrait) : card.portrait;
  // The menu's link to the card shows the person: their name and picture.
  const nav = content.nav.map((item) =>
    item.href === card.href
      ? { ...item, label: p.displayName, image: portrait?.avatar ?? item.image }
      : item,
  );

  return {
    ...content,
    hotel,
    nav,
    contact: {
      ...content.contact,
      profile: {
        ...card,
        name: p.displayName,
        givenName: p.firstName,
        familyName: p.lastName,
        title: p.title,
        tagline: p.tagline ?? card.tagline,
        languages: p.languages,
        phone: { e164: phone.e164, display: phone.display },
        email: p.email ?? card.email,
        whatsappUrl,
        portrait,
        organization: p.organization || card.organization,
        businessCardHref: p.businessCardUrl ?? card.businessCardHref,
      },
    },
    profile: {
      ...content.profile,
      about: paragraphs?.length ? { ...content.profile.about, paragraphs } : content.profile.about,
      social,
    },
  };
}

/** An uploaded portrait in the shape of a prepared one: every variant for srcset. */
function toPortrait(image: PublicImage, prepared: Portrait | undefined): Portrait {
  const variants = [...image.variants].sort((a, b) => a.width - b.width);
  const largest = variants.at(-1)!;
  const main = variants.find((v) => v.width >= 960) ?? largest;
  return {
    src: main.url,
    srcSet: variants.map((v) => `${v.url} ${v.width}w`).join(", "),
    width: image.width,
    height: image.height,
    alt: image.alt ?? prepared?.alt ?? "",
    avatar: variants[0]!.url,
    ogImage: largest.url,
  };
}
