import type { UiStrings } from "@/i18n/ui";
import { cn } from "@/lib/utils";

import type { SiteCredit } from "./content";

const tones = {
  light: "text-white/55 hover:text-white/90 [&_[data-name]]:text-white/80",
  dark: "text-neutral-500 hover:text-neutral-950 [&_[data-name]]:text-neutral-900",
};

const sizes = {
  sm: "gap-1.5 text-caption-2 [&_[data-label]]:text-footnote",
  lg: "gap-2.5 text-subheadline sm:text-headline [&_[data-label]]:text-title-3 sm:[&_[data-label]]:text-title-2",
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
