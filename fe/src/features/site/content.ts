import { defaultLocale, type Locale } from "@/i18n/locales";
import { localizeHref } from "@/i18n/routing";
import { type UiStrings, uiStrings } from "@/i18n/ui";

import { mergeSite } from "./merge-site";
import { mockSiteContent } from "./mock-content";
import { mockSiteContentAr } from "./mock-content.ar";
import { mockSiteContentId } from "./mock-content.id";
import { fetchPublicSite } from "./site-api";

/** Languages the site and its documents are published in. */
export type ContentLanguage = Locale;

/**
 * A link within the site: the landing page ("/"), one of its sections ("/#tour") or a page
 * ("/momen"). Written without a language; `getSiteContent` puts them under the page's.
 */
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
  /** Opens the PDF in the browser. */
  url: string;
  /** Saves the PDF; `url` with the download attribute when absent. */
  downloadUrl?: string;
  /** Suggested name when downloading. */
  fileName: string;
  sizeBytes: number;
  /** Absent when the file doesn't say. */
  pages?: number;
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

/** The opening film: the line under the hotel's name and the two scenes that follow. */
export interface HomeHero {
  lead: string;
  /** What the film shows, for assistive technology. */
  film: string;
  /** The tour's backdrop, a still of the lobby. */
  lobbyAlt: string;
  scenes: readonly { eyebrow: string; title: string; body: string }[];
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
  /** ISO 639-1 codes of the languages spoken, in display order. */
  languages: readonly string[];
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
  /** The language the text is in: the one asked for, or the fallback when it isn't translated. */
  locale: Locale;
  /** The landing page. */
  home: SiteHref;
  hotel: {
    name: string;
    address: string;
    /** The same address in parts, for contact cards. */
    postalAddress: { street: string; city: string; postalCode?: string; country: string };
    mapUrl: string;
  };
  nav: readonly NavItem[];
  hero: HomeHero;
  discover: { eyebrow: string; title: string; body: string; note: string };
  sections: readonly ContentSection[];
  tour: VirtualTour;
  contact: { eyebrow: string; title: string; body: string; profile: ContactProfile };
  profile: DigitalProfile;
  footer: {
    tagline: string;
    privacy: string;
    /** The studio's signature; left out when the site turns it off (SET-02). */
    credit?: SiteCredit;
  };
  /** The interface's own words, in the same language. */
  ui: UiStrings;
}

/** "by widdigroup.com": a short lead-in and the studio's name, linking to its site. */
export interface SiteCredit {
  label: string;
  name: string;
  href: string;
}

/**
 * Everything the public page shows in `locale`, its links pointing at that language's pages:
 * what the admin panel published (`GET /public/site`) over the built-in edition, which also
 * stands in while the API is unreachable.
 */
export async function getSiteContent(locale: Locale = defaultLocale): Promise<SiteContent> {
  const base = mockContent[locale];
  const site = await fetchPublicSite(locale);
  const content = site ? mergeSite(base, site, locale) : base;
  return localizeLinks({ ...content, ui: uiStrings(content.locale) }, locale);
}

/** One edition per language; a new language doesn't type-check until it has one. */
const mockContent: Record<Locale, Omit<SiteContent, "ui">> = {
  en: mockSiteContent,
  ar: mockSiteContentAr,
  id: mockSiteContentId,
};

function localizeLinks(content: SiteContent, locale: Locale): SiteContent {
  const href = (path: SiteHref) => localizeHref(locale, path);
  const { contact, profile } = content;
  return {
    ...content,
    home: href(content.home),
    nav: content.nav.map((item) => ({ ...item, href: href(item.href) })),
    contact: {
      ...contact,
      profile: {
        ...contact.profile,
        href: href(contact.profile.href),
        vcardHref: href(contact.profile.vcardHref),
      },
    },
    profile: {
      ...profile,
      resources: {
        ...profile.resources,
        links: profile.resources.links.map((link) =>
          link.external ? link : { ...link, href: href(link.href) },
        ),
      },
    },
  };
}
