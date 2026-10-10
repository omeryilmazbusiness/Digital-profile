import { cacheLife, cacheTag } from "next/cache";

import type { Locale } from "@/i18n/locales";
import type { Schemas } from "@/lib/api/client";
import { API_TIMEOUT_MS, apiOrigin } from "@/lib/api/server";

export type PublicSite = Schemas["PublicSite"];

/** Everything editable in the admin panel is cached under this tag; saving refreshes it. */
export const SITE_TAG = "site";

/**
 * What the admin panel published for `locale`, or undefined when the API isn't configured
 * or doesn't answer — the page then renders its built-in content instead of failing.
 */
export async function fetchPublicSite(locale: Locale): Promise<PublicSite | undefined> {
  "use cache";
  cacheTag(SITE_TAG);
  // Saving in the admin panel refreshes at once; this only bounds staleness otherwise.
  cacheLife({ stale: 60, revalidate: 300, expire: 86_400 });

  const origin = apiOrigin();
  if (!origin) return undefined;
  try {
    const response = await fetch(`${origin}/api/v1/public/site?locale=${locale}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    if (!response.ok) return undefined;
    return (await response.json()) as PublicSite;
  } catch {
    return undefined;
  }
}

/**
 * The published contact card (.vcf) in `locale`, with the photo chosen in the admin panel,
 * or undefined until a profile is published.
 */
export async function fetchProfileVCard(
  locale: Locale,
): Promise<{ body: string; disposition: string } | undefined> {
  "use cache";
  cacheTag(SITE_TAG);
  cacheLife({ stale: 60, revalidate: 300, expire: 86_400 });

  const origin = apiOrigin();
  if (!origin) return undefined;
  try {
    const response = await fetch(`${origin}/api/v1/public/profile/vcard?locale=${locale}`, {
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    if (!response.ok) return undefined;
    return {
      body: await response.text(),
      disposition:
        response.headers.get("Content-Disposition") ?? 'attachment; filename="contact.vcf"',
    };
  } catch {
    return undefined;
  }
}
