/**
 * Destinations the social hub opens. Each line is a Saudi mobile: WhatsApp and a call.
 */

export const SOCIAL_NETWORK_IDS = [
  "facebook",
  "instagram",
  "x",
  "tiktok",
  "linkedin",
  "maps",
] as const;

export type SocialNetworkId = (typeof SOCIAL_NETWORK_IDS)[number];

export interface SocialDestination {
  id: SocialNetworkId;
  /** Brand name, untranslated. */
  label: string;
  href: string;
}

export interface HubLine {
  e164: string;
  display: string;
}

export interface HubDestinations {
  social: readonly SocialDestination[];
  lines: readonly HubLine[];
}

export const OUTBOUND = { target: "_blank", rel: "noopener noreferrer" } as const;

export const HUB_ADDRESS = "Jabal Al Kaaba, Makkah 24231, Saudi Arabia";

const MAPS_QUERY = `Sheraton Makkah Jabal Al Kaaba, ${HUB_ADDRESS}`;

export function whatsappUrl(e164: string): string {
  return `https://wa.me/${e164.replace(/^\+/, "")}`;
}

export const hubDestinations: HubDestinations = {
  social: [
    { id: "facebook", label: "Facebook", href: "https://www.facebook.com/MakkahSheraton" },
    { id: "instagram", label: "Instagram", href: "https://www.instagram.com/MakkahSheraton" },
    { id: "x", label: "X", href: "https://x.com/MakkahSheraton" },
    { id: "tiktok", label: "TikTok", href: "https://www.tiktok.com/@sheratonmakkah" },
    {
      id: "linkedin",
      label: "LinkedIn",
      href: "https://www.linkedin.com/company/makkahsheraton",
    },
    {
      id: "maps",
      label: "Google Maps",
      href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(MAPS_QUERY)}`,
    },
  ],
  lines: [
    { e164: "+966592197039", display: "+966 59 219 7039" },
    { e164: "+966592623702", display: "+966 59 262 3702" },
  ],
};
