import localFont from "next/font/local";

/**
 * Playfair Display, weights 500–800, Latin only (scripts/build-display-font.py). Sets
 * --font-display-serif; use it through the `font-display` utility.
 */
export const displayFont = localFont({
  src: [
    { path: "./fonts/playfair-display.woff2", style: "normal", weight: "500 800" },
    { path: "./fonts/playfair-display-italic.woff2", style: "italic", weight: "500 800" },
  ],
  variable: "--font-display-serif",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});
