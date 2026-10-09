import { cva } from "class-variance-authority";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type * as React from "react";

import { cn } from "@/lib/utils";

export interface ListSectionProps extends Omit<React.ComponentProps<"section">, "title"> {
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

/** An inset grouped section: rounded rows on a grouped background, like iOS Settings. */
export function ListSection({ header, footer, className, children, ...props }: ListSectionProps) {
  return (
    <section data-slot="list-section" className={cn("grid gap-1.5", className)} {...props}>
      {header && (
        <h2 className="px-4 text-footnote tracking-wide text-label-secondary uppercase">
          {header}
        </h2>
      )}
      <ul role="list" className="overflow-hidden rounded-xl bg-bg-grouped-secondary">
        {children}
      </ul>
      {footer && <p className="px-4 text-footnote text-label-secondary">{footer}</p>}
    </section>
  );
}

const iconTile = cva(
  "flex size-[1.875rem] shrink-0 items-center justify-center rounded-[0.4375rem] text-white [&_svg]:size-[1.125rem]",
  {
    variants: {
      color: {
        tint: "bg-tint",
        gold: "bg-gold",
        blue: "bg-system-blue",
        green: "bg-switch-on",
        red: "bg-system-red",
        orange: "bg-system-orange",
        indigo: "bg-system-indigo",
        teal: "bg-system-teal",
        gray: "bg-system-gray",
      },
    },
    defaultVariants: { color: "tint" },
  },
);

export type ListIconColor = NonNullable<Parameters<typeof iconTile>[0]>["color"];

/** The colored rounded-square icon that leads a settings-style row. */
export function ListIcon({
  color,
  className,
  children,
}: {
  color?: ListIconColor;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span aria-hidden className={cn(iconTile({ color }), className)}>
      {children}
    </span>
  );
}

interface ListItemBase {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Leading visual: a ListIcon, an Avatar or an image. */
  leading?: React.ReactNode;
  /** Trailing value text, such as the current setting. */
  detail?: React.ReactNode;
  /** Trailing control (a Switch, a Badge); rendered instead of the chevron. */
  trailing?: React.ReactNode;
  tone?: "default" | "tint" | "destructive";
  className?: string;
}

export type ListItemProps = ListItemBase &
  (
    | { href: string; external?: boolean; onClick?: never }
    | { href?: never; external?: never; onClick: React.MouseEventHandler<HTMLButtonElement> }
    | { href?: never; external?: never; onClick?: never }
  );

const titleTone = {
  default: "text-label",
  tint: "text-tint",
  destructive: "text-system-red",
} as const;

/**
 * A row in a ListSection. With href it is a link and with onClick a button, both showing a
 * chevron and press feedback; otherwise a static row.
 */
export function ListItem(props: ListItemProps) {
  const {
    title,
    subtitle,
    leading,
    detail,
    trailing,
    tone = "default",
    className,
    href,
    external,
    onClick,
  } = props;
  const interactive = href !== undefined || onClick !== undefined;

  const content = (
    <>
      {leading}
      <span className="flex min-w-0 flex-1 flex-col py-2.5">
        <span className={cn("truncate text-body", titleTone[tone])}>{title}</span>
        {subtitle && (
          <span className="truncate text-subheadline text-label-secondary">{subtitle}</span>
        )}
      </span>
      {detail && <span className="shrink-0 text-body text-label-secondary">{detail}</span>}
      {trailing}
      {interactive && !trailing && (
        <ChevronRight
          aria-hidden
          strokeWidth={2.5}
          className="size-4 shrink-0 text-label-tertiary rtl:-scale-x-100"
        />
      )}
    </>
  );

  const row = cn(
    "relative flex min-h-11 w-full items-center gap-3 ps-4 pe-4 text-start outline-none",
    // Inset hairline separator, aligned with the text and hidden under the last row.
    "after:absolute after:end-0 after:bottom-0 after:h-px after:origin-bottom after:scale-y-50 after:bg-separator group-last/item:after:hidden",
    leading ? "after:start-[3.75rem]" : "after:start-4",
    interactive &&
      "cursor-pointer transition-colors duration-(--duration-fast) select-none [-webkit-tap-highlight-color:transparent] hover:bg-fill-quaternary focus-visible:bg-fill-quaternary active:bg-fill-tertiary",
    className,
  );

  return (
    <li data-slot="list-item" className="group/item">
      {href !== undefined ? (
        <Link
          href={href}
          className={row}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {content}
        </Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} className={row}>
          {content}
        </button>
      ) : (
        <div className={row}>{content}</div>
      )}
    </li>
  );
}
