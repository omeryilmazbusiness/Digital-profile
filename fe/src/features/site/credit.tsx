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
};

/**
 * The studio's signature, "by widdigroup.com": an italic serif "by" and the name, spaced out.
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
      <span data-label className="font-display italic">
        {credit.label}
      </span>{" "}
      <span data-name className="font-medium tracking-[0.22em] transition-colors duration-500">
        {credit.name}
      </span>{" "}
      <span className="sr-only">{ui.opensInNewTab}</span>
    </a>
  );
}
