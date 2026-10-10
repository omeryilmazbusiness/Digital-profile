import type { Locale } from "./locales";

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
  /** "QR code for {url}" */
  qrFor: string;
}

const en: UiStrings = {
  formatLocale: "en",
  skipToContent: "Skip to content",
  homeLink: "{hotel} — home",
  mainNav: "Main",
  menu: "Menu",
  openMenu: "Open menu",
  closeMenu: "Close menu",
  explore: "Explore",
  contact: "Contact",
  language: "Language",
  opensInNewTab: "(opens in a new tab)",
  opensInNewTabShort: "Opens in a new tab",
  loading: "Loading",
  notifications: "Notifications",
  scroll: "Scroll",
  welcomeTo: "Welcome to",
  documentsOf: "{title}: documents",
  preview: "Preview",
  download: "Download",
  previewDocument: "Preview: {title} (opens in a new tab)",
  downloadDocument: "Download: {title}",
  pages: { one: "{n} page", other: "{n} pages" },
  updated: "Updated {date}",
  call: "Call",
  whatsapp: "WhatsApp",
  email: "Email",
  save: "Save",
  saveContact: "Save contact",
  callName: "Call {name}",
  messageName: "Message {name} on WhatsApp (opens WhatsApp)",
  emailName: "Email {name}",
  saveName: "Save {name} to your contacts",
  contactName: "Contact {name}",
  mobile: "Mobile",
  office: "Office",
  languages: "Languages",
  speaks: "Speaks:",
  introduction: "Introduction",
  atAGlance: "At a glance",
  onNetwork: "{name} on {network}",
  localTime: "Local time",
  availableNow: "Available now",
  outsideHours: "Outside office hours",
  shareCard: "Share this card",
  saveBusinessCard: "Save business card",
  linkCopied: "Link copied",
  copyFailed: "Couldn't copy the link",
  qrFor: "QR code for {url}",
};

const ar: UiStrings = {
  formatLocale: "ar-u-nu-latn",
  skipToContent: "انتقل إلى المحتوى",
  homeLink: "{hotel} — الصفحة الرئيسية",
  mainNav: "القائمة الرئيسية",
  menu: "القائمة",
  openMenu: "فتح القائمة",
  closeMenu: "إغلاق القائمة",
  explore: "استكشف",
  contact: "التواصل",
  language: "اللغة",
  opensInNewTab: "(يفتح في علامة تبويب جديدة)",
  opensInNewTabShort: "يفتح في علامة تبويب جديدة",
  loading: "جارٍ التحميل",
  notifications: "الإشعارات",
  scroll: "مرّر",
  welcomeTo: "مرحباً بكم في",
  documentsOf: "{title}: المستندات",
  preview: "معاينة",
  download: "تنزيل",
  previewDocument: "معاينة: {title} (يفتح في علامة تبويب جديدة)",
  downloadDocument: "تنزيل: {title}",
  pages: {
    zero: "{n} صفحة",
    one: "صفحة واحدة",
    two: "صفحتان",
    few: "{n} صفحات",
    many: "{n} صفحة",
    other: "{n} صفحة",
  },
  updated: "حُدّث {date}",
  call: "اتصال",
  whatsapp: "واتساب",
  email: "البريد",
  save: "حفظ",
  saveContact: "حفظ جهة الاتصال",
  callName: "الاتصال بـ{name}",
  messageName: "مراسلة {name} عبر واتساب (يفتح واتساب)",
  emailName: "مراسلة {name} بالبريد الإلكتروني",
  saveName: "حفظ {name} في جهات الاتصال",
  contactName: "التواصل مع {name}",
  mobile: "الجوال",
  office: "المكتب",
  languages: "اللغات",
  speaks: "يتحدث:",
  introduction: "تعريف",
  atAGlance: "لمحة سريعة",
  onNetwork: "{name} على {network}",
  localTime: "التوقيت المحلي",
  availableNow: "متاح الآن",
  outsideHours: "خارج ساعات العمل",
  shareCard: "مشاركة البطاقة",
  saveBusinessCard: "حفظ بطاقة العمل",
  linkCopied: "تم نسخ الرابط",
  copyFailed: "تعذّر نسخ الرابط",
  qrFor: "رمز QR لـ {url}",
};

const strings: Partial<Record<Locale, UiStrings>> = { en, ar };

/** Languages the site is translated into; the others are served in English. */
export const translatedLocales = Object.keys(strings) as Locale[];

export function uiStrings(locale: Locale): UiStrings {
  return strings[locale] ?? en;
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
