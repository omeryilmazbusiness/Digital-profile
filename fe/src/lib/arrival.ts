/**
 * The landing page is one document; some of its sections also have an address of their own
 * (`data-path="/momen"`), so they can be shared and opened directly.
 */

/** The section that owns `path` in the current document, if any. */
export function sectionForPath(path: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-path="${CSS.escape(path)}"]`);
}

/**
 * Whether `path` is shown by the current document: its own path, or — on the landing page —
 * "/" or one of its sections.
 */
export function isInDocument(path: string): boolean {
  return path === location.pathname || (onLanding(path) && onLanding(location.pathname));
}

/** Where a visit opens: the element named by the URL's fragment, or the path's own section. */
export function arrivalTarget(): HTMLElement | null {
  if (location.hash) return document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (location.pathname === "/") return null;
  return sectionForPath(location.pathname);
}

function onLanding(path: string): boolean {
  return path === "/" ? document.querySelector("[data-path]") !== null : !!sectionForPath(path);
}
