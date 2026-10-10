"use client";

import { FileUp, ImagePlus, Trash2 } from "lucide-react";
import { AlertDialog } from "radix-ui";
import { useId, useRef, useState } from "react";
import type * as React from "react";

import { Button } from "@/components/ui/button";
import { MediaImage } from "@/components/ui/media-image";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { toast } from "@/components/ui/toast";
import { directionOf, type Locale, locales } from "@/i18n/locales";
import { cn } from "@/lib/utils";

import { errorKind, fieldErrors, type Schemas, upload } from "./api";
import { type AdminStrings, fieldMessage } from "./strings";

type Media = Schemas["Media"];

/** Matches the API's MEDIA_MAX_UPLOAD_BYTES / DOCUMENTS_MAX_UPLOAD_BYTES defaults. */
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_PDF_BYTES = 25 * 1024 * 1024;

/** Language names short enough for a three-way segmented control on a phone. */
export const tabNames: Record<Locale, string> = { en: "English", ar: "العربية", id: "Indonesia" };

/**
 * Picks the language whose texts are being edited. A dot marks a language with an error
 * (red) or not filled in yet (grey).
 */
export function LocaleTabs({
  value,
  onChange,
  filled,
  invalid,
  label,
}: {
  value: Locale;
  onChange: (locale: Locale) => void;
  filled: (locale: Locale) => boolean;
  invalid: (locale: Locale) => boolean;
  label: string;
}) {
  return (
    <SegmentedControl
      aria-label={label}
      block
      value={value}
      onValueChange={onChange}
      options={locales.map((locale) => ({
        value: locale,
        label: (
          <span lang={locale} className="inline-flex items-center gap-1.5">
            {tabNames[locale]}
            {invalid(locale) ? (
              <span aria-hidden className="size-1.5 rounded-full bg-system-red" />
            ) : (
              !filled(locale) && (
                <span aria-hidden className="size-1.5 rounded-full bg-label-tertiary" />
              )
            )}
          </span>
        ),
      }))}
    />
  );
}

/** The fields of one language, written in its direction. */
export function LocalePanel({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return (
    <div lang={locale} dir={directionOf(locale)} className="grid gap-4">
      {children}
    </div>
  );
}

/** A titled group of fields on a raised card. */
export function FormCard({
  title,
  description,
  children,
  className,
  ...props
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
} & Omit<React.ComponentProps<"section">, "title">) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "grid gap-5 rounded-[1.5rem] bg-bg-grouped-secondary p-5 shadow-card ring-1 ring-label/[0.04] sm:p-6",
        className,
      )}
      {...props}
    >
      <div className="grid gap-1">
        <h2 id={id} className="text-title-3 font-semibold">
          {title}
        </h2>
        {description && <p className="text-subheadline text-label-secondary">{description}</p>}
      </div>
      {children}
    </section>
  );
}

/** The API's field errors in the admin's words, keyed by field path. */
export function useFieldErrors(t: AdminStrings) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  return {
    errors,
    error: (field: string) => (errors[field] ? fieldMessage(t, errors[field]) : undefined),
    hasPrefix: (prefix: string) => Object.keys(errors).some((k) => k.startsWith(prefix)),
    clear: () => setErrors({}),
    /** Shows errors found before asking the API, keyed like the API's. */
    set: setErrors,
    /** Keeps the field errors of a failed save and returns them; empty when there are none. */
    capture: (e: unknown): Record<string, string> => {
      const found = fieldErrors(e);
      setErrors(found);
      return found;
    },
  };
}

/** A toast for a failed request, in the admin's words. */
export function reportError(t: AdminStrings, e: unknown, title = t.saveFailed) {
  const kind = errorKind(e);
  if (kind === "session") return; // the session gate takes over
  toast(title, {
    tone: "error",
    description:
      kind === "network" ? t.networkError : kind === "tooLarge" ? t.fileTooLarge : t.genericError,
  });
}

/** Asks before something is deleted for good. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  confirmLabel,
  cancelLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[70] bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <AlertDialog.Content className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[71] mx-auto grid max-w-sm gap-5 rounded-[1.5rem] bg-bg-elevated p-5 shadow-float data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-4 sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2">
          <AlertDialog.Title className="text-headline text-balance">{title}</AlertDialog.Title>
          <AlertDialog.Description className="sr-only">{title}</AlertDialog.Description>
          <div className="grid grid-cols-2 gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="gray">{cancelLabel}</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button variant="destructive" onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

/** Upload progress as a thin bar with its label. */
export function Progress({ value, label }: { value: number; label: string }) {
  return (
    <div className="grid gap-1.5">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        className="h-1.5 overflow-hidden rounded-full bg-fill-tertiary"
      >
        <div
          className="h-full rounded-full bg-tint transition-[width] duration-200"
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
      <p className="text-footnote text-label-secondary" aria-hidden>
        {label}
      </p>
    </div>
  );
}

