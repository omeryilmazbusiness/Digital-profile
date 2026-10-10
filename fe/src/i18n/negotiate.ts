import { defaultLocale, isLocale, type Locale } from "./locales";

/**
 * The language to open the site in for a visitor who didn't name one: the one they read it in
 * last (cookie), else their browser's most preferred language we publish, else the default.
 */
export function negotiateLocale({
  cookie,
  acceptLanguage,
}: {
  cookie?: string;
  acceptLanguage?: string | null;
}): Locale {
  if (isLocale(cookie)) return cookie;
  for (const tag of preferredLanguages(acceptLanguage ?? "")) {
    const primary = tag.split("-")[0]?.toLowerCase();
    if (isLocale(primary)) return primary;
  }
  return defaultLocale;
}

/** Accept-Language tags, most preferred first ("ar-SA,ar;q=0.9,en;q=0.5"). */
function preferredLanguages(header: string): string[] {
  return header
    .split(",")
    .map((part, index) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { tag: tag.trim(), weight: q ? Number(q.slice(2)) : 1, index };
    })
    .filter(({ tag, weight }) => tag !== "" && tag !== "*" && weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index)
    .map(({ tag }) => tag);
}
