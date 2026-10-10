import { mockSiteContent } from "./mock-content";

/** Languages the site and its documents are published in. */
export type ContentLanguage = "en" | "ar" | "id";

/** A link within the site: an anchor on the home page ("/#tour") or a page ("/momen"). */
export type SiteHref = `/${string}`;

export interface NavItem {
  label: string;
  href: SiteHref;
  /** Small round picture shown with the link, e.g. a person's portrait. */
  image?: string;
  /** One line under the label in the phone menu. */
  caption?: string;
}

export interface SiteDocument {
  id: string;
  title: string;
  /** The language the PDF itself is written in; interface translation doesn't change it. */
  language: ContentLanguage;
  url: string;
  /** Suggested name when downloading. */
  fileName: string;
  sizeBytes: number;
  pages: number;
  /** ISO date of the last file update. */
  updatedAt: string;
}

/** A topic on the page, with the documents that go deeper. */
export interface ContentSection {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  documents: readonly SiteDocument[];
}

export interface VirtualTour {
  eyebrow: string;
  title: string;
  body: string;
  url: string;
  cta: string;
}

/** A portrait prepared for a white page (scripts/prepare-portrait.mjs). */
export interface Portrait {
  src: string;
  /** Every width, for srcset. */
  srcSet: string;
  width: number;
  height: number;
  alt: string;
  /** Small square crop of the face. */
  avatar: string;
  /** 1200×630 sharing image. */
  ogImage: string;
}

export interface ContactProfile {
  name: string;
  /** Name parts for the address book. */
  givenName: string;
  familyName: string;
  title: string;
  tagline: string;
  languages: readonly ContentLanguage[];
  phone: { e164: string; display: string };
  email: string;
  /** wa.me link with the prepared greeting. */
  whatsappUrl: string;
  portrait?: Portrait;
  /** The digital business card page. */
  href: SiteHref;
  /** Downloads the contact card (.vcf). */
  vcardHref: SiteHref;
}

export interface ProfileStat {
  value: number;
  prefix?: string;
  suffix?: string;
  label: string;
}

export type ProfileServiceIcon = "groups" | "allotments" | "vip" | "events";

export interface ProfileService {
  icon: ProfileServiceIcon;
  title: string;
  body: string;
}

export type ProfileLink = { label: string; description: string } & (
  { href: SiteHref; external?: false } | { href: string; external: true }
);

/** Office hours, evaluated in the office's time zone whatever the visitor's. */
export interface Availability {
  /** IANA zone, e.g. "Asia/Riyadh". */
  timeZone: string;
  /** Shown next to the local time, e.g. "Makkah". */
  place: string;
  /** Working days, 0 = Sunday. */
  days: readonly number[];
  /** "HH:MM", 24-hour. */
  opens: string;
  closes: string;
  hoursLabel: string;
  responseTime: string;
}

/** The sales contact's digital business card page. */
export interface DigitalProfile {
  eyebrow: string;
  statement: string;
  stats: readonly ProfileStat[];
  about: { eyebrow: string; title: string; paragraphs: readonly string[] };
  services: { eyebrow: string; title: string; items: readonly ProfileService[] };
  reach: { eyebrow: string; title: string };
  availability: Availability;
  resources: { eyebrow: string; title: string; links: readonly ProfileLink[] };
  social: readonly { label: string; href: string }[];
  share: { eyebrow: string; title: string; body: string };
  closing: { title: string; body: string; cta: string };
}

export interface SiteContent {
  hotel: {
    name: string;
    address: string;
    /** The same address in parts, for contact cards. */
    postalAddress: { street: string; city: string; postalCode?: string; country: string };
    mapUrl: string;
  };
  nav: readonly NavItem[];
  discover: { eyebrow: string; title: string; body: string; note: string };
  sections: readonly ContentSection[];
  tour: VirtualTour;
  contact: { eyebrow: string; title: string; body: string; profile: ContactProfile };
  profile: DigitalProfile;
  footer: { tagline: string; privacy: string; credit?: string };
}

/**
 * Everything the public page shows. Mock data for now; it becomes the single
 * `GET /public/site?locale=` request (SET-03), so components don't change when it does.
 */
export async function getSiteContent(): Promise<SiteContent> {
  return mockSiteContent;
}
