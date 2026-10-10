"use client";

import { ExternalLink, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { TextField } from "@/components/ui/text-field";
import { type Locale, locales } from "@/i18n/locales";

import { api, fieldErrors, type Schemas, unwrap, upload } from "../api";
import {
  ConfirmDialog,
  FileDrop,
  FormCard,
  FormRow,
  LocalePanel,
  LocaleTabs,
  MAX_PDF_BYTES,
  megabytes,
  Progress,
  reportError,
  tabNames,
  useFieldErrors,
} from "../form-parts";
import { useSession } from "../session";
import { fieldMessage } from "../strings";

type Document = Schemas["Document"];
type Titles = Record<Locale, string>;

function titlesOf(doc?: Document): Titles {
  return Object.fromEntries(locales.map((l) => [l, doc?.translations[l]?.title ?? ""])) as Titles;
}

const isPdf = (file: File) => file.type === "application/pdf" || /\.pdf$/i.test(file.name);

/** Uploads a PDF to a topic, or edits, replaces and deletes one. */
export function DocumentSheet({
  open,
  onOpenChange,
  sectionId,
  document,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionId: string;
  /** The document being edited; a new upload when absent. */
  document?: Document;
  onSaved: () => void;
}) {
  const { locale: uiLocale, t } = useSession();
  const [titles, setTitles] = useState<Titles>(() => titlesOf(document));
  const [language, setLanguage] = useState<Locale>(document?.language ?? uiLocale);
  const [locale, setLocale] = useState<Locale>(uiLocale);
  const [file, setFile] = useState<File>();
  const [fileError, setFileError] = useState<string>();
  const [progress, setProgress] = useState<number>();
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const errors = useFieldErrors(t);

  function choose(picked: File) {
    setFileError(undefined);
    if (!isPdf(picked)) return setFileError(t.errNotPdf);
    if (picked.size > MAX_PDF_BYTES) return setFileError(t.fileTooLarge);
    setFile(picked);
    // A new upload is named after its file until the admin writes a title.
    if (!document && !locales.some((l) => titles[l].trim())) {
      const name = picked.name
        .replace(/\.pdf$/i, "")
        .replace(/[_-]+/g, " ")
        .trim();
      setTitles((all) => ({ ...all, [language]: name.slice(0, 160) }));
      setLocale(language);
    }
  }

  async function save() {
    errors.clear();
    if (!document && !file) return setFileError(t.errRequired);
    setPending(true);
    const metadata = {
      language,
      translations: Object.fromEntries(
        locales.filter((l) => titles[l].trim()).map((l) => [l, { title: titles[l] }]),
      ),
    };
    try {
      if (document) {
        await unwrap(
          api.PUT("/api/v1/admin/documents/{documentId}", {
            params: { path: { documentId: document.id } },
            body: metadata,
          }),
        );
        if (file) {
          const form = new FormData();
          form.append("file", file);
          setProgress(0);
          await upload("PUT", `/api/v1/admin/documents/${document.id}/file`, form, {
            onProgress: setProgress,
          });
        }
      } else {
        const form = new FormData();
        form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
        form.append("file", file!);
        setProgress(0);
        await upload("POST", `/api/v1/admin/discover/sections/${sectionId}/documents`, form, {
          onProgress: setProgress,
        });
      }
      onSaved();
      onOpenChange(false);
    } catch (e) {
      const found = Object.keys(errors.capture(e));
      if (found.length > 0) {
        const first = locales.find((l) => found.some((f) => f.startsWith(`translations.${l}`)));
        if (first) setLocale(first);
        const fileProblem = fieldErrors(e).file;
        if (fileProblem) setFileError(fieldMessage(t, fileProblem));
      } else {
        reportError(t, e);
      }
    } finally {
      setPending(false);
      setProgress(undefined);
    }
  }

  async function remove() {
    if (!document) return;
    setPending(true);
    try {
      await unwrap(
        api.DELETE("/api/v1/admin/documents/{documentId}", {
          params: { path: { documentId: document.id } },
        }),
      );
      onSaved();
      onOpenChange(false);
    } catch (e) {
      reportError(t, e);
    } finally {
      setPending(false);
    }
  }

  const heading = titles[uiLocale] || locales.map((l) => titles[l]).find(Boolean) || t.untitled;
  const sizeHint = t.dropHint.replace("{size}", megabytes(MAX_PDF_BYTES, t.formatLocale));

  return (
    <Sheet open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <SheetContent
        title={document ? t.editDocument : t.newDocument}
        closeLabel={t.close}
        className="bg-bg-grouped"
        footer={
          <div className="flex gap-2">
            {document && (
              <Button
                type="button"
                variant="destructive-tinted"
                onClick={() => setConfirm(true)}
                disabled={pending}
                aria-label={t.delete}
              >
                <Trash2 aria-hidden />
              </Button>
            )}
            <Button type="submit" form="document-form" block loading={pending}>
              {document ? t.save : t.uploadPdf}
            </Button>
          </div>
        }
      >
        <form
          id="document-form"
          className="grid gap-6 pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <FormCard title={document ? t.replaceFile : t.pdfFile}>
            <FormRow className="grid gap-2.5">
              {document && !file && (
                <a
                  href={document.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-1 text-subheadline text-tint"
                >
                  <ExternalLink aria-hidden className="size-4" />
                  <span className="truncate" dir="auto">
                    {document.fileName}
                  </span>
                </a>
              )}
              <FileDrop
                accept="application/pdf,.pdf"
                label={t.choosePdf}
                hint={sizeHint}
                file={file}
                onFile={choose}
                error={fileError}
              />
              {progress !== undefined && (
                <Progress
                  value={progress}
                  label={t.uploading.replace("{percent}", String(Math.round(progress * 100)))}
                />
              )}
            </FormRow>
          </FormCard>

          <FormCard title={t.documentLanguage}>
            <FormRow>
              <SegmentedControl
                aria-label={t.documentLanguage}
                block
                value={language}
                onValueChange={setLanguage}
                options={locales.map((l) => ({
                  value: l,
                  label: <span lang={l}>{tabNames[l]}</span>,
                }))}
              />
            </FormRow>
          </FormCard>

          <FormCard title={t.title}>
            <FormRow>
              <LocaleTabs
                label={t.language}
                value={locale}
                onChange={setLocale}
                filled={(l) => Boolean(titles[l].trim())}
                invalid={(l) => errors.hasPrefix(`translations.${l}`)}
              />
            </FormRow>
            <LocalePanel locale={locale}>
              <TextField
                label={t.title}
                maxLength={160}
                value={titles[locale]}
                onChange={(e) => setTitles((all) => ({ ...all, [locale]: e.target.value }))}
                error={errors.error(`translations.${locale}.title`) ?? errors.error("translations")}
                hint={titles[locale].trim() ? undefined : t.notTranslated}
              />
            </LocalePanel>
          </FormCard>
        </form>
        <ConfirmDialog
          open={confirm}
          onOpenChange={setConfirm}
          title={t.deleteDocumentConfirm.replace("{title}", heading)}
          confirmLabel={t.delete}
          cancelLabel={t.cancel}
          onConfirm={() => void remove()}
        />
      </SheetContent>
    </Sheet>
  );
}
