"use client";

import { CircleAlert, CircleCheck, Info } from "lucide-react";
import { Toast as ToastPrimitive } from "radix-ui";
import { useSyncExternalStore } from "react";
import type * as React from "react";

import { cn } from "@/lib/utils";

export type ToastTone = "info" | "success" | "error";

export interface ToastOptions {
  description?: React.ReactNode;
  tone?: ToastTone;
  /** Milliseconds before auto-dismiss; errors stay longer by default. */
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastItem extends ToastOptions {
  id: number;
  title: React.ReactNode;
  open: boolean;
}

/** Exit animation length; closed toasts are removed after it. */
const EXIT_MS = 300;
const MAX_VISIBLE = 3;

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const EMPTY: ToastItem[] = [];

function emit(next: ToastItem[]) {
  items = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function dismissToast(id: number) {
  emit(items.map((t) => (t.id === id ? { ...t, open: false } : t)));
  setTimeout(() => emit(items.filter((t) => t.id !== id)), EXIT_MS);
}

/** Shows a transient banner; callable from anywhere on the client. Returns its id. */
export function toast(title: React.ReactNode, options: ToastOptions = {}): number {
  const id = nextId++;
  const visible = items.filter((t) => t.open);
  if (visible.length >= MAX_VISIBLE) dismissToast(visible[0].id);
  emit([...items, { id, title, open: true, ...options }]);
  return id;
}

toast.success = (title: React.ReactNode, options?: Omit<ToastOptions, "tone">) =>
  toast(title, { ...options, tone: "success" });
toast.error = (title: React.ReactNode, options?: Omit<ToastOptions, "tone">) =>
  toast(title, { ...options, tone: "error" });

const icons: Record<ToastTone, React.ReactNode> = {
  info: <Info className="text-tint" />,
  success: <CircleCheck className="text-system-green" />,
  error: <CircleAlert className="text-system-red" />,
};

/** Mount once in the root layout. */
export function Toaster({ label = "Notifications" }: { label?: string }) {
  const list = useSyncExternalStore(
    subscribe,
    () => items,
    () => EMPTY,
  );

  return (
    <ToastPrimitive.Provider swipeDirection="up" label={label}>
      {list.map((t) => {
        const tone = t.tone ?? "info";
        return (
          <ToastPrimitive.Root
            key={t.id}
            open={t.open}
            onOpenChange={(open) => !open && dismissToast(t.id)}
            duration={t.duration ?? (tone === "error" ? 8000 : 4000)}
            type={tone === "error" ? "foreground" : "background"}
            data-tone={tone}
            className={cn(
              "pointer-events-auto flex w-full items-center gap-3 rounded-2xl material-thick px-4 py-3 shadow-float",
              "data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:slide-in-from-top-6",
              "data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:slide-out-to-top-6",
              "data-[swipe=cancel]:translate-y-0 data-[swipe=cancel]:transition-transform data-[swipe=move]:translate-y-(--radix-toast-swipe-move-y)",
              "data-[swipe=end]:animate-out data-[swipe=end]:fade-out data-[swipe=end]:slide-out-to-top-full",
            )}
          >
            <span aria-hidden className="shrink-0 [&_svg]:size-6">
              {icons[tone]}
            </span>
            <div className="grid min-w-0 flex-1 gap-0.5">
              <ToastPrimitive.Title className="text-subheadline font-semibold text-label">
                {t.title}
              </ToastPrimitive.Title>
              {t.description && (
                <ToastPrimitive.Description className="text-footnote text-label-secondary">
                  {t.description}
                </ToastPrimitive.Description>
              )}
            </div>
            {t.action && (
              <ToastPrimitive.Action
                altText={t.action.label}
                onClick={t.action.onClick}
                className="shrink-0 pressable rounded-full bg-fill-tertiary px-3 py-1.5 text-subheadline font-semibold text-tint"
              >
                {t.action.label}
              </ToastPrimitive.Action>
            )}
          </ToastPrimitive.Root>
        );
      })}
      <ToastPrimitive.Viewport className="pointer-events-none fixed inset-x-0 top-0 z-[100] mx-auto flex w-full max-w-md flex-col gap-2 px-4 pt-safe-2 outline-none" />
    </ToastPrimitive.Provider>
  );
}
