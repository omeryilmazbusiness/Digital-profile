import type { MetadataRoute } from "next";

import { locales } from "@/i18n/locales";
import { languageAlternates, localizeHref } from "@/i18n/routing";
import { siteUrl } from "@/lib/site-url";

const pages = ["/", "/momen"] as const;

/** Every page in every language, each listing its translations. Empty without a public origin. */
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteUrl();
  if (!origin) return [];
  const absolute = (path: string) => new URL(path, origin).href;
  return pages.flatMap((page) =>
    locales.map((locale) => ({
      url: absolute(localizeHref(locale, page)),
      alternates: {
        languages: Object.fromEntries(
          Object.entries(languageAlternates(page)).map(([lang, path]) => [lang, absolute(path)]),
        ),
      },
    })),
  );
}
