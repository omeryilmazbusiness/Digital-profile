"use client";

import { Direction } from "radix-ui";
import type * as React from "react";

export type Dir = "ltr" | "rtl";

/**
 * Tells the Radix-based components (segmented control, accordion, toast…) the reading
 * direction. Radix otherwise forces dir="ltr" on its roots, which breaks mirroring under an
 * RTL page. Wrap the app once per locale with the same value as <html dir>.
 */
export function DirectionProvider({ dir, children }: { dir: Dir; children: React.ReactNode }) {
  return <Direction.Provider dir={dir}>{children}</Direction.Provider>;
}
