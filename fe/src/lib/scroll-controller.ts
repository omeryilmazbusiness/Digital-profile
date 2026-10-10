/** The part of Lenis the controller drives. */
export interface SmoothScroller {
  stop(): void;
  start(): void;
  scrollTo(top: number): void;
}

/**
 * Locks page scrolling for loaders and modal flows, and scrolls to sections. Locks nest:
 * scrolling resumes when the last one is released. Works with or without a smooth scroller
 * attached — the native overflow lock covers touch scrolling, which Lenis leaves to the
 * browser.
 */
export class ScrollController {
  private locks = 0;
  private scroller: SmoothScroller | null = null;

  constructor(private readonly root: () => HTMLElement | null = defaultRoot) {}

  /** Attaches the active smooth scroller, applying a lock taken before it existed. */
  attach(scroller: SmoothScroller): () => void {
    this.scroller = scroller;
    if (this.locks > 0) scroller.stop();
    return () => {
      if (this.scroller === scroller) this.scroller = null;
    };
  }

  /** Returns the release function; calling it more than once has no further effect. */
  lock(): () => void {
    if (this.locks++ === 0) this.apply(true);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      if (--this.locks === 0) this.apply(false);
    };
  }

  get locked(): boolean {
    return this.locks > 0;
  }

  /**
   * Scrolls to an element (or a page offset), keeping it clear of the fixed header the way
   * native anchors do: the root's scroll-padding-top plus the target's scroll-margin-top.
   * Ignored while locked.
   */
  scrollTo(target: HTMLElement | number): void {
    if (this.locked) return;
    const top =
      typeof target === "number"
        ? target
        : window.scrollY + target.getBoundingClientRect().top - this.clearance(target);
    if (this.scroller) this.scroller.scrollTo(top);
    else window.scrollTo({ top });
  }

  private clearance(target: HTMLElement): number {
    const root = this.root();
    const padding = root ? parseFloat(getComputedStyle(root).scrollPaddingTop) : 0;
    const margin = parseFloat(getComputedStyle(target).scrollMarginTop);
    return (padding || 0) + (margin || 0);
  }

  private apply(locked: boolean) {
    const el = this.root();
    if (el) el.style.overflow = locked ? "hidden" : "";
    if (locked) this.scroller?.stop();
    else this.scroller?.start();
  }
}

function defaultRoot(): HTMLElement | null {
  return typeof document === "undefined" ? null : document.documentElement;
}
