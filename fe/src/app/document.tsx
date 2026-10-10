import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { Toaster } from "@/components/ui/toast";
import { defaultLocale, directionOf, type Locale } from "@/i18n/locales";
import { siteUrl } from "@/lib/site-url";

import "./globals.css";

/** What every root layout (the site, the design gallery) shares. */
export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: "Sheraton Makkah Jabal Al Kaaba",
  description: "Digital sales experience for travel agencies and tour operators.",
  appleWebApp: { capable: true, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

/** The html document, in the language (and so the direction) of what it shows. */
export function Document({
  lang = defaultLocale,
  children,
}: {
  lang?: Locale;
  children: ReactNode;
}) {
  return (
    <html lang={lang} dir={directionOf(lang)}>
      <body className="min-h-dvh antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
