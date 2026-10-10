/**
 * Where the server reaches the API (API_URL, e.g. http://api:8080 inside the cluster). The
 * browser never uses it: `/api/*` on the site is forwarded there (next.config.ts), so pages
 * and the API share an origin and session cookies stay first-party. Undefined when unset,
 * which leaves the site on its built-in content.
 */
export function apiOrigin(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  const value = env.API_URL?.trim().replace(/\/+$/, "");
  return value || undefined;
}

/** Time allowed for a server-side API call before the page falls back to built-in content. */
export const API_TIMEOUT_MS = 4000;
