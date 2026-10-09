import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 pressable items-center justify-center gap-2 font-semibold whitespace-nowrap outline-none",
    "disabled:pointer-events-none disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-40",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        filled: "bg-tint text-tint-contrast hover:bg-tint/90",
        tinted: "bg-tint/15 text-tint hover:bg-tint/20",
        gray: "bg-fill-tertiary text-tint hover:bg-fill-secondary",
        plain: "bg-transparent text-tint hover:bg-fill-quaternary",
        destructive: "bg-system-red text-white hover:bg-system-red/90",
        "destructive-tinted": "bg-system-red/12 text-system-red hover:bg-system-red/18",
        /** Translucent, for controls over photos and video. */
        glass: "material-regular text-label shadow-card",
      },
      size: {
        // 32pt, with the hit area extended to 44pt.
        sm: "h-8 px-3.5 text-subheadline before:absolute before:-inset-1.5 before:content-[''] [&_svg:not([class*='size-'])]:size-4",
        md: "h-11 px-5 text-body [&_svg:not([class*='size-'])]:size-5",
        lg: "h-[3.125rem] px-6 text-headline [&_svg:not([class*='size-'])]:size-5",
      },
      shape: {
        capsule: "rounded-full",
        rounded: "",
      },
      block: {
        true: "w-full",
        false: "",
      },
    },
    compoundVariants: [
      { shape: "rounded", size: "sm", className: "rounded-sm" },
      { shape: "rounded", size: "md", className: "rounded-md" },
      { shape: "rounded", size: "lg", className: "rounded-[0.875rem]" },
    ],
    defaultVariants: {
      variant: "filled",
      size: "md",
      shape: "capsule",
      block: false,
    },
  },
);

export interface ButtonProps
  extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  /** Render the child element (a link, for example) with button styling. */
  asChild?: boolean;
  /** Shows a spinner, keeps the width and blocks presses. Ignored with asChild. */
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  shape,
  block,
  asChild = false,
  loading = false,
  disabled,
  type,
  children,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size, shape, block }), className);

  if (asChild) {
    return (
      <Slot.Root data-slot="button" className={classes} {...props}>
        {children}
      </Slot.Root>
    );
  }

  return (
    <button
      data-slot="button"
      type={type ?? "button"}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <span className="invisible inline-flex items-center gap-2">{children}</span>
          <Spinner label={null} size={size === "sm" ? "sm" : "md"} className="absolute" />
        </>
      ) : (
        children
      )}
    </button>
  );
}
