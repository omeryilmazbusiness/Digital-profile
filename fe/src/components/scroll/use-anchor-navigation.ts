"use client";

import type * as React from "react";

import { useScrollController } from "./smooth-scroll-provider";

/**
 * Click handler for site links. A link to the current page ("/#tour" on the home page, or
 * "/" itself) scrolls through the page's scroll controller, so smooth scrolling and the
 * header offset apply, and updates the URL; anything else is left to the router.
 * `onNavigate` runs for every followed link, e.g. to close the menu the link is in.
 * Modified clicks keep their browser behavior.
 */
export function useAnchorNavigation(onNavigate?: () => void) {
  const controller = useScrollController();

  return (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    const url = new URL(event.currentTarget.href, location.href);
    const samePage =
      url.origin === location.origin &&
      url.pathname === location.pathname &&
      url.search === location.search;
    const id = decodeURIComponent(url.hash.slice(1));
    const target = id === "" ? 0 : document.getElementById(id);
    if (!samePage || target === null) {
      onNavigate?.();
      return;
    }

    event.preventDefault();
    onNavigate?.();
    // Closing a menu releases its scroll lock in an effect; scroll once that has run.
    requestAnimationFrame(() => {
      controller.scrollTo(target);
      history.replaceState(history.state, "", url.hash || url.pathname);
    });
  };
}
