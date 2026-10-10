"use client";

import { createContext, use, useId } from "react";
import type * as React from "react";

import { cn } from "@/lib/utils";

const control = cn(
  "w-full rounded-md bg-fill-tertiary px-4 text-body text-label caret-tint outline-none placeholder:text-label-tertiary",
  "transition-[background-color,box-shadow] duration-(--duration-fast) ease-ios",
  "focus:bg-bg-elevated focus:shadow-[0_0_0_2px_var(--brand)]",
  "aria-invalid:shadow-[0_0_0_2px_var(--system-red)]",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

/**
 * How fields draw: "filled" boxes on their own, or "inset" rows of an iOS grouped list (label
 * over a borderless input, hairlines between rows). A grouped container provides "inset".
 */
export const FieldStyleContext = createContext<"filled" | "inset">("filled");

/** A row of an inset grouped list, divided from the next by an inset hairline. */
export const insetRow = cn(
  "relative px-4 py-3",
  "after:pointer-events-none after:absolute after:start-4 after:end-0 after:bottom-0 after:h-px after:origin-bottom after:scale-y-50 after:bg-separator last:after:hidden",
);

const insetControl = cn(
  "w-full bg-transparent p-0 text-body text-label caret-tint outline-none placeholder:text-label-tertiary",
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
  const style = use(FieldStyleContext);
  if (style === "inset") {
    return (
      <div
        data-slot="field"
        className={cn(
          insetRow,
          "grid gap-1 py-2.5 transition-colors duration-(--duration-fast) focus-within:bg-fill-quaternary",
          className,
        )}
      >
        <label
          htmlFor={fieldId}
          className={cn(
            "text-footnote font-medium text-label-secondary",
            error && "text-system-red",
            hideLabel && "sr-only",
          )}
        >
          {label}
        </label>
        {children}
        {error && (
          <p id={errorId} className="text-footnote text-system-red">
            {error}
          </p>
        )}
        {hint && (
          <p id={hintId} className="text-footnote text-label-tertiary">
            {hint}
          </p>
        )}
      </div>
    );
  }
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
  const inset = use(FieldStyleContext) === "inset";
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
        className={cn(
          inset ? cn(insetControl, "h-7") : cn(control, "h-12"),
          ltrOnly && !dir && "rtl:text-right",
        )}
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
  const inset = use(FieldStyleContext) === "inset";
  return (
    <Field {...ids} {...{ label, hideLabel, hint, error, className }}>
      <textarea
        id={ids.fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={ids.describedBy}
        className={cn(
          inset ? insetControl : cn(control, "py-3"),
          "[field-sizing:content] max-h-80 resize-none",
          inset ? "min-h-16" : "min-h-28",
        )}
        {...props}
      />
    </Field>
  );
}
