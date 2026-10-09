"use client";

import { RotateCw, WifiOff } from "lucide-react";
import type * as React from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export interface ErrorStateProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  /** Shows a retry button, e.g. an error boundary's reset(). */
  onRetry?: () => void;
  retryLabel?: string;
  /** Support reference (the API's requestId) so users can quote it. */
  reference?: string;
  className?: string;
}

/** A failure message with an optional retry, announced to assistive technology. */
export function ErrorState({
  title,
  description,
  icon = <WifiOff />,
  onRetry,
  retryLabel = "Try again",
  reference,
  className,
}: ErrorStateProps) {
  return (
    <EmptyState
      role="alert"
      data-slot="error-state"
      icon={icon}
      title={title}
      className={className}
      description={
        description || reference ? (
          <>
            {description}
            {reference && (
              <span className="mt-2 block font-mono text-caption-1 text-label-tertiary select-all">
                {reference}
              </span>
            )}
          </>
        ) : undefined
      }
      action={
        onRetry && (
          <Button variant="tinted" onClick={onRetry}>
            <RotateCw aria-hidden />
            {retryLabel}
          </Button>
        )
      }
    />
  );
}
