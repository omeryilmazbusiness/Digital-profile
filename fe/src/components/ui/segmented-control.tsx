"use client";

import { RadioGroup } from "radix-ui";
import type * as React from "react";

import { useControllableState } from "@/hooks/use-controllable-state";
import { cn } from "@/lib/utils";

export interface SegmentOption<T extends string> {
  value: T;
  label: React.ReactNode;
  /** Accessible name when the label is an icon. */
  ariaLabel?: string;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value?: T;
  defaultValue?: T;
  onValueChange?: (value: T) => void;
  /** Names the group for assistive technology. */
  "aria-label": string;
  size?: "sm" | "md";
  block?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * iOS segmented control: one choice among a few, with a sliding thumb. It is a radio group,
 * so arrow keys move the selection.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  defaultValue,
  onValueChange,
  size = "md",
  block = false,
  disabled,
  className,
  "aria-label": ariaLabel,
}: SegmentedControlProps<T>) {
  const [selected, setSelected] = useControllableState<T | undefined>(
    value,
    defaultValue ?? options[0]?.value,
    onValueChange as ((v: T | undefined) => void) | undefined,
  );
  const index = options.findIndex((o) => o.value === selected);

  return (
    <RadioGroup.Root
      data-slot="segmented-control"
      aria-label={ariaLabel}
      orientation="horizontal"
      value={selected ?? ""}
      onValueChange={(v) => setSelected(v as T)}
      disabled={disabled}
      className={cn(
        "relative isolate grid auto-cols-fr grid-flow-col rounded-[0.5625rem] bg-fill-tertiary p-0.5 [--dir:1] rtl:[--dir:-1]",
        block ? "w-full" : "w-fit",
        disabled && "opacity-40",
        className,
      )}
      style={{ "--count": options.length, "--index": Math.max(index, 0) } as React.CSSProperties}
    >
      {index >= 0 && (
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-0.5 start-0.5 -z-10 w-[calc((100%-0.25rem)/var(--count))] rounded-[0.4375rem] bg-control-thumb",
            "shadow-[0_3px_8px_rgb(0_0_0/0.12),0_3px_1px_rgb(0_0_0/0.04)]",
            "translate-x-[calc(var(--index)*100%*var(--dir))] transition-transform duration-(--duration-base) ease-spring",
          )}
        />
      )}
      {options.map((o) => (
        <RadioGroup.Item
          key={o.value}
          value={o.value}
          aria-label={o.ariaLabel}
          className={cn(
            "relative flex min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-[0.4375rem] px-3 font-medium text-label outline-none",
            "transition-opacity duration-(--duration-fast) select-none [-webkit-tap-highlight-color:transparent]",
            "focus-visible:ring-2 focus-visible:ring-tint data-[state=unchecked]:active:opacity-50",
            "disabled:cursor-not-allowed data-[state=checked]:font-semibold [&_svg]:size-4",
            size === "sm" ? "h-7 text-footnote" : "h-8 text-subheadline",
          )}
        >
          <span className="truncate">{o.label}</span>
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}
