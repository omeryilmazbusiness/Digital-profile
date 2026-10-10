"use client";

import type * as React from "react";

import { useScrollController } from "./smooth-scroll-provider";

/**
 * Click handler for in-page links (`#id`, or `#` for the top): scrolls through the page's
 * scroll controller, so smooth scrolling and the header offset apply, and updates the URL.
 * Plain anchors keep working without JavaScript; modified clicks keep their browser behavior.
 */
export function useAnchorNavigation(onNavigate?: () => void) {
  const controller = useScrollController();

  return (event: React.MouseEvent<HTMLAnchorElement>) => {
    const href = event.currentTarget.getAttribute("href") ?? "";
    if (!href.startsWith("#") || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = href === "#" ? 0 : document.getElementById(decodeURIComponent(href.slice(1)));
    if (target === null) return;

    event.preventDefault();
    onNavigate?.();
    // Closing a menu releases its scroll lock in an effect; scroll once that has run.
    requestAnimationFrame(() => {
      controller.scrollTo(target);
      history.replaceState(null, "", href === "#" ? location.pathname : href);
    });
  };
}
