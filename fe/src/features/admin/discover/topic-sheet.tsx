"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Textarea, TextField } from "@/components/ui/text-field";
import { type Locale, locales } from "@/i18n/locales";

import { api, type Schemas, unwrap } from "../api";
import { ConfirmDialog, LocalePanel, LocaleTabs, reportError, useFieldErrors } from "../form-parts";
import { useSession } from "../session";

type Section = Schemas["DiscoverSection"];
type Text = { eyebrow: string; title: string; body: string };
type Texts = Record<Locale, Text>;

function textsOf(section?: Section): Texts {
  const out = {} as Texts;
  for (const locale of locales) {
    const t = section?.translations[locale];
    out[locale] = { eyebrow: t?.eyebrow ?? "", title: t?.title ?? "", body: t?.body ?? "" };
  }
  return out;
}

const isFilled = (t: Text) => Boolean(t.eyebrow.trim() || t.title.trim() || t.body.trim());

/** Creates a topic, or edits and deletes one. */
export function TopicSheet({
  open,
  onOpenChange,
  section,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The topic being edited; a new one when absent. */
  section?: Section;
  onSaved: () => void;
}) {
  const { locale: uiLocale, t } = useSession();
  const [texts, setTexts] = useState<Texts>(() => textsOf(section));
  const [locale, setLocale] = useState<Locale>(uiLocale);
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const errors = useFieldErrors(t);

  const set = (field: keyof Text, value: string) =>
    setTexts((all) => ({ ...all, [locale]: { ...all[locale], [field]: value } }));

  async function save() {
    setPending(true);
    errors.clear();
    const translations = Object.fromEntries(
      locales
        .filter((l) => isFilled(texts[l]))
        .map((l) => [
          l,
          {
            title: texts[l].title,
            eyebrow: texts[l].eyebrow || undefined,
            body: texts[l].body || undefined,
          },
        ]),
    );
    try {
      await unwrap(
        section
          ? api.PUT("/api/v1/admin/discover/sections/{sectionId}", {
              params: { path: { sectionId: section.id } },
              body: { translations },
            })
          : api.POST("/api/v1/admin/discover/sections", { body: { translations } }),
      );
      onSaved();
      onOpenChange(false);
    } catch (e) {
      const found = Object.keys(errors.capture(e));
      if (found.length > 0) {
        const first = locales.find((l) => found.some((f) => f.startsWith(`translations.${l}`)));
        if (first) setLocale(first);
      } else {
        reportError(t, e);
      }
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    if (!section) return;
    setPending(true);
    try {
      await unwrap(
        api.DELETE("/api/v1/admin/discover/sections/{sectionId}", {
          params: { path: { sectionId: section.id } },
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

  const prefix = `translations.${locale}.`;
  const current = texts[locale];
  const title = section ? t.editTopic : t.newTopic;
  const heading =
    texts[uiLocale].title || locales.map((l) => texts[l].title).find(Boolean) || t.untitled;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={title}
        closeLabel={t.close}
        footer={
          <div className="flex gap-2">
            {section && (
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
            <Button type="submit" form="topic-form" block loading={pending}>
              {t.save}
            </Button>
          </div>
        }
      >
        <form
          id="topic-form"
          className="grid gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <LocaleTabs
            label={t.language}
            value={locale}
            onChange={setLocale}
            filled={(l) => isFilled(texts[l])}
            invalid={(l) => errors.hasPrefix(`translations.${l}`)}
          />
          {errors.error("translations") && (
            <p className="text-footnote text-system-red">{errors.error("translations")}</p>
          )}
          <LocalePanel locale={locale}>
            <TextField
              label={t.eyebrow}
              hint={t.eyebrowHint}
              maxLength={60}
              value={current.eyebrow}
              onChange={(e) => set("eyebrow", e.target.value)}
              error={errors.error(`${prefix}eyebrow`)}
            />
            <TextField
              label={t.title}
              maxLength={160}
              value={current.title}
              onChange={(e) => set("title", e.target.value)}
              error={errors.error(`${prefix}title`)}
            />
            <Textarea
              label={t.body}
              hint={t.paragraphHint}
              maxLength={3000}
              value={current.body}
              onChange={(e) => set("body", e.target.value)}
              error={errors.error(`${prefix}body`)}
            />
            {!isFilled(current) && (
              <p className="text-footnote text-label-secondary">{t.notTranslated}</p>
            )}
          </LocalePanel>
        </form>
        <ConfirmDialog
          open={confirm}
          onOpenChange={setConfirm}
          title={t.deleteTopicConfirm.replace("{title}", heading)}
          confirmLabel={t.delete}
          cancelLabel={t.cancel}
          onConfirm={() => void remove()}
        />
      </SheetContent>
    </Sheet>
  );
}
