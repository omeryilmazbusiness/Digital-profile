import localFont from "next/font/local";

/**
 * Instrument Serif, Latin only (scripts/build-display-font.py). Sets --font-display-serif; use
 * it through the `font-display` utility.
 */
export const displayFont = localFont({
  src: [
    { path: "./fonts/instrument-serif.woff2", style: "normal", weight: "400" },
    { path: "./fonts/instrument-serif-italic.woff2", style: "italic", weight: "400" },
  ],
  variable: "--font-display-serif",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});
