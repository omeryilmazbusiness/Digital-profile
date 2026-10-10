/**
 * The landing page is one document with an address (`data-path="/sheraton/en"`, marked
 * `data-landing`); some of its sections have one of their own (`data-path="/sheraton/en/momen"`),
 * so they can be shared and opened directly.
 */

/** The section (or the landing page itself) that owns `path` in the current document, if any. */
export function sectionForPath(path: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-path="${CSS.escape(path)}"]`);
}

/** Whether `section` is the landing page as a whole, which opens at its top. */
export function isLandingRoot(section: Element): boolean {
  return section.hasAttribute("data-landing");
}

/**
 * Whether `path` is shown by the current document: its own path, or — on the landing page —
 * the page or one of its sections.
 */
export function isInDocument(path: string): boolean {
  return (
    path === location.pathname || (!!sectionForPath(path) && !!sectionForPath(location.pathname))
  );
}

/** Where a visit opens: the element named by the URL's fragment, or the path's own section. */
export function arrivalTarget(): HTMLElement | null {
  if (location.hash) return document.getElementById(decodeURIComponent(location.hash.slice(1)));
  const section = sectionForPath(location.pathname);
  return section && !isLandingRoot(section) ? section : null;
}
