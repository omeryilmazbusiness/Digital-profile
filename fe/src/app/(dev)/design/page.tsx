import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DesignGallery } from "./gallery";

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};

/** Living reference of the UI kit. Production builds hide it unless DESIGN_GALLERY=true. */
export default function DesignPage() {
  if (process.env.NODE_ENV === "production" && process.env.DESIGN_GALLERY !== "true") {
    notFound();
  }
  return <DesignGallery />;
}
