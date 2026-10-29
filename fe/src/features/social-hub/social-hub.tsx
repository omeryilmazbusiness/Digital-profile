import { Phone } from "lucide-react";

import { AmbientCanvasVideo } from "@/components/film/ambient-canvas-video";
import { Entrance } from "@/components/ui/motion";
import { heroFrames } from "@/features/home/hero-frames.gen";
import { fill, type UiStrings } from "@/i18n/ui";
import { cn } from "@/lib/utils";

import { hubDestinations, OUTBOUND, type HubDestinations } from "./destinations";
import { HubGlyph } from "./glyphs";

/** Accessible name for the hotel mark. The lockup on the image is Latin, in every language. */
export const HUB_LOCKUP = "Sheraton Mecca Jabal Al Kaaba";

/** The call action stays Arabic on the hub, in every language. */
export const HUB_CALL = "اتصال";

export interface SocialHubProps {
  hotelName: string;
  filmLabel: string;
  ui: UiStrings;
  destinations?: HubDestinations;
}

/**
 * A single-viewport card: the lobby film looping behind a blur, the hotel mark centred at the
 * top, and the accounts and numbers in the middle. No other navigation.
 */
export function SocialHub({
  hotelName,
  filmLabel,
  ui,
  destinations = hubDestinations,
}: SocialHubProps) {
  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-white">
      <AmbientCanvasVideo
        sequence={heroFrames}
        label={filmLabel}
        loadingLabel={ui.loading}
        decorative
      />
      <SocialHubHeader skip={ui.skipToContent} />
      <main
        id="main"
        className="relative z-10 flex h-dvh flex-col items-center justify-center px-safe-6 pt-safe-28 pb-safe-10"
      >
        <div className="flex w-full max-w-[20.5rem] flex-col">
          <Entrance effect="fade">
            <nav aria-label={ui.socialMedia} dir="ltr">
              <ul className="flex flex-wrap justify-center gap-3.5">
                {destinations.social.map((item) => (
                  <li key={item.id}>
                    <a
                      {...OUTBOUND}
                      href={item.href}
                      aria-label={`${fill(ui.onNetwork, { name: hotelName, network: item.label })} ${ui.opensInNewTab}`}
                      className="relative flex size-14 pressable items-center justify-center drop-shadow-[0_10px_18px_rgb(0_0_0/0.45)]"
                    >
                      <HubGlyph id={item.id} className="size-14" />
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </Entrance>

          <div
            aria-hidden
            className="mx-auto my-8 h-px w-14 bg-linear-to-r from-transparent via-gold/80 to-transparent"
          />

          <Entrance effect="up" delay={280} className="w-full">
            <ul aria-label={ui.contact} className="flex w-full flex-col gap-3">
              <li>
                <a
                  {...OUTBOUND}
                  href={destinations.whatsappUrl}
                  aria-label={fill(ui.messageName, { name: hotelName })}
                  className={hubActionClass}
                >
                  <HubGlyph id="whatsapp" className="size-6" />
                  {ui.whatsapp}
                </a>
              </li>
              <li>
                <a
                  href={`tel:${destinations.phone.e164}`}
                  aria-label={fill(ui.callName, { name: hotelName })}
                  className={hubActionClass}
                >
                  <Phone aria-hidden className="size-5 text-gold" />
                  <span dir="rtl">{HUB_CALL}</span>
                </a>
              </li>
            </ul>
          </Entrance>
        </div>
      </main>
    </div>
  );
}

const hubActionClass = cn(
  "relative flex h-14 w-full pressable items-center justify-center gap-2.5 rounded-full",
  "bg-white/10 text-headline font-semibold tracking-wide text-white",
  "ring-1 ring-white/18 backdrop-blur-2xl",
  "shadow-[0_12px_40px_rgb(0_0_0/0.32)]",
  "hover:bg-white/16 hover:ring-gold/40",
);

function SocialHubHeader({ skip }: { skip: string }) {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-20 pt-safe">
      <a
        href="#main"
        className="pointer-events-auto sr-only rounded-full bg-bg px-4 py-2 text-label focus:not-sr-only focus:absolute focus:start-4 focus:top-[calc(env(safe-area-inset-top,0px)+0.5rem)]"
      >
        {skip}
      </a>
      <div className="flex justify-center px-safe-5 pt-3">
        <h1>
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand mark, already sized */}
          <img
            src="/brand/sheraton-logo.png"
            alt={HUB_LOCKUP}
            width={501}
            height={240}
            className="h-[4.35rem] w-auto drop-shadow-[0_6px_24px_rgb(0_0_0/0.55)] select-none"
          />
        </h1>
      </div>
    </header>
  );
}
