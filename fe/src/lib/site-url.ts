/**
 * The site's public origin (NEXT_PUBLIC_SITE_URL), for absolute links in sharing metadata and
 * contact cards. Undefined when not configured: those links are then left out.
 */
export function siteUrl(): URL | undefined {
  const value = process.env.NEXT_PUBLIC_SITE_URL;
  if (!value) return undefined;
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}
