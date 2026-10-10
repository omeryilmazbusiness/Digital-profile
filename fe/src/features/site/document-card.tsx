import { ArrowDownToLine, ArrowUpRight } from "lucide-react";
import type * as React from "react";

import { formatFileSize, formatMonthYear, languageName } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { SiteDocument } from "./content";

/**
 * A PDF as a soft card: a drawn sheet, its title, language, size and date, and Preview /
 * Download actions. Pass `className` for the reveal that brings it in (e.g. `rise`).
 */
export function DocumentCard({
  document,
  className,
  ...props
}: { document: SiteDocument } & Omit<React.ComponentProps<"article">, "children">) {
  const { title, language, url, fileName, sizeBytes, pages, updatedAt } = document;
  return (
    <article
      {...props}
      className={cn(
        "group @container relative isolate overflow-hidden rounded-[1.75rem] bg-bg p-5 ring-1 shadow-lift ring-label/[0.06] sm:p-6",
        "transition-[translate,box-shadow] duration-500 ease-ios hover:-translate-y-0.5",
        "dark:bg-bg-secondary",
        className,
      )}
    >
      {/* A warm glow that blooms behind the card on hover. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -end-20 -top-24 -z-10 size-56 rounded-full bg-gold/15 opacity-0 blur-3xl transition-opacity duration-700 ease-ios group-hover:opacity-100"
      />

      <div className="flex flex-col gap-5 @2xl:flex-row @2xl:items-center @2xl:gap-6">
        <div className="flex min-w-0 flex-1 items-center gap-4 sm:gap-5">
          <Sheet />
          <div className="min-w-0">
            <p className="text-caption-2 font-semibold tracking-[0.22em] text-label-tertiary uppercase">
              PDF · <span lang={language}>{languageName(language)}</span>
            </p>
            <h4 className="mt-1.5 font-display text-[1.1875rem] leading-snug font-semibold text-balance">
              {title}
            </h4>
            <p className="mt-1 text-footnote text-label-secondary">
              {formatFileSize(sizeBytes)} · {pages} {pages === 1 ? "page" : "pages"}
              <span className="text-label-tertiary"> · Updated {formatMonthYear(updatedAt)}</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 @2xl:flex @2xl:shrink-0">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Preview: ${title} (opens in a new tab)`}
            className={cn(
              action,
              "text-label ring-1 ring-label/[0.12] ring-inset hover:bg-fill-quaternary",
              "[&_svg]:transition-transform hover:[&_svg]:translate-x-0.5 hover:[&_svg]:-translate-y-0.5 rtl:[&_svg]:-scale-x-100",
            )}
          >
            Preview
            <ArrowUpRight aria-hidden />
          </a>
          <a
            href={url}
            download={fileName}
            aria-label={`Download: ${title}`}
            className={cn(
              action,
              "bg-label text-bg shadow-[0_8px_20px_-8px_rgb(0_0_0/0.45)] hover:bg-label/90",
              "[&_svg]:transition-transform hover:[&_svg]:translate-y-0.5",
            )}
          >
            <ArrowDownToLine aria-hidden />
            Download
          </a>
        </div>
      </div>
    </article>
  );
}

const action =
  "flex h-11 pressable items-center justify-center gap-1.5 rounded-full px-5 text-subheadline font-semibold whitespace-nowrap transition-colors duration-300 [&_svg]:size-4 [&_svg]:duration-300 [&_svg]:ease-ios";

/** A drawn PDF page: lines of text under a folded corner, tilting straight on hover. */
function Sheet() {
  return (
    <span aria-hidden className="relative shrink-0">
      <span className="absolute inset-0 translate-x-1 translate-y-1 rotate-6 rounded-[0.55rem] bg-bg-secondary ring-1 ring-label/[0.06] transition-transform duration-500 ease-ios group-hover:rotate-3" />
      <span className="relative flex aspect-[3/4] w-14 -rotate-3 flex-col gap-[3px] overflow-hidden rounded-[0.55rem] bg-bg px-2 pt-3 shadow-[0_6px_16px_-6px_rgb(0_0_0/0.25)] ring-1 ring-label/[0.08] transition-transform duration-500 ease-ios group-hover:rotate-0">
        <span className="absolute end-0 top-0 size-3 rounded-es-[0.3rem] bg-bg-secondary shadow-[-1px_1px_1px_rgb(0_0_0/0.06)] rtl:shadow-[1px_1px_1px_rgb(0_0_0/0.06)]" />
        {[70, 92, 84, 60].map((width, i) => (
          <span
            key={i}
            style={{ width: `${width}%` }}
            className="h-[2px] rounded-full bg-label/[0.12]"
          />
        ))}
        <span className="mt-auto mb-1.5 text-center text-[0.5rem] leading-none font-bold tracking-[0.18em] text-gold">
          PDF
        </span>
      </span>
    </span>
  );
}
