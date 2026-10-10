import { Mail, MessageCircle, Phone, UserPlus } from "lucide-react";
import type * as React from "react";

import type { ContactProfile } from "@/features/site/content";

export interface ContactAction {
  id: "call" | "whatsapp" | "email" | "save";
  label: string;
  /** Accessible name when the visible label alone is ambiguous. */
  description: string;
  href: string;
  icon: React.ReactNode;
  external?: boolean;
  /** File name when the link downloads (the contact card). */
  download?: string;
}

/** The four ways to reach the profile's owner, in the order they're offered. */
export function contactActions(profile: ContactProfile): ContactAction[] {
  return [
    {
      id: "call",
      label: "Call",
      description: `Call ${profile.name}`,
      href: `tel:${profile.phone.e164}`,
      icon: <Phone aria-hidden />,
    },
    {
      id: "whatsapp",
      label: "WhatsApp",
      description: `Message ${profile.name} on WhatsApp (opens WhatsApp)`,
      href: profile.whatsappUrl,
      icon: <MessageCircle aria-hidden />,
      external: true,
    },
    {
      id: "email",
      label: "Email",
      description: `Email ${profile.name}`,
      href: `mailto:${profile.email}`,
      icon: <Mail aria-hidden />,
    },
    {
      id: "save",
      label: "Save",
      description: `Save ${profile.name} to your contacts`,
      href: profile.vcardHref,
      icon: <UserPlus aria-hidden />,
      download: `${profile.name}.vcf`,
    },
  ];
}

/** Attributes that make an action's link behave (new tab for apps, download for the card). */
export function actionLinkProps(action: ContactAction) {
  return {
    href: action.href,
    ...(action.external ? { target: "_blank", rel: "noopener noreferrer" } : {}),
    ...(action.download ? { download: action.download } : {}),
  };
}
