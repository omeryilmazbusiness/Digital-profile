import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const origin = siteUrl();
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/design", "/sheraton/*/admin"] },
    sitemap: origin ? new URL("/sitemap.xml", origin).href : undefined,
  };
}
