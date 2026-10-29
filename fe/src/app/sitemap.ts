import type { MetadataRoute } from "next";

import { locales } from "@/i18n/locales";
import { hubHref, hubLanguageAlternates, languageAlternates, localizeHref } from "@/i18n/routing";
import { siteUrl } from "@/lib/site-url";

const pages = ["/", "/momen"] as const;

/** Every page in every language, each listing its translations. Empty without a public origin. */
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteUrl();
  if (!origin) return [];
  const absolute = (path: string) => new URL(path, origin).href;
  const languages = (map: Record<string, string>) =>
    Object.fromEntries(Object.entries(map).map(([lang, path]) => [lang, absolute(path)]));
  return [
    ...pages.flatMap((page) =>
      locales.map((locale) => ({
        url: absolute(localizeHref(locale, page)),
        alternates: { languages: languages(languageAlternates(page)) },
      })),
    ),
    ...locales.map((locale) => ({
      url: absolute(hubHref(locale)),
      alternates: { languages: languages(hubLanguageAlternates()) },
    })),
  ];
}
