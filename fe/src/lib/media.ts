import type { Schemas } from "@/lib/api/client";

export type Media = Schemas["Media"];
export type ImageVariant = Schemas["ImageVariant"];

/** The fields needed to render an image; a full Media record satisfies it. */
export interface ImageSource {
  width: number;
  height: number;
  variants: readonly Pick<ImageVariant, "url" | "width">[];
  placeholder?: string;
}

/**
 * Variant URLs are relative to the API origin unless the API is configured with a CDN base.
 * NEXT_PUBLIC_API_URL is only needed when the API is served from another origin.
 */
export function mediaUrl(url: string, origin = process.env.NEXT_PUBLIC_API_URL ?? ""): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("//")) return url;
  return origin.replace(/\/+$/, "") + url;
}

export function srcSet(source: ImageSource, origin?: string): string {
  return [...source.variants]
    .sort((a, b) => a.width - b.width)
    .map((v) => `${mediaUrl(v.url, origin)} ${v.width}w`)
    .join(", ");
}

/** Fallback src for browsers without srcset: the smallest variant at least `target` wide. */
export function fallbackSrc(source: ImageSource, target = 960, origin?: string): string {
  const sorted = [...source.variants].sort((a, b) => a.width - b.width);
  const pick = sorted.find((v) => v.width >= target) ?? sorted.at(-1);
  return pick ? mediaUrl(pick.url, origin) : "";
}
