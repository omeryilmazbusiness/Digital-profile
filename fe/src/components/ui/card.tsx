import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

export const cardVariants = cva("relative overflow-hidden rounded-xl text-label", {
  variants: {
    variant: {
      /** On grouped backgrounds, like an inset list section. */
      grouped: "bg-bg-grouped-secondary",
      /** Floating above a plain background. */
      elevated: "bg-bg-elevated shadow-card",
      /** Translucent, over imagery. */
      glass: "material-regular shadow-card",
    },
    interactive: {
      true: "pressable cursor-pointer",
      false: "",
    },
  },
  defaultVariants: { variant: "grouped", interactive: false },
});

export interface CardProps extends React.ComponentProps<"div">, VariantProps<typeof cardVariants> {
  asChild?: boolean;
}

export function Card({ className, variant, interactive, asChild, ...props }: CardProps) {
  const Comp = asChild ? Slot.Root : "div";
  return (
    <Comp
      data-slot="card"
      className={cn(cardVariants({ variant, interactive }), className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="card-header" className={cn("grid gap-1 p-4 pb-0", className)} {...props} />
  );
}

export function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3 data-slot="card-title" className={cn("text-headline text-label", className)} {...props} />
  );
}

export function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="card-description"
      className={cn("text-subheadline text-label-secondary", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("p-4", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center gap-3 p-4 pt-0", className)}
      {...props}
    />
  );
}
