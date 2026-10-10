"use client";

import type * as React from "react";

import { useAnchorNavigation } from "./use-anchor-navigation";

export interface AnchorLinkProps extends React.ComponentProps<"a"> {
  href: `#${string}`;
  /** Runs before scrolling, e.g. to close the menu the link is in. */
  onNavigate?: () => void;
}

/** An in-page link that scrolls smoothly and clears the fixed header. */
export function AnchorLink({ onNavigate, onClick, ...props }: AnchorLinkProps) {
  const navigate = useAnchorNavigation(onNavigate);
  return (
    <a
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) navigate(event);
      }}
    />
  );
}
