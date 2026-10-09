"use client";

import { useSyncExternalStore } from "react";

interface NetworkInformation extends EventTarget {
  saveData?: boolean;
}

function connection(): NetworkInformation | undefined {
  return (navigator as Navigator & { connection?: NetworkInformation }).connection;
}

function subscribe(onChange: () => void) {
  const c = connection();
  c?.addEventListener("change", onChange);
  return () => c?.removeEventListener("change", onChange);
}

/**
 * Whether the user turned on the browser's data saver (Chrome/Android "Lite mode"). Heavy
 * optional media should then be skipped. False where the API is unsupported (Safari).
 */
export function useSaveData(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => connection()?.saveData === true,
    () => false,
  );
}
