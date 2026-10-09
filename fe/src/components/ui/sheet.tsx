"use client";

import { X } from "lucide-react";
import { Dialog } from "radix-ui";
import { createContext, use, useRef } from "react";
import type * as React from "react";

import { IconButton } from "@/components/ui/icon-button";
import { useControllableState } from "@/hooks/use-controllable-state";
import { cn } from "@/lib/utils";

/** Distance (px) or fling speed (px/ms) past which releasing a drag dismisses the sheet. */
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 0.5;

const SheetContext = createContext<{ close: () => void } | null>(null);

export interface SheetProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

/** A modal bottom sheet on phones and a centered panel on wider screens. */
export function Sheet({ open, defaultOpen = false, onOpenChange, children }: SheetProps) {
  const [isOpen, setOpen] = useControllableState(open, defaultOpen, onOpenChange);
  return (
    <SheetContext value={{ close: () => setOpen(false) }}>
      <Dialog.Root open={isOpen} onOpenChange={setOpen}>
        {children}
      </Dialog.Root>
    </SheetContext>
  );
}

export const SheetTrigger = Dialog.Trigger;
export const SheetClose = Dialog.Close;

export interface SheetContentProps extends Omit<
  React.ComponentProps<typeof Dialog.Content>,
  "title"
> {
  title: React.ReactNode;
  /** Keep the title for assistive technology only. */
  hideTitle?: boolean;
  description?: React.ReactNode;
  closeLabel?: string;
  /** Footer pinned under the scrolling body, e.g. the primary action. */
  footer?: React.ReactNode;
}

export function SheetContent({
  title,
  hideTitle,
  description,
  closeLabel = "Close",
  footer,
  className,
  children,
  ...props
}: SheetContentProps) {
  const ctx = use(SheetContext);
  const contentRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; t: number; dy: number; v: number } | null>(null);

  const setOffset = (dy: number) => {
    const el = contentRef.current;
    if (!el) return;
    el.style.transform = dy ? `translate3d(0, ${dy}px, 0)` : "";
    el.style.transition = drag.current ? "none" : "";
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || window.matchMedia("(min-width: 48rem)").matches) return;
    if ((e.target as HTMLElement).closest("button, a, input, textarea, select")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, t: performance.now(), dy: 0, v: 0 };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const raw = e.clientY - d.y;
    // Rubber-band upwards, follow the finger downwards.
    const dy = raw < 0 ? -Math.sqrt(-raw) * 2 : raw;
    const now = performance.now();
    d.v = (dy - d.dy) / Math.max(now - d.t, 1);
    d.dy = dy;
    d.t = now;
    setOffset(dy);
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.dy > DISMISS_DISTANCE || d.v > DISMISS_VELOCITY) {
      // The closing animation continues from the current offset (no `from` keyframe).
      ctx?.close();
    } else {
      setOffset(0);
    }
  };

  return (
    <Dialog.Portal>
      <Dialog.Overlay
        data-slot="sheet-overlay"
        className="fixed inset-0 z-50 bg-black/40 data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in"
      />
      <Dialog.Content
        ref={contentRef}
        data-slot="sheet"
        {...(description ? {} : { "aria-describedby": undefined })}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[calc(100dvh-env(safe-area-inset-top,0px)-0.75rem)] w-full max-w-xl flex-col",
          "rounded-t-2xl bg-bg-elevated text-label shadow-float outline-none",
          "transition-transform duration-(--duration-base) ease-ios",
          "data-[state=closed]:animate-sheet-down data-[state=open]:animate-sheet-up",
          "md:inset-0 md:m-auto md:h-fit md:max-h-[min(85dvh,48rem)] md:max-w-lg md:rounded-2xl",
          "md:data-[state=closed]:animate-fade-out md:data-[state=open]:animate-pop-in",
          className,
        )}
        {...props}
      >
        <div
          className="shrink-0 cursor-grab touch-none select-none active:cursor-grabbing md:cursor-auto"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div
            aria-hidden
            className="mx-auto mt-1.5 h-[0.3125rem] w-9 rounded-full bg-fill md:hidden"
          />
          <div className="relative flex min-h-12 items-center justify-center px-14 pt-1.5 pb-2 md:pt-3">
            <Dialog.Title
              className={cn("truncate text-center text-headline", hideTitle && "sr-only")}
            >
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <IconButton
                label={closeLabel}
                size="sm"
                className="absolute end-3 top-1/2 -translate-y-1/2 text-label-secondary md:top-[calc(50%+0.375rem)]"
              >
                <X strokeWidth={2.5} />
              </IconButton>
            </Dialog.Close>
          </div>
          {description && (
            <Dialog.Description className="px-5 pb-2 text-center text-subheadline text-label-secondary">
              {description}
            </Dialog.Description>
          )}
        </div>
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4",
            footer ? "pb-4" : "pb-safe-4",
          )}
        >
          {children}
        </div>
        {footer && (
          <div className="shrink-0 border-t-[0.5px] border-separator px-4 pt-3 pb-safe-3">
            {footer}
          </div>
        )}
      </Dialog.Content>
    </Dialog.Portal>
  );
}
