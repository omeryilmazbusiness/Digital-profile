import type * as React from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const sizes = {
  sm: "size-8 px-0",
  md: "size-11 px-0",
} as const;

export interface IconButtonProps extends Omit<ButtonProps, "size" | "shape" | "block"> {
  /** Accessible name; icon-only buttons have no visible text. */
  label: string;
  size?: keyof typeof sizes;
  children: React.ReactNode;
}

/** A circular, icon-only button. The label is required so it is never unnamed. */
export function IconButton({
  label,
  size = "md",
  variant = "gray",
  className,
  ...props
}: IconButtonProps) {
  return (
    <Button
      aria-label={label}
      title={label}
      variant={variant}
      size={size === "sm" ? "sm" : "md"}
      shape="capsule"
      className={cn(sizes[size], className)}
      {...props}
    />
  );
}
