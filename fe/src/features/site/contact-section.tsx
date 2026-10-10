import { ArrowUpRight, Mail, MessageCircle, Phone } from "lucide-react";

import { AnchorLink } from "@/components/scroll/anchor-link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/motion";
import { languageName } from "@/lib/format";

import type { ContactProfile, SiteContent } from "./content";
import { SectionHeading } from "./section-heading";

/** The sales contact's digital business card. */
export function ContactSection({ contact }: { contact: SiteContent["contact"] }) {
  return (
    <section
      id="contact"
      aria-labelledby="contact-title"
      className="scroll-mt-4 bg-bg py-24 md:py-36"
    >
      <div className="mx-auto grid max-w-6xl gap-12 px-safe-5 md:grid-cols-2 md:items-center md:gap-16">
        <Reveal>
          <SectionHeading id="contact-title" eyebrow={contact.eyebrow} title={contact.title}>
            <p>{contact.body}</p>
          </SectionHeading>
        </Reveal>
        <Reveal effect="scale">
          <ProfileCard profile={contact.profile} />
        </Reveal>
      </div>
    </section>
  );
}

function ProfileCard({ profile }: { profile: ContactProfile }) {
  return (
    <article
      aria-label={`${profile.name}, ${profile.title}`}
      className="rounded-[2rem] border-[0.5px] border-separator bg-bg-secondary p-6 shadow-card md:p-8"
    >
      <div className="flex items-center gap-5">
        <Avatar name={profile.name} src={profile.portrait?.avatar} size="xl" />
        <div className="min-w-0">
          <h3 className="text-title-2 font-semibold">{profile.name}</h3>
          <p className="mt-1 text-subheadline text-label-secondary">{profile.title}</p>
        </div>
      </div>
      <p className="mt-6 text-body text-pretty text-label-secondary">{profile.tagline}</p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="sr-only">Speaks:</span>
        {profile.languages.map((code) => (
          <Badge key={code} tone="gray" lang={code}>
            {languageName(code)}
          </Badge>
        ))}
      </div>

      <div className="mt-8 flex flex-col gap-3">
        <Button asChild size="lg" block>
          <a href={profile.whatsappUrl} target="_blank" rel="noopener noreferrer">
            <MessageCircle aria-hidden />
            Message on WhatsApp
          </a>
        </Button>
        <div className="grid grid-cols-2 gap-3">
          <Button asChild variant="gray" block>
            <a href={`tel:${profile.phone.e164}`}>
              <Phone aria-hidden />
              Call
            </a>
          </Button>
          <Button asChild variant="gray" block>
            <a href={`mailto:${profile.email}`}>
              <Mail aria-hidden />
              Email
            </a>
          </Button>
        </div>
      </div>

      <dl className="mt-6 grid gap-1 border-t-[0.5px] border-separator pt-5 text-footnote">
        <div className="flex justify-between gap-4">
          <dt className="text-label-tertiary">Phone</dt>
          <dd dir="ltr" className="text-label-secondary">
            {profile.phone.display}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-label-tertiary">Email</dt>
          <dd className="truncate text-label-secondary">{profile.email}</dd>
        </div>
      </dl>

      <AnchorLink
        href={profile.href}
        className="group mt-6 flex pressable items-center justify-between gap-4 rounded-2xl bg-label px-5 py-4 text-bg"
      >
        <span className="flex flex-col">
          <span className="text-caption-2 font-medium tracking-[0.24em] uppercase opacity-60">
            Digital business card
          </span>
          <span className="mt-1 text-headline">View {profile.name}</span>
        </span>
        <ArrowUpRight
          aria-hidden
          className="size-5 transition-transform duration-300 ease-ios group-hover:translate-x-0.5 group-hover:-translate-y-0.5 rtl:-scale-x-100"
        />
      </AnchorLink>
    </article>
  );
}
