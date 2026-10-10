import type { Metadata } from "next";

import { adminStrings } from "@/features/admin/strings";
import { uiStrings } from "@/i18n/ui";

import { Document, metadata as shared } from "../../../document";
import { localeOf } from "../locale";

export { viewport } from "../../../document";
export { generateStaticParams } from "../locale";

export const metadata: Metadata = {
  ...shared,
  title: `${adminStrings("en").admin} · ${adminStrings("en").brand}`,
  robots: { index: false, follow: false },
};

/** The admin panel's document, in the admin's language. */
export default async function AdminLayout({ children, params }: LayoutProps<"/sheraton/[locale]">) {
  const locale = await localeOf(params);
  return (
    <Document lang={locale} ui={uiStrings(locale)}>
      {children}
    </Document>
  );
}
