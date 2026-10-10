import { AnchorLink } from "@/components/scroll/anchor-link";

import type { SiteContent } from "./content";
import { Wordmark } from "./wordmark";

type SiteFooterProps = Pick<SiteContent, "hotel" | "nav" | "footer"> & {
  profile: SiteContent["contact"]["profile"];
};

const linkClass = "py-1 text-label-secondary transition-colors hover:text-label";

export function SiteFooter({ hotel, nav, footer, profile }: SiteFooterProps) {
  return (
    <footer className="border-t-[0.5px] border-separator bg-bg-secondary pt-16 pb-safe-10 md:pt-20">
      <div className="mx-auto grid max-w-6xl gap-12 px-safe-5 sm:grid-cols-2 md:grid-cols-[1.6fr_1fr_1fr]">
        <div className="sm:col-span-2 md:col-span-1">
          <Wordmark name={hotel.name} />
          <p className="mt-6 max-w-xs text-subheadline text-label-secondary">{footer.tagline}</p>
          <a
            href={hotel.mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block max-w-xs text-footnote text-label-tertiary transition-colors hover:text-label-secondary"
          >
            {hotel.address}
          </a>
        </div>

        <nav aria-labelledby="footer-explore">
          <h2
            id="footer-explore"
            className="text-caption-1 font-semibold tracking-[0.2em] text-label-tertiary uppercase"
          >
            Explore
          </h2>
          <ul className="mt-4 flex flex-col gap-2 text-subheadline">
            {nav.map((item) => (
              <li key={item.href}>
                <AnchorLink href={item.href} className={linkClass}>
                  {item.label}
                </AnchorLink>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="text-caption-1 font-semibold tracking-[0.2em] text-label-tertiary uppercase">
            Contact
          </h2>
          <ul className="mt-4 flex flex-col gap-2 text-subheadline">
            <li>
              <a href={`tel:${profile.phone.e164}`} dir="ltr" className={linkClass}>
                {profile.phone.display}
              </a>
            </li>
            <li>
              <a href={`mailto:${profile.email}`} className={`${linkClass} break-all`}>
                {profile.email}
              </a>
            </li>
            <li>
              <a
                href={profile.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                WhatsApp
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-14 flex max-w-6xl flex-col gap-2 border-t-[0.5px] border-separator px-safe-5 pt-6 text-caption-1 text-label-tertiary md:flex-row md:items-center md:justify-between md:gap-8">
        <p>© {hotel.name}</p>
        <p className="md:text-center">{footer.privacy}</p>
        {footer.credit && <p>{footer.credit}</p>}
      </div>
    </footer>
  );
}
