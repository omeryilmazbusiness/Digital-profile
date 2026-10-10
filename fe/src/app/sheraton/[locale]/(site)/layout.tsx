import { MessageCircle, Phone } from "lucide-react";

import { SmoothScrollProvider } from "@/components/scroll/smooth-scroll-provider";
import { getSiteContent } from "@/features/site/content";
import { SiteFooter } from "@/features/site/site-footer";
import { SiteHeader } from "@/features/site/site-header";

import { Document } from "../../../document";
import { localeOf } from "../locale";

export { metadata, viewport } from "../../../document";
export { generateStaticParams } from "../locale";

// Everything here, down to <html lang dir>, depends on the language in the URL, so there is no
// language-independent shell to show first. Each language is prerendered whole instead.
export const instant = false;

/**
 * The public site in one language: header, footer and smooth scrolling for its scroll-driven
 * storytelling, in a document marked with the language the content is actually in.
 */
export default async function SiteLayout({ children, params }: LayoutProps<"/sheraton/[locale]">) {
  const { locale, home, hotel, nav, footer, contact, ui } = await getSiteContent(
    await localeOf(params),
  );
  const { profile } = contact;
  const cta = nav.find((item) => item.href === profile.href) ?? nav[nav.length - 1]!;

  return (
    <Document lang={locale} ui={ui}>
      <SmoothScrollProvider>
        <SiteHeader
          hotelName={hotel.name}
          home={home}
          nav={nav}
          cta={cta}
          quickActions={[
            {
              label: ui.whatsapp,
              href: profile.whatsappUrl,
              icon: <MessageCircle aria-hidden />,
              external: true,
            },
            { label: ui.call, href: `tel:${profile.phone.e164}`, icon: <Phone aria-hidden /> },
          ]}
          ui={ui}
        />
        {children}
        <SiteFooter hotel={hotel} nav={nav} footer={footer} profile={profile} ui={ui} />
      </SmoothScrollProvider>
    </Document>
  );
}
