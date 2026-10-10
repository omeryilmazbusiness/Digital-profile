import type { Locale } from "./locales";
import { ar } from "./messages/ar";
import { en } from "./messages/en";
import { id } from "./messages/id";

/**
 * The interface's own words — buttons, labels, announcements — in each translated language.
 * `{name}`-style placeholders are filled with `fill`. Plain strings only: client components
 * receive them as props.
 */
export interface UiStrings {
  /** Locale for numbers and dates: Arabic keeps Western digits, as on the hotel's documents. */
  formatLocale: string;
  skipToContent: string;
  /** "{hotel} — home" */
  homeLink: string;
  mainNav: string;
  menu: string;
  openMenu: string;
  closeMenu: string;
  explore: string;
  contact: string;
  language: string;
  opensInNewTab: string;
  opensInNewTabShort: string;
  loading: string;
  notifications: string;
  scroll: string;
  welcomeTo: string;

  // Documents
  /** "{title}: documents" */
  documentsOf: string;
  preview: string;
  download: string;
  /** "Preview: {title} (opens in a new tab)" */
  previewDocument: string;
  /** "Download: {title}" */
  downloadDocument: string;
  /** Page counts by plural category (Intl.PluralRules); "{n}" is the count. */
  pages: Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };
  /** "Updated {date}" */
  updated: string;

  // Contact
  call: string;
  whatsapp: string;
  email: string;
  save: string;
  saveContact: string;
  /** "Call {name}" */
  callName: string;
  /** "Message {name} on WhatsApp (opens WhatsApp)" */
  messageName: string;
  /** "Email {name}" */
  emailName: string;
  /** "Save {name} to your contacts" */
  saveName: string;
  /** "Contact {name}" */
  contactName: string;
  mobile: string;
  office: string;
  languages: string;
  speaks: string;

  // Profile
  introduction: string;
  atAGlance: string;
  /** "{name} on {network}" */
  onNetwork: string;
  localTime: string;
  availableNow: string;
  outsideHours: string;
  shareCard: string;
  saveBusinessCard: string;
  linkCopied: string;
  copyFailed: string;
}

const strings: Record<Locale, UiStrings> = { en, ar, id };

/** Languages the interface is translated into, in the order the language menu lists them. */
export const translatedLocales = Object.keys(strings) as Locale[];

export function uiStrings(locale: Locale): UiStrings {
  return strings[locale];
}
/** Fills `{key}` placeholders: fill("Call {name}", { name: "Momen" }). */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

/** "8 pages", "صفحتان". */
export function pageCount(ui: UiStrings, n: number): string {
  const category = new Intl.PluralRules(ui.formatLocale).select(n);
  return fill(ui.pages[category] ?? ui.pages.other, { n });
}
