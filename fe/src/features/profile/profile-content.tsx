import {
  ArrowDownToLine,
  ArrowUpRight,
  CalendarRange,
  Crown,
  FileText,
  Languages,
  Mail,
  MapPin,
  MessageCircle,
  MoonStar,
  Phone,
  UsersRound,
} from "lucide-react";
import type * as React from "react";

import { AnchorLink } from "@/components/scroll/anchor-link";
import { draw, rise, RiseGroup } from "@/components/scroll/rise";
import { ScrubText } from "@/components/scroll/scrub-text";
import type {
  ContactProfile,
  DigitalProfile,
  ProfileLink,
  ProfileServiceIcon,
  SiteContent,
  SiteCredit,
} from "@/features/site/content";
import { Credit } from "@/features/site/credit";
import { formatFileSize, formatMonthYear, languageName } from "@/lib/format";
import { cn } from "@/lib/utils";

import { actionLinkProps, contactActions } from "./contact-actions";
import { CountUp } from "./count-up";
import { OfficeStatus } from "./office-status";
import { ShareCard } from "./share-card";

/** The closing call to action; the contact dock steps aside while it's on screen. */
export const PROFILE_CLOSING_ID = "profile-closing";

const serviceIcons: Record<ProfileServiceIcon, React.ReactNode> = {
  groups: <UsersRound aria-hidden />,
  allotments: <CalendarRange aria-hidden />,
  vip: <Crown aria-hidden />,
  events: <MoonStar aria-hidden />,
};

interface ProfileContentProps {
  card: ContactProfile;
  profile: DigitalProfile;
  hotel: SiteContent["hotel"];
  /** Absolute link to this page when the site's origin is configured, else its path. */
  shareUrl: string;
  /** The studio's signature, set large under the closing call to action. */
  credit?: SiteCredit;
}

