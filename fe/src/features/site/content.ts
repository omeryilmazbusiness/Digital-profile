import { mockSiteContent } from "./mock-content";

/** Languages the site and its documents are published in. */
export type ContentLanguage = "en" | "ar" | "id";

export interface NavItem {
  label: string;
  /** In-page anchor, e.g. "#tour". */
  href: `#${string}`;
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

export interface ContactProfile {
  name: string;
  title: string;
  tagline: string;
  languages: readonly ContentLanguage[];
  phone: { e164: string; display: string };
  email: string;
  /** wa.me link with the prepared greeting. */
  whatsappUrl: string;
  portraitUrl?: string;
}

export interface SiteContent {
  hotel: { name: string; address: string; mapUrl: string };
  nav: readonly NavItem[];
  discover: { eyebrow: string; title: string; body: string; note: string };
  sections: readonly ContentSection[];
  tour: VirtualTour;
  contact: { eyebrow: string; title: string; body: string; profile: ContactProfile };
  footer: { tagline: string; privacy: string; credit?: string };
}

/**
 * Everything the public page shows. Mock data for now; it becomes the single
 * `GET /public/site?locale=` request (SET-03), so components don't change when it does.
 */
export async function getSiteContent(): Promise<SiteContent> {
  return mockSiteContent;
}
