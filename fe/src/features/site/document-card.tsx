import { ArrowDownToLine, FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatFileSize, formatMonthYear, languageName } from "@/lib/format";

import type { SiteDocument } from "./content";

/** A PDF with its language, size and date, and Preview / Download actions. */
export function DocumentCard({ document }: { document: SiteDocument }) {
  const { title, language, url, fileName, sizeBytes, pages, updatedAt } = document;
  return (
    <article className="flex flex-col gap-4 rounded-3xl border-[0.5px] border-separator bg-bg-secondary/60 p-4 transition-colors duration-300 hover:bg-bg-secondary sm:flex-row sm:items-center sm:p-5">
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <div
          aria-hidden
          className="flex size-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-system-red/10 text-system-red"
        >
          <FileText className="size-5" strokeWidth={1.75} />
          <span className="mt-0.5 text-[0.5625rem] leading-none font-bold tracking-wider">PDF</span>
        </div>
        <div className="min-w-0">
          <h4 className="text-headline text-balance">{title}</h4>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-footnote text-label-secondary">
            <Badge tone="gold" lang={language} className="h-5 px-2 text-caption-2">
              {languageName(language)}
            </Badge>
            <span>
              {formatFileSize(sizeBytes)} · {pages} {pages === 1 ? "page" : "pages"}
            </span>
            <span className="text-label-tertiary">Updated {formatMonthYear(updatedAt)}</span>
          </div>
        </div>
      </div>
      <div className="flex gap-2 sm:shrink-0">
        <Button asChild size="sm" variant="gray" className="flex-1 sm:flex-none">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Preview: ${title} (opens in a new tab)`}
          >
            Preview
          </a>
        </Button>
        <Button asChild size="sm" variant="tinted" className="flex-1 sm:flex-none">
          <a href={url} download={fileName} aria-label={`Download: ${title}`}>
            <ArrowDownToLine aria-hidden />
            Download
          </a>
        </Button>
      </div>
    </article>
  );
}
