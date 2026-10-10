import localFont from "next/font/local";

/**
 * Bodoni Moda at its display optical size, Latin only (scripts/build-display-font.py). Sets
 * --font-bodoni; use it through the `font-display` utility.
 */
export const displayFont = localFont({
  src: [
    { path: "./fonts/bodoni-moda.woff2", style: "normal", weight: "400 700" },
    { path: "./fonts/bodoni-moda-italic.woff2", style: "italic", weight: "400 700" },
  ],
  variable: "--font-bodoni",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});
