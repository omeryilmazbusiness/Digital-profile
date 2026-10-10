import { Info } from "lucide-react";

import { draw, rise, RiseGroup } from "@/components/scroll/rise";
import { ScrubText } from "@/components/scroll/scrub-text";

import type { ContentSection, SiteContent } from "./content";
import { DocumentCard } from "./document-card";

type DiscoverSectionProps = Pick<SiteContent, "discover" | "sections">;

/**
 * The hotel's topics, each with the PDFs agencies can share. Everything comes up as it scrolls
 * into view: the heading line by line, the lead inking in word by word, each topic's rule
 * drawing across before its text and cards rise.
 */
export function DiscoverSection({ discover, sections }: DiscoverSectionProps) {
  return (
    <section
      id="discover"
      aria-labelledby="discover-title"
      className="scroll-mt-4 bg-bg py-24 md:py-36"
    >
      <RiseGroup className="mx-auto max-w-6xl px-safe-5">
        <div className="max-w-2xl">
          <p
            {...rise}
            className="flex items-center gap-3 text-caption-1 font-semibold tracking-[0.24em] text-gold uppercase"
          >
            <span
              {...draw}
              aria-hidden
              className="h-px w-8 origin-left bg-current opacity-50 rtl:origin-right"
            />
            {discover.eyebrow}
          </p>
          <h2
            {...rise}
            id="discover-title"
            className="mt-5 font-display text-[2.25rem] leading-[1.08] font-semibold tracking-tight text-balance md:text-[3.5rem]"
          >
            {discover.title}
          </h2>
          <ScrubText
            text={discover.body}
            className="mt-5 text-body text-pretty text-label-secondary md:text-title-3"
          />
          <p {...rise} className="mt-6 flex items-start gap-2 text-footnote text-label-secondary">
            <Info aria-hidden className="mt-px size-4 shrink-0" />
            {discover.note}
          </p>
        </div>

        <div className="mt-16 md:mt-24">
          {sections.map((section, i) => (
            <Topic key={section.id} section={section} index={i} />
          ))}
        </div>
      </RiseGroup>
    </section>
  );
}

function Topic({ section, index }: { section: ContentSection; index: number }) {
  const titleId = `${section.id}-title`;
  return (
    <article
      id={section.id}
      aria-labelledby={titleId}
      className="relative grid scroll-mt-4 gap-8 py-14 md:grid-cols-12 md:gap-12 md:py-20"
    >
      <span
        {...draw}
        aria-hidden
        className="absolute inset-x-0 top-0 h-[0.5px] origin-left bg-separator rtl:origin-right"
      />
      <div className="md:sticky md:top-28 md:col-span-5 md:self-start">
        <p
          {...rise}
          className="flex items-baseline gap-3 text-caption-1 font-semibold tracking-[0.2em] text-label-secondary uppercase"
        >
          <span className="font-display text-title-2 font-medium tracking-normal text-gold italic">
            {String(index + 1).padStart(2, "0")}
          </span>
          {section.eyebrow}
        </p>
        <h3
          {...rise}
          id={titleId}
          className="mt-4 font-display text-title-1 font-semibold tracking-tight text-balance md:text-[2.5rem] md:leading-tight"
        >
          {section.title}
        </h3>
        <p {...rise} className="mt-4 text-body text-pretty text-label-secondary">
          {section.body}
        </p>
      </div>

      {section.documents.length > 0 && (
        <ul
          aria-label={`${section.title}: documents`}
          className="flex flex-col gap-4 md:col-span-7 md:pt-9"
        >
          {section.documents.map((document) => (
            <li key={document.id}>
              <DocumentCard {...rise} document={document} />
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
