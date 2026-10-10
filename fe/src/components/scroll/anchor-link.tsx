"use client";

import Link from "next/link";
import type * as React from "react";

import { useAnchorNavigation } from "./use-anchor-navigation";

export interface AnchorLinkProps extends Omit<React.ComponentProps<"a">, "href"> {
  /** A site path, optionally with a section: "/", "/#tour", "/momen". */
  href: `/${string}`;
  /** Runs when the link is followed, e.g. to close the menu the link is in. */
  onNavigate?: () => void;
}

/**
 * A site link: scrolls smoothly (clearing the fixed header) when the target is on the current
 * page, navigates client-side otherwise.
 */
export function AnchorLink({ onNavigate, onClick, ...props }: AnchorLinkProps) {
  const navigate = useAnchorNavigation(onNavigate);
  return (
    <Link
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) navigate(event);
      }}
    />
  );
}
