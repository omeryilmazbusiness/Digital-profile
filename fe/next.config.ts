import type { NextConfig } from "next";

import { apiOrigin } from "./src/lib/api/server";

const api = apiOrigin();

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  experimental: {
    // The site's root layout sits under /sheraton/[locale]: unmatched URLs need their own page.
    globalNotFound: true,
  },
  // The API answers on the site's own origin, so session cookies are first-party and the
  // browser makes no cross-origin calls. Read at build time: set API_URL when building.
  async rewrites() {
    return api ? [{ source: "/api/v1/:path*", destination: `${api}/api/v1/:path*` }] : [];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Scripts aren't restricted: Next's inline bootstrap would need per-request nonces,
          // which a statically prerendered site can't carry.
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'",
          },
          { key: "Strict-Transport-Security", value: "max-age=63072000" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        // Frame directories are named after their content hash (scripts/extract-frames.sh).
        source: "/frames/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
