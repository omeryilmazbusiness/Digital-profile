import type { ReactNode } from "react";

import { Document } from "../document";

export { metadata, viewport } from "../document";

export default function DevLayout({ children }: { children: ReactNode }) {
  return <Document>{children}</Document>;
}