/** Everything below the opening, in reading order. */
export function ProfileContent({ card, profile, hotel, shareUrl, credit }: ProfileContentProps) {
  const actions = contactActions(card);
  const whatsapp = actions.find((a) => a.id === "whatsapp")!;
  const save = actions.find((a) => a.id === "save")!;

  return (
    <RiseGroup>
      {/* Statement */}
      <section aria-label="Introduction" className="bg-white py-24 sm:py-36">
        <div className="mx-auto max-w-4xl px-safe-6">
          <ScrubText
            text={profile.statement}
            className="font-display text-[2rem] leading-[1.18] tracking-[-0.01em] text-balance italic sm:text-5xl sm:leading-[1.12]"
          />
        </div>
      </section>

      {/* Figures */}
      <section aria-label="At a glance" className="bg-white pb-24 sm:pb-36">
        <dl className="mx-auto grid max-w-5xl grid-cols-2 gap-x-6 gap-y-12 px-safe-6 md:grid-cols-4">
          {profile.stats.map((stat) => (
            <div
              key={stat.label}
              {...rise}
              className="flex flex-col border-t border-neutral-950 pt-5"
            >
              <dt className="text-footnote text-neutral-500">{stat.label}</dt>
              <dd className="order-first">
                <CountUp
                  value={stat.value}
                  prefix={stat.prefix}
                  suffix={stat.suffix}
                  className="mb-3 block font-display text-[2.75rem] leading-none tabular-nums sm:text-6xl"
                />
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* About — the page's dark counterpoint */}
      <section aria-labelledby="profile-about" className="bg-neutral-950 py-24 text-white sm:py-36">
        <div className="mx-auto grid max-w-5xl gap-12 px-safe-6 md:grid-cols-[1.1fr_1fr] md:gap-20">
          <div {...rise}>
            <Heading id="profile-about" eyebrow={profile.about.eyebrow} tone="dark">
              {profile.about.title}
            </Heading>
          </div>
          <div {...rise} className="flex flex-col gap-5 text-body text-white/70 md:pt-10">
            {profile.about.paragraphs.map((p) => (
              <p key={p} className="text-pretty">
                {p}
              </p>
            ))}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="sr-only">Speaks:</span>
              {card.languages.map((code) => (
                <span
                  key={code}
                  lang={code}
                  className="rounded-full px-4 py-1.5 text-footnote text-white ring-1 ring-white/20"
                >
                  {languageName(code)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {profile.cv && <CvSection cv={profile.cv} name={card.name} />}

      {/* Services */}
      <section aria-labelledby="profile-services" className="bg-white py-24 sm:py-36">
        <div className="mx-auto max-w-5xl px-safe-6">
          <div {...rise}>
            <Heading id="profile-services" eyebrow={profile.services.eyebrow}>
              {profile.services.title}
            </Heading>
          </div>
          <ul className="mt-12 grid gap-4 sm:mt-16 sm:grid-cols-2 sm:gap-5">
            {profile.services.items.map((item, i) => (
              <li
                key={item.title}
                {...rise}
                className="flex flex-col rounded-[1.75rem] bg-white p-7 ring-1 shadow-lift ring-neutral-950/5 sm:p-8"
              >
                <div className="flex items-center justify-between">
                  <span className="grid size-12 place-items-center rounded-full bg-neutral-950 text-white [&_svg]:size-5 [&_svg]:stroke-[1.6]">
                    {serviceIcons[item.icon]}
                  </span>
                  <span aria-hidden className="font-mono text-caption-1 text-neutral-500">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="mt-8 font-display text-[1.65rem] leading-tight">{item.title}</h3>
                <p className="mt-2 text-subheadline text-pretty text-neutral-600">{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Reach */}
      <section aria-labelledby="profile-reach" className="bg-neutral-50 py-24 sm:py-36">
        <div className="mx-auto max-w-5xl px-safe-6">
          <div {...rise}>
            <Heading id="profile-reach" eyebrow={profile.reach.eyebrow}>
              {profile.reach.title}
            </Heading>
          </div>
          <div className="mt-12 grid gap-4 sm:mt-16 md:grid-cols-[1.25fr_1fr] md:gap-5">
            <ul
              {...rise}
              className="divide-y divide-neutral-100 rounded-[1.75rem] bg-white px-6 ring-1 shadow-lift ring-neutral-950/5 sm:px-8"
            >
              <DetailRow
                icon={<Phone aria-hidden />}
                label="Mobile"
                value={card.phone.display}
                href={`tel:${card.phone.e164}`}
                ltr
              />
              <DetailRow
                icon={<MessageCircle aria-hidden />}
                label="WhatsApp"
                value={card.phone.display}
                href={card.whatsappUrl}
                external
                ltr
              />
              <DetailRow
                icon={<Mail aria-hidden />}
                label="Email"
                value={card.email}
                href={`mailto:${card.email}`}
              />
              <DetailRow
                icon={<MapPin aria-hidden />}
                label="Office"
                value={hotel.address}
                href={hotel.mapUrl}
                external
              />
              <DetailRow
                icon={<Languages aria-hidden />}
                label="Languages"
                value={card.languages.map((code) => languageName(code)).join(" · ")}
              />
            </ul>
            <div
              {...rise}
              className="rounded-[1.75rem] bg-white p-6 ring-1 shadow-lift ring-neutral-950/5 sm:p-8"
            >
              <OfficeStatus availability={profile.availability} />
            </div>
          </div>
        </div>
      </section>

      {/* Resources */}
      <section aria-labelledby="profile-resources" className="bg-white py-24 sm:py-36">
        <div className="mx-auto max-w-5xl px-safe-6">
          <div {...rise}>
            <Heading id="profile-resources" eyebrow={profile.resources.eyebrow}>
              {profile.resources.title}
            </Heading>
          </div>
          <ul className="mt-12 border-t border-neutral-950 sm:mt-16">
            {[
              ...profile.resources.links,
              ...profile.social.map((s): ProfileLink => ({
                label: s.label,
                description: `${card.name} on ${s.label}`,
                href: s.href,
                external: true,
              })),
            ].map((link) => (
              <li key={link.href} {...rise} className="border-b border-neutral-200">
                <ResourceLink link={link} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Share */}
      <section aria-labelledby="profile-share" className="bg-white px-safe-4 pb-24 sm:pb-36">
        <div
          {...rise}
          className="mx-auto grid max-w-5xl gap-10 rounded-[2.25rem] bg-neutral-950 px-7 py-12 text-white shadow-lift sm:px-12 sm:py-16 md:grid-cols-[1fr_auto] md:items-center"
        >
          <div>
            <Heading id="profile-share" eyebrow={profile.share.eyebrow} tone="dark">
              {profile.share.title}
            </Heading>
            <p className="mt-5 max-w-sm text-body text-pretty text-white/65">
              {profile.share.body}
            </p>
          </div>
          <ShareCard
            title={`${card.name} — ${card.title}`}
            url={shareUrl}
            vcardHref={card.vcardHref}
            vcardFileName={`${card.name}.vcf`}
          />
        </div>
      </section>

      {/* Closing */}
      <section
        id={PROFILE_CLOSING_ID}
        aria-labelledby="profile-closing-title"
        className="border-t border-neutral-200 bg-white py-28 text-center sm:py-40"
      >
        <div {...rise} className="mx-auto flex max-w-2xl flex-col items-center px-safe-6">
          <h2
            id="profile-closing-title"
            className="font-display text-[2.75rem] leading-[1.05] tracking-[-0.01em] text-balance sm:text-7xl"
          >
            {profile.closing.title}
          </h2>
          <p className="mt-6 max-w-md text-body text-pretty text-neutral-600">
            {profile.closing.body}
          </p>
          <div className="mt-10 flex w-full flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              {...actionLinkProps(whatsapp)}
              className="flex h-14 w-full pressable items-center justify-center gap-2.5 rounded-full bg-neutral-950 px-8 text-headline text-white shadow-lift sm:w-auto [&_svg]:size-5"
            >
              {whatsapp.icon}
              {profile.closing.cta}
            </a>
            <a
              {...actionLinkProps(save)}
              className="flex h-14 w-full pressable items-center justify-center gap-2.5 rounded-full px-8 text-headline text-neutral-950 ring-1 ring-neutral-950/15 hover:bg-neutral-50 sm:w-auto [&_svg]:size-5"
            >
              {save.icon}
              Save contact
            </a>
          </div>
        </div>
        {credit && (
          <div className="mt-24 flex flex-col items-center gap-6 px-safe-6 sm:mt-32">
            <span {...draw} aria-hidden className="h-px w-16 bg-neutral-300" />
            <div {...rise}>
              <Credit credit={credit} size="lg" />
            </div>
          </div>
        )}
      </section>
    </RiseGroup>
  );
}

function CvSection({ cv, name }: { cv: NonNullable<DigitalProfile["cv"]>; name: string }) {
  const { document } = cv;
  return (
    <section aria-labelledby="profile-cv" className="bg-white py-24 sm:py-36">
      <div className="mx-auto grid max-w-5xl items-center gap-12 px-safe-6 md:grid-cols-[1fr_1.15fr] md:gap-16">
        <div {...rise}>
          <Heading id="profile-cv" eyebrow={cv.eyebrow}>
            {cv.title}
          </Heading>
          <p className="mt-5 max-w-sm text-body text-pretty text-neutral-600">{cv.body}</p>
        </div>

        <div
          {...rise}
          className="flex flex-col items-center gap-8 rounded-[2rem] bg-neutral-50 p-7 ring-1 ring-neutral-950/5 sm:flex-row sm:items-center sm:p-9"
        >
          <a
            href={document.url}
            target="_blank"
            rel="noopener noreferrer"
            // The same document as "View CV" beside it: one link for assistive technology.
            aria-hidden
            tabIndex={-1}
            className="group relative shrink-0"
          >
            {/* A sheet of the CV, drawn rather than rendered from the PDF. */}
            <span
              aria-hidden
              className="absolute inset-0 translate-x-2 translate-y-2 rotate-3 rounded-md bg-white ring-1 ring-neutral-950/5"
            />
            <span
              aria-hidden
              className="relative flex aspect-[3/4] w-32 -rotate-2 flex-col rounded-md bg-white px-4 py-5 ring-1 shadow-lift ring-neutral-950/5 transition-transform duration-500 ease-ios group-hover:rotate-0 sm:w-36"
            >
              <span className="text-[0.45rem] font-semibold tracking-[0.2em] whitespace-nowrap text-neutral-500 uppercase">
                Curriculum vitae
              </span>
              <span className="mt-1.5 font-display text-[0.8rem] leading-tight font-bold text-neutral-950">
                {name}
              </span>
              <span className="mt-2 h-px w-6 bg-neutral-950" />
              {[92, 80, 86, 64, 0, 88, 76, 82, 58].map((width, i) =>
                width ? (
                  <span
                    key={i}
                    style={{ width: `${width}%` }}
                    className="mt-1.5 h-[3px] rounded-full bg-neutral-200"
                  />
                ) : (
                  <span key={i} className="mt-2.5" />
                ),
              )}
            </span>
          </a>

          <div className="flex w-full min-w-0 flex-col items-center text-center sm:items-start sm:text-start">
            <h3 className="font-display text-[1.35rem] leading-snug font-semibold text-balance">
              {document.title}
            </h3>
            <p className="mt-2 text-footnote text-neutral-500">
              PDF · {formatFileSize(document.sizeBytes)} · {document.pages}{" "}
              {document.pages === 1 ? "page" : "pages"} · Updated{" "}
              {formatMonthYear(document.updatedAt)}
            </p>
            <div className="mt-6 flex w-full flex-col gap-2.5 sm:flex-row">
              <a
                href={document.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`View CV: ${document.title} (opens in a new tab)`}
                className="flex h-12 pressable items-center justify-center gap-2 rounded-full bg-neutral-950 px-6 text-subheadline font-semibold text-white shadow-lift sm:flex-1 [&_svg]:size-4"
              >
                <FileText aria-hidden />
                View CV
              </a>
              <a
                href={document.url}
                download={document.fileName}
                aria-label={`Download: ${document.title}`}
                className="flex h-12 pressable items-center justify-center gap-2 rounded-full px-6 text-subheadline font-semibold text-neutral-950 ring-1 ring-neutral-950/15 hover:bg-white sm:flex-1 [&_svg]:size-4"
              >
                <ArrowDownToLine aria-hidden />
                Download
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Heading({
  id,
  eyebrow,
  tone = "light",
  children,
}: {
  id: string;
  eyebrow: string;
  tone?: "light" | "dark";
  children: React.ReactNode;
}) {
  return (
    <>
      <p
        className={cn(
          "flex items-center gap-3 text-caption-2 font-semibold tracking-[0.32em] uppercase",
          tone === "dark" ? "text-white/50" : "text-neutral-500",
        )}
      >
        <span aria-hidden className="h-px w-8 bg-current" />
        {eyebrow}
      </p>
      <h2
        id={id}
        className="mt-5 font-display text-[2.5rem] leading-[1.05] tracking-[-0.01em] text-balance sm:text-6xl"
      >
        {children}
      </h2>
    </>
  );
}

interface DetailRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
  external?: boolean;
  /** Phone numbers read left to right in every language. */
  ltr?: boolean;
}

function DetailRow({ icon, label, value, href, external, ltr }: DetailRowProps) {
  const body = (
    <>
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-neutral-100 text-neutral-950 [&_svg]:size-[1.1rem] [&_svg]:stroke-[1.7]">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-caption-1 text-neutral-500">{label}</span>
        <span
          dir={ltr ? "ltr" : undefined}
          className="mt-0.5 block text-body break-words text-neutral-950"
        >
          {value}
        </span>
      </span>
      {href && (
        <ArrowUpRight
          aria-hidden
          className="size-4 shrink-0 text-neutral-400 transition-transform duration-300 ease-ios group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-neutral-950 rtl:-scale-x-100"
        />
      )}
    </>
  );
  return (
    <li>
      {href ? (
        <a
          href={href}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className="group flex items-center gap-4 py-5"
        >
          {body}
        </a>
      ) : (
        <div className="flex items-center gap-4 py-5">{body}</div>
      )}
    </li>
  );
}

function ResourceLink({ link }: { link: ProfileLink }) {
  const className = "group flex items-center gap-6 py-6 sm:py-8";
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[1.75rem] leading-tight transition-transform duration-500 ease-ios group-hover:translate-x-1 sm:text-4xl">
          {link.label}
        </span>
        <span className="mt-1.5 block text-subheadline text-neutral-500">{link.description}</span>
      </span>
      <span className="grid size-12 shrink-0 place-items-center rounded-full ring-1 ring-neutral-950/15 transition-colors duration-300 group-hover:bg-neutral-950 group-hover:text-white">
        <ArrowUpRight aria-hidden className="size-5 rtl:-scale-x-100" />
      </span>
    </>
  );
  if (link.external) {
    return (
      <a href={link.href} target="_blank" rel="noopener noreferrer" className={className}>
        {body}
      </a>
    );
  }
  return (
    <AnchorLink href={link.href} className={className}>
      {body}
    </AnchorLink>
  );
}
