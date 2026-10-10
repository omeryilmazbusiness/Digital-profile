"use server";

import { updateTag } from "next/cache";
import { cookies } from "next/headers";

import { SITE_TAG } from "@/features/site/site-api";
import { API_TIMEOUT_MS, apiOrigin } from "@/lib/api/server";

const ACCESS_COOKIES = new Set(["dp_access", "__Host-dp_access"]);

/**
 * Shows the admin's latest changes on the public site at once. Only a signed-in admin may
 * do it: the session cookie is checked with the API before the cache is cleared.
 */
export async function refreshPublicSite(): Promise<boolean> {
  const origin = apiOrigin();
  if (!origin) return false;
  const session = (await cookies())
    .getAll()
    .filter((c) => ACCESS_COOKIES.has(c.name))
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  if (!session) return false;

  try {
    const response = await fetch(`${origin}/api/v1/auth/me`, {
      headers: { Cookie: session },
      cache: "no-store",
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    if (!response.ok) return false;
  } catch {
    return false;
  }
  updateTag(SITE_TAG);
  return true;
}