/** A tap-or-drop target for one file. */
export function FileDrop({
  accept,
  label,
  hint,
  file,
  onFile,
  error,
  icon = <FileUp aria-hidden className="size-6" />,
}: {
  accept: string;
  label: string;
  hint: string;
  file?: File;
  onFile: (file: File) => void;
  error?: string;
  icon?: React.ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const errorId = useId();
  return (
    <div className="grid gap-1.5">
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const dropped = e.dataTransfer.files[0];
          if (dropped) onFile(dropped);
        }}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          "grid min-h-32 pressable place-items-center gap-2 rounded-xl border-[1.5px] border-dashed border-label/15 bg-fill-quaternary px-4 py-6 text-center",
          "transition-colors hover:border-tint/50 hover:bg-tint/5",
          over && "border-tint bg-tint/10",
          error && "border-system-red/60",
        )}
      >
        <span className="grid size-11 place-items-center rounded-full bg-bg-elevated text-tint shadow-card">
          {icon}
        </span>
        <span className="grid gap-0.5">
          <span className="text-body font-semibold text-tint">{file ? file.name : label}</span>
          <span className="text-footnote text-label-secondary">{hint}</span>
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const picked = e.target.files?.[0];
          if (picked) onFile(picked);
          e.target.value = "";
        }}
      />
      {error && (
        <p id={errorId} className="px-1 text-footnote text-system-red">
          {error}
        </p>
      )}
    </div>
  );
}

/** "25 MB" in the admin's number format. */
export function megabytes(bytes: number, formatLocale: string): string {
  return new Intl.NumberFormat(formatLocale, {
    style: "unit",
    unit: "megabyte",
    maximumFractionDigits: bytes < 10 * 1024 * 1024 ? 1 : 0,
  }).format(bytes / (1024 * 1024));
}

/**
 * An image from the media library: preview, upload (with progress) and removal. Uploading
 * stores the image right away; the choice is saved with the form.
 */
export function ImageField({
  t,
  label,
  hint,
  value,
  onChange,
  error,
  aspect = "aspect-[4/5]",
}: {
  t: AdminStrings;
  label: string;
  hint: string;
  value?: Media;
  onChange: (media: Media | undefined) => void;
  error?: string;
  aspect?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number>();
  const [localError, setLocalError] = useState<string>();

  async function pick(file: File) {
    setLocalError(undefined);
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setLocalError(t.errNotImage);
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setLocalError(t.fileTooLarge);
      return;
    }
    const form = new FormData();
    form.append("file", file);
    setProgress(0);
    try {
      onChange(
        await upload<Media>("POST", "/api/v1/admin/media", form, { onProgress: setProgress }),
      );
    } catch (e) {
      const fields = fieldErrors(e);
      if (fields.file) setLocalError(fieldMessage(t, fields.file));
      else reportError(t, e, t.genericError);
    } finally {
      setProgress(undefined);
    }
  }

  const shown = localError ?? error;
  return (
    <div className="grid gap-3 sm:grid-cols-[9rem_1fr] sm:items-center sm:gap-5">
      <div
        className={cn(
          "relative w-36 overflow-hidden rounded-xl bg-fill-tertiary ring-1 ring-label/[0.06]",
          aspect,
        )}
      >
        {value ? (
          <MediaImage source={value} alt="" sizes="9rem" fill />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-label-tertiary">
            <ImagePlus aria-hidden className="size-8" />
          </span>
        )}
        {progress !== undefined && (
          <span className="absolute inset-x-3 bottom-3">
            <Progress value={progress} label="" />
          </span>
        )}
      </div>
      <div className="grid gap-2">
        <p className="text-headline">{label}</p>
        <p className="text-footnote text-label-secondary">{hint}</p>
        <div className="mt-1 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="tinted"
            loading={progress !== undefined}
            onClick={() => input.current?.click()}
          >
            <ImagePlus aria-hidden />
            {value ? t.changeImage : t.uploadImage}
          </Button>
          {value && (
            <Button type="button" size="sm" variant="plain" onClick={() => onChange(undefined)}>
              <Trash2 aria-hidden />
              {t.removeImage}
            </Button>
          )}
        </div>
        {shown && <p className="text-footnote text-system-red">{shown}</p>}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        aria-label={label}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void pick(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
