"use client";

import { ChevronDown } from "lucide-react";
import { Accordion as AccordionPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

/** Grouped disclosure list (FAQ style) with animated height. */
export function Accordion({
  className,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Root>) {
  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      className={cn("overflow-hidden rounded-xl bg-bg-grouped-secondary", className)}
      {...props}
    />
  );
}

export function AccordionItem({
  className,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn(
        "relative after:absolute after:start-4 after:end-0 after:bottom-0 after:h-px after:origin-bottom after:scale-y-50 after:bg-separator last:after:hidden",
        className,
      )}
      {...props}
    />
  );
}

export function AccordionTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "group flex min-h-11 flex-1 cursor-pointer items-center justify-between gap-3 px-4 py-3 text-start text-body font-medium text-label outline-none",
          "transition-colors duration-(--duration-fast) [-webkit-tap-highlight-color:transparent]",
          "hover:bg-fill-quaternary focus-visible:bg-fill-quaternary active:bg-fill-tertiary",
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDown
          aria-hidden
          strokeWidth={2.5}
          className="size-4 shrink-0 text-label-tertiary transition-transform duration-(--duration-base) ease-ios group-data-[state=open]:rotate-180"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

export function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      data-slot="accordion-content"
      className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
      {...props}
    >
      <div className={cn("px-4 pb-4 text-subheadline text-label-secondary", className)}>
        {children}
      </div>
    </AccordionPrimitive.Content>
  );
}
