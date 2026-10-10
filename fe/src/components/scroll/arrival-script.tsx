/**
 * Opens the page at the section the URL names (/#tour, .../momen) before its first paint: the
 * layout is final in the server's HTML, so this runs inline, right after the content, rather
 * than waiting for scripts to load. <ArrivalScroll> corrects the position later if needed.
 * Mirrors `arrivalTarget()` in lib/arrival.
 */
export function ArrivalScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}

const SCRIPT = `(function(){try{var h=location.hash,e=h?document.getElementById(decodeURIComponent(h.slice(1))):document.querySelector('[data-path="'+CSS.escape(location.pathname)+'"]');if(e&&!e.hasAttribute("data-landing"))e.scrollIntoView({block:"start"})}catch(_){}})()`;
