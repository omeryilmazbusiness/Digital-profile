import { MessageCircle, Phone } from "lucide-react";

import { SmoothScrollProvider } from "@/components/scroll/smooth-scroll-provider";
import { getSiteContent } from "@/features/site/content";
import { SiteFooter } from "@/features/site/site-footer";
import { SiteHeader } from "@/features/site/site-header";

/** The public site: header, footer and smooth scrolling for its scroll-driven storytelling. */
export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const { hotel, nav, footer, contact } = await getSiteContent();
  const { profile } = contact;
  const cta = nav.find((item) => item.href === profile.href) ?? nav[nav.length - 1]!;

  return (
    <SmoothScrollProvider>
      <SiteHeader
        hotelName={hotel.name}
        nav={nav}
        cta={cta}
        quickActions={[
          {
            label: "WhatsApp",
            href: profile.whatsappUrl,
            icon: <MessageCircle aria-hidden />,
            external: true,
          },
          { label: "Call", href: `tel:${profile.phone.e164}`, icon: <Phone aria-hidden /> },
        ]}
      />
      {children}
      <SiteFooter hotel={hotel} nav={nav} footer={footer} profile={profile} />
    </SmoothScrollProvider>
  );
}
