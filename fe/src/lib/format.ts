import { isLocale, nativeNames } from "@/i18n/locales";

/** "2.4 MB", "820 KB": binary units, as file browsers show them. */
export function formatFileSize(bytes: number, locale = "en"): string {
  const units = ["byte", "kilobyte", "megabyte", "gigabyte"] as const;
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: units[unit],
    unitDisplay: "short",
    maximumFractionDigits: unit >= 2 ? 1 : 0,
  }).format(value);
}

/** "Sep 2026". Formatted in UTC so server and browser agree. */
export function formatMonthYear(isoDate: string, locale = "en"): string {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(isoDate));
}

/** A language's name in that language: "English", "العربية", "Bahasa Indonesia". */
export function languageName(code: string): string {
  if (isLocale(code)) return nativeNames[code];
  try {
    return new Intl.DisplayNames([code], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}
