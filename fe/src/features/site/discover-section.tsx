import { Info } from "lucide-react";

import { Reveal } from "@/components/ui/motion";

import type { ContentSection, SiteContent } from "./content";
import { DocumentCard } from "./document-card";
import { SectionHeading } from "./section-heading";

type DiscoverSectionProps = Pick<SiteContent, "discover" | "sections">;

/** The hotel's topics, each with the PDFs agencies can share. */
export function DiscoverSection({ discover, sections }: DiscoverSectionProps) {
  return (
    <section
      id="discover"
      aria-labelledby="discover-title"
      className="scroll-mt-4 bg-bg py-24 md:py-36"
    >
      <div className="mx-auto max-w-6xl px-safe-5">
        <Reveal>
          <SectionHeading id="discover-title" eyebrow={discover.eyebrow} title={discover.title}>
            <p>{discover.body}</p>
          </SectionHeading>
          <p className="mt-6 flex items-start gap-2 text-footnote text-label-tertiary">
            <Info aria-hidden className="mt-px size-4 shrink-0" />
            {discover.note}
          </p>
        </Reveal>

        <div className="mt-16 md:mt-24">
          {sections.map((section, i) => (
            <Topic key={section.id} section={section} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Topic({ section, index }: { section: ContentSection; index: number }) {
  const titleId = `${section.id}-title`;
  return (
    <article
      id={section.id}
      aria-labelledby={titleId}
      className="grid scroll-mt-4 gap-8 border-t-[0.5px] border-separator py-14 md:grid-cols-12 md:gap-12 md:py-20"
    >
      <Reveal className="md:col-span-5">
        <p className="flex items-center gap-3 text-caption-1 font-semibold tracking-[0.2em] text-label-tertiary uppercase">
          <span className="font-mono tracking-normal text-gold">
            {String(index + 1).padStart(2, "0")}
          </span>
          {section.eyebrow}
        </p>
        <h3
          id={titleId}
          className="mt-4 text-title-1 font-semibold tracking-tight text-balance md:text-4xl md:leading-tight"
        >
          {section.title}
        </h3>
        <p className="mt-4 text-body text-pretty text-label-secondary">{section.body}</p>
      </Reveal>

      {section.documents.length > 0 && (
        <ul
          aria-label={`${section.title}: documents`}
          className="flex flex-col gap-3 md:col-span-7 md:pt-9"
        >
          {section.documents.map((document) => (
            <li key={document.id}>
              <Reveal>
                <DocumentCard document={document} />
              </Reveal>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
