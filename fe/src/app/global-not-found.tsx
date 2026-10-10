import type { Metadata } from "next";
import Link from "next/link";

import { defaultLocale } from "@/i18n/locales";
import { localizeHref } from "@/i18n/routing";

import { Document } from "./document";

export const metadata: Metadata = {
  title: "Page not found — Sheraton Makkah Jabal Al Kaaba",
  robots: { index: false },
};

export default function GlobalNotFound() {
  return (
    <Document>
      <main className="grid min-h-dvh place-content-center gap-4 px-6 text-center">
        <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">404</p>
        <h1 className="text-2xl font-semibold tracking-tight">This page doesn’t exist.</h1>
        <Link
          href={localizeHref(defaultLocale, "/")}
          className="text-sm font-medium underline underline-offset-4"
        >
          Go to Sheraton Makkah Jabal Al Kaaba
        </Link>
      </main>
    </Document>
  );
}
