"use client";

import { useId } from "react";
import type * as React from "react";

import { cn } from "@/lib/utils";

const control = cn(
  "w-full rounded-md bg-fill-tertiary px-4 text-body text-label caret-tint outline-none placeholder:text-label-tertiary",
  "transition-[background-color,box-shadow] duration-(--duration-fast) ease-ios",
  "focus:bg-bg-elevated focus:shadow-[0_0_0_2px_var(--brand)]",
  "aria-invalid:shadow-[0_0_0_2px_var(--system-red)]",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

interface FieldProps {
  label: React.ReactNode;
  /** Visually hide the label; it stays the accessible name. */
  hideLabel?: boolean;
  hint?: React.ReactNode;
  /** Validation message; marks the control invalid. */
  error?: React.ReactNode;
  className?: string;
}

function useField(id: string | undefined, hint: unknown, error: unknown) {
  const generated = useId();
  const fieldId = id ?? generated;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  return {
    fieldId,
    hintId,
    errorId,
    describedBy: [errorId, hintId].filter(Boolean).join(" ") || undefined,
  };
}

function Field({
  fieldId,
  hintId,
  errorId,
  label,
  hideLabel,
  hint,
  error,
  className,
  children,
}: FieldProps & ReturnType<typeof useField> & { children: React.ReactNode }) {
  return (
    <div data-slot="field" className={cn("grid gap-1.5", className)}>
      <label
        htmlFor={fieldId}
        className={cn(
          "px-1 text-footnote font-medium text-label-secondary",
          hideLabel && "sr-only",
        )}
      >
        {label}
      </label>
      {children}
      {error && (
        <p id={errorId} className="px-1 text-footnote text-system-red">
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="px-1 text-footnote text-label-secondary">
          {hint}
        </p>
      )}
    </div>
  );
}

export type TextFieldProps = FieldProps & Omit<React.ComponentProps<"input">, "className">;

/**
 * Labelled text input. 17px text keeps iOS Safari from zooming on focus; hint and error are
 * wired to the input with aria-describedby.
 */
export function TextField({
  label,
  hideLabel,
  hint,
  error,
  className,
  id,
  type,
  dir,
  ...props
}: TextFieldProps) {
  const ids = useField(id, hint, error);
  // Addresses and numbers read left-to-right even in Arabic; keep them aligned to the start.
  const ltrOnly = type === "email" || type === "tel" || type === "url";
  return (
    <Field {...ids} {...{ label, hideLabel, hint, error, className }}>
      <input
        id={ids.fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={ids.describedBy}
        type={type}
        dir={dir ?? (ltrOnly ? "ltr" : undefined)}
        className={cn(control, "h-12", ltrOnly && !dir && "rtl:text-right")}
        {...props}
      />
    </Field>
  );
}

export type TextareaProps = FieldProps & Omit<React.ComponentProps<"textarea">, "className">;

/** Multi-line input that grows with its content up to a limit. */
export function Textarea({
  label,
  hideLabel,
  hint,
  error,
  className,
  id,
  ...props
}: TextareaProps) {
  const ids = useField(id, hint, error);
  return (
    <Field {...ids} {...{ label, hideLabel, hint, error, className }}>
      <textarea
        id={ids.fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={ids.describedBy}
        className={cn(control, "[field-sizing:content] max-h-80 min-h-28 resize-none py-3")}
        {...props}
      />
    </Field>
  );
}
