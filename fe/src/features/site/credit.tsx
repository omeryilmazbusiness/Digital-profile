import type { UiStrings } from "@/i18n/ui";
import { cn } from "@/lib/utils";

import type { SiteCredit } from "./content";

const tones = {
  light: "text-white/75 hover:text-white [&_[data-name]]:text-white",
  dark: "text-neutral-600 hover:text-neutral-950 [&_[data-name]]:text-neutral-950",
};

const sizes = {
  sm: "gap-2 text-footnote [&_[data-label]]:text-title-3",
  lg: "gap-3 text-headline sm:text-title-3 [&_[data-label]]:text-title-1 sm:[&_[data-label]]:text-large-title",
  hero: "gap-3 text-title-3 sm:gap-4 sm:text-title-1 [&_[data-label]]:text-[2.5rem] sm:[&_[data-label]]:text-[3.5rem]",
};

/** Seconds between two letters writing in. */
const LETTER_STAGGER = 0.07;

/**
 * The studio's signature, "by widdigroup.com": an italic serif "by" and the name, spaced out.
 * The hero size writes itself letter by letter, over and over (static under reduced motion).
 * Renders nothing when the site has it turned off.
 */
export function Credit({
  credit,
  ui,
  tone = "dark",
  size = "sm",
  className,
}: {
  credit: SiteCredit | undefined;
  ui: Pick<UiStrings, "opensInNewTab">;
  tone?: keyof typeof tones;
  size?: keyof typeof sizes;
  className?: string;
}) {
  if (!credit) return null;
  const animated = size === "hero";
  return (
    <a
      href={credit.href}
      target="_blank"
      rel="noopener"
      className={cn(
        "inline-flex items-baseline transition-colors duration-500 ease-ios",
        tones[tone],
        sizes[size],
        className,
      )}
    >
      <span
        data-label
        className={cn(
          "font-display italic",
          animated && "inline-block pe-[0.08em] motion-safe:animate-credit-write",
        )}
      >
        {credit.label}
      </span>{" "}
      <span data-name className="font-medium tracking-[0.22em] transition-colors duration-500">
        {animated ? (
          <>
            <span className="sr-only">{credit.name}</span>
            <span aria-hidden dir="ltr">
              {[...credit.name].map((ch, i) => (
                <span
                  key={i}
                  className="inline-block motion-safe:animate-credit-write"
                  style={{ animationDelay: `${(i + 1) * LETTER_STAGGER}s` }}
                >
                  {ch}
                </span>
              ))}
            </span>
          </>
        ) : (
          credit.name
        )}
      </span>{" "}
      <span className="sr-only">{ui.opensInNewTab}</span>
    </a>
  );
}
