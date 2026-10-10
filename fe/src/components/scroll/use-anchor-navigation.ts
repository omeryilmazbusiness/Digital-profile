"use client";

import type * as React from "react";

import { isInDocument, isLandingRoot, sectionForPath } from "@/lib/arrival";

import { useScrollController } from "./smooth-scroll-provider";

/**
 * Click handler for site links. A link to something on the current page (a "#tour" anchor, the
 * landing page, or a landing section with its own path such as ".../momen") scrolls through the page's scroll
 * controller, so smooth scrolling and the header offset apply, and updates the URL; anything
 * else is left to the router. `onNavigate` runs for every followed link, e.g. to close the
 * menu the link is in. Modified clicks keep their browser behavior.
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
      url.search === location.search &&
      isInDocument(url.pathname);
    const id = decodeURIComponent(url.hash.slice(1));
    const element = id ? document.getElementById(id) : sectionForPath(url.pathname);
    const target = element && isLandingRoot(element) ? 0 : element;
    if (!samePage || target === null) {
      onNavigate?.();
      return;
    }

    event.preventDefault();
    onNavigate?.();
    // Closing a menu releases its scroll lock in an effect; scroll once that has run.
    requestAnimationFrame(() => {
      controller.scrollTo(target);
      history.replaceState(history.state, "", url.pathname + url.hash);
    });
  };
}
