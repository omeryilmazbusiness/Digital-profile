import type { Metadata, Viewport } from "next";

import { uiStrings } from "@/i18n/ui";

import { Document } from "../document";
import { localeOf } from "./locale";

export { generateStaticParams } from "./locale";

export const instant = false;

export const metadata: Metadata = {
  appleWebApp: { capable: true, statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark",
  themeColor: "#000000",
};

/** The social hub's document: always dark, in the language the URL names. */
export default async function HubLayout({ children, params }: LayoutProps<"/[locale]">) {
  const locale = await localeOf(params);
  return (
    <Document lang={locale} theme="dark" ui={uiStrings(locale)}>
      {children}
    </Document>
  );
}
