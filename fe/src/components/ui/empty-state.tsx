import type * as React from "react";

import { cn } from "@/lib/utils";

export interface EmptyStateProps extends Omit<React.ComponentProps<"div">, "title"> {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Usually one Button. */
  action?: React.ReactNode;
}

/** Centered message for an empty screen or section. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "mx-auto flex max-w-sm flex-col items-center gap-3 px-6 py-12 text-center",
        className,
      )}
      {...props}
    >
      {icon && (
        <span
          aria-hidden
          className="mb-1 flex size-16 items-center justify-center rounded-full bg-fill-tertiary text-label-secondary [&_svg]:size-8"
        >
          {icon}
        </span>
      )}
      <h2 className="text-title-3 font-semibold text-balance text-label">{title}</h2>
      {description && (
        <p className="text-subheadline text-pretty text-label-secondary">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
