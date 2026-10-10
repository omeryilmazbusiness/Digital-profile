"use client";

import { ArrowDown, ArrowUp, ExternalLink, FileText, Pencil, Plus, Upload } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { IconButton } from "@/components/ui/icon-button";
import { Skeleton } from "@/components/ui/skeleton";
import { TextField } from "@/components/ui/text-field";
import { toast } from "@/components/ui/toast";
import { type Locale, locales, nativeNames } from "@/i18n/locales";
import { formatFileSize } from "@/lib/format";

import { refreshPublicSite } from "../actions";
import { PageHeader } from "../admin-shell";
import { api, type Schemas, unwrap } from "../api";
import { FormCard, reportError, useFieldErrors } from "../form-parts";
import { useSession } from "../session";
import { DocumentSheet } from "./document-sheet";
import { TopicSheet } from "./topic-sheet";

type Section = Schemas["DiscoverSection"];
type Document = Schemas["Document"];

/** Text in the admin's language, else the first language that has it. */
function pick<T>(byLocale: Partial<Record<Locale, T>>, locale: Locale): T | undefined {
  return byLocale[locale] ?? locales.map((l) => byLocale[l]).find(Boolean);
}

/** Tells the admin the change is live, refreshing the public site's cache first. */
async function published(t: { saved: string; savedLive: string }) {
  await refreshPublicSite().catch(() => false);
  toast(t.saved, { tone: "success", description: t.savedLive });
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

type Editing =
  | { kind: "topic"; section?: Section; key: number }
  | { kind: "document"; sectionId: string; document?: Document; key: number };

export function DiscoverScreen() {
  const { locale, t } = useSession();
  const [sections, setSections] = useState<Section[]>();
  const [tourUrl, setTourUrl] = useState<string>();
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState<Editing>();
  const [reordering, setReordering] = useState(false);

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    Promise.all([
      unwrap(api.GET("/api/v1/admin/discover/sections")),
      unwrap(api.GET("/api/v1/admin/settings")),
    ]).then(
      ([list, settings]) => {
        if (!live) return;
        setSections(list.items);
        setTourUrl((current) => current ?? settings.tourUrl ?? "");
        setFailed(false);
      },
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [attempt]);

  const reload = () => setAttempt((n) => n + 1);
  const saved = () => {
    reload();
    void published(t);
  };

  async function move(index: number, by: -1 | 1) {
    if (!sections) return;
    const order = sections.map((s) => s.id);
    [order[index], order[index + by]] = [order[index + by]!, order[index]!];
    setReordering(true);
    try {
      const list = await unwrap(
        api.PUT("/api/v1/admin/discover/section-order", { body: { ids: order } }),
      );
      setSections(list.items);
      await published(t);
    } catch (e) {
      reportError(t, e);
    } finally {
      setReordering(false);
    }
  }

  const open = (next: DistributiveOmit<Editing, "key">) => setEditing({ ...next, key: Date.now() });
  const close = () => setEditing(undefined);

  return (
    <>
      <PageHeader title={t.discover} lead={t.discoverLead} />

      {failed ? (
        <ErrorState
          title={t.genericError}
          description={t.networkError}
          retryLabel={t.retry}
          onRetry={() => {
            setFailed(false);
            reload();
          }}
        />
      ) : !sections || tourUrl === undefined ? (
        <div className="grid gap-4" aria-busy aria-label={t.loading}>
          <Skeleton className="h-44 rounded-[1.5rem]" />
          <Skeleton className="h-64 rounded-[1.5rem]" />
        </div>
      ) : (
        <div className="grid gap-10">
          <TourCard initial={tourUrl} onSaved={setTourUrl} />

          <section aria-labelledby="topics" className="grid gap-4">
            <div className="flex items-end justify-between gap-3 px-1">
              <h2 id="topics" className="text-title-2 font-semibold">
                {t.topicsTitle}
              </h2>
              <Button size="sm" variant="tinted" onClick={() => open({ kind: "topic" })}>
                <Plus aria-hidden />
                {t.addTopic}
              </Button>
            </div>

            {sections.length === 0 ? (
              <EmptyState
                className="rounded-[1.5rem] bg-bg-grouped-secondary py-12"
                icon={<FileText aria-hidden />}
                title={t.noTopics}
                description={t.noTopicsLead}
                action={
                  <Button onClick={() => open({ kind: "topic" })}>
                    <Plus aria-hidden />
                    {t.addTopic}
                  </Button>
                }
              />
            ) : (
              <ol className="grid gap-4">
                {sections.map((section, index) => (
                  <li key={section.id}>
                    <TopicCard
                      section={section}
                      locale={locale}
                      first={index === 0}
                      last={index === sections.length - 1}
                      busy={reordering}
                      onMove={(by) => void move(index, by)}
                      onEdit={() => open({ kind: "topic", section })}
                      onUpload={() => open({ kind: "document", sectionId: section.id })}
                      onEditDocument={(document) =>
                        open({ kind: "document", sectionId: section.id, document })
                      }
                    />
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}

      {editing?.kind === "topic" && (
        <TopicSheet
          key={editing.key}
          open
          onOpenChange={(o) => !o && close()}
          section={editing.section}
          onSaved={saved}
        />
      )}
      {editing?.kind === "document" && (
        <DocumentSheet
          key={editing.key}
          open
          onOpenChange={(o) => !o && close()}
          sectionId={editing.sectionId}
          document={editing.document}
          onSaved={saved}
        />
      )}
    </>
  );
}

function TourCard({ initial, onSaved }: { initial: string; onSaved: (url: string) => void }) {
  const { t } = useSession();
  const [url, setUrl] = useState(initial);
  const [pending, setPending] = useState(false);
  const errors = useFieldErrors(t);
  const dirty = url.trim() !== initial;

  async function save() {
    setPending(true);
    errors.clear();
    try {
      const settings = await unwrap(
        api.PUT("/api/v1/admin/settings", { body: { tourUrl: url.trim() || undefined } }),
      );
      setUrl(settings.tourUrl ?? "");
      onSaved(settings.tourUrl ?? "");
      await published(t);
    } catch (e) {
      if (Object.keys(errors.capture(e)).length === 0) reportError(t, e);
    } finally {
      setPending(false);
    }
  }

  return (
    <FormCard title={t.tourTitle} description={t.tourLead}>
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <TextField
          label={t.tourUrl}
          hint={t.tourHint}
          type="url"
          inputMode="url"
          placeholder="https://"
          autoComplete="off"
          spellCheck={false}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          error={errors.error("tourUrl")}
        />
        <div className="flex flex-wrap items-center justify-end gap-2">
          {initial && (
            <Button asChild variant="plain" size="sm">
              <a href={initial} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden />
                {t.openLink}
              </a>
            </Button>
          )}
          <Button type="submit" size="sm" loading={pending} disabled={!dirty}>
            {t.save}
          </Button>
        </div>
      </form>
    </FormCard>
  );
}

function TopicCard({
  section,
  locale,
  first,
  last,
  busy,
  onMove,
  onEdit,
  onUpload,
  onEditDocument,
}: {
  section: Section;
  locale: Locale;
  first: boolean;
  last: boolean;
  busy: boolean;
  onMove: (by: -1 | 1) => void;
  onEdit: () => void;
  onUpload: () => void;
  onEditDocument: (document: Document) => void;
}) {
  const { t } = useSession();
  const text = pick(section.translations, locale);
  const missing = locales.filter((l) => !section.translations[l]);

  return (
    <article className="overflow-hidden rounded-[1.5rem] bg-bg-grouped-secondary shadow-card ring-1 ring-label/[0.04]">
      <header className="flex items-start gap-3 p-5 pb-4 sm:p-6 sm:pb-4">
        <div className="grid min-w-0 flex-1 gap-1">
          {text?.eyebrow && (
            <p className="truncate text-[0.6875rem] font-semibold tracking-[0.22em] text-gold uppercase">
              {text.eyebrow}
            </p>
          )}
          <h3 className="font-display text-title-3 leading-snug font-semibold text-balance">
            {text?.title ?? t.untitled}
          </h3>
          {text?.body && (
            <p className="line-clamp-2 text-subheadline text-label-secondary">{text.body}</p>
          )}
          {missing.length > 0 && (
            <p className="mt-1 text-footnote text-label-tertiary">
              {missing.map((l) => nativeNames[l]).join(" · ")} — {t.notTranslated}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <IconButton
            label={t.moveUp}
            size="sm"
            variant="plain"
            disabled={first || busy}
            onClick={() => onMove(-1)}
          >
            <ArrowUp />
          </IconButton>
          <IconButton
            label={t.moveDown}
            size="sm"
            variant="plain"
            disabled={last || busy}
            onClick={() => onMove(1)}
          >
            <ArrowDown />
          </IconButton>
          <IconButton label={t.edit} size="sm" variant="gray" onClick={onEdit}>
            <Pencil />
          </IconButton>
        </div>
      </header>

      <ul className="border-t border-separator/70">
        {section.documents.length === 0 && (
          <li className="px-5 py-4 text-subheadline text-label-secondary sm:px-6">
            {t.noDocuments}
          </li>
        )}
        {section.documents.map((doc) => (
          <li key={doc.id} className="border-b border-separator/70 last:border-b-0">
            <DocumentRow document={doc} locale={locale} onEdit={() => onEditDocument(doc)} />
          </li>
        ))}
      </ul>

      <div className="border-t border-separator/70 p-3 sm:px-4">
        <Button variant="plain" size="sm" onClick={onUpload}>
          <Upload aria-hidden />
          {t.uploadPdf}
        </Button>
      </div>
    </article>
  );
}

function DocumentRow({
  document,
  locale,
  onEdit,
}: {
  document: Document;
  locale: Locale;
  onEdit: () => void;
}) {
  const { t } = useSession();
  const title = pick(document.translations, locale)?.title ?? document.fileName;
  const meta = [
    nativeNames[document.language],
    formatFileSize(document.byteSize, t.formatLocale),
    document.pageCount ? t.pages.replace("{count}", String(document.pageCount)) : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex items-center gap-3 px-5 py-3 sm:px-6">
      <span
        aria-hidden
        className="grid h-11 w-9 shrink-0 place-items-end justify-center rounded-[0.4rem] bg-bg pb-1 text-[0.5rem] font-bold tracking-[0.14em] text-gold shadow-card ring-1 ring-label/[0.08]"
      >
        PDF
      </span>
      <div className="grid min-w-0 flex-1">
        <p className="truncate text-body font-medium">{title}</p>
        <p className="truncate text-footnote text-label-secondary">{meta}</p>
      </div>
      <IconButton label={t.open} size="sm" variant="plain" asChild>
        <a href={document.url} target="_blank" rel="noopener noreferrer">
          <ExternalLink />
        </a>
      </IconButton>
      <IconButton label={t.edit} size="sm" variant="gray" onClick={onEdit}>
        <Pencil />
      </IconButton>
    </div>
  );
}
