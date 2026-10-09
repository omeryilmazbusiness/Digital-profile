import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-caption-1 font-semibold whitespace-nowrap [&_svg]:size-3.5",
  {
    variants: {
      tone: {
        tint: "bg-tint/12 text-tint",
        gold: "bg-gold/15 text-gold",
        green: "bg-system-green/12 text-system-green",
        red: "bg-system-red/12 text-system-red",
        orange: "bg-system-orange/12 text-system-orange",
        gray: "bg-fill-tertiary text-label-secondary",
      },
      solid: {
        true: "",
        false: "",
      },
    },
    compoundVariants: [
      { solid: true, tone: "tint", className: "bg-tint text-tint-contrast" },
      { solid: true, tone: "gold", className: "bg-gold text-white" },
      { solid: true, tone: "green", className: "bg-system-green text-white" },
      { solid: true, tone: "red", className: "bg-system-red text-white" },
      { solid: true, tone: "orange", className: "bg-system-orange text-white" },
      { solid: true, tone: "gray", className: "bg-system-gray text-white" },
    ],
    defaultVariants: { tone: "tint", solid: false },
  },
);

export interface BadgeProps
  extends React.ComponentProps<"span">, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, solid, ...props }: BadgeProps) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ tone, solid }), className)} {...props} />
  );
}
