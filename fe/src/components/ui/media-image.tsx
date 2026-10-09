import type * as React from "react";

import { fallbackSrc, type ImageSource, srcSet } from "@/lib/media";
import { cn } from "@/lib/utils";

const PLACEHOLDER = /^data:image\/webp;base64,[A-Za-z0-9+/]+=*$/;

export interface MediaImageProps extends Omit<
  React.ComponentProps<"img">,
  "src" | "srcSet" | "width" | "height" | "alt" | "className"
> {
  /** An uploaded image (API Media) or anything with its variants and dimensions. */
  source: ImageSource;
  /** Required; pass "" only for purely decorative images. */
  alt: string;
  /** Rendered width per breakpoint, so the browser picks the right variant. */
  sizes?: string;
  /** Above-the-fold image (hero): loads eagerly with high priority. */
  priority?: boolean;
  /** Fill the nearest positioned ancestor instead of keeping the intrinsic aspect ratio. */
  fill?: boolean;
  fit?: "cover" | "contain";
  /** Blurred preview while loading; turn off for images with transparency. */
  placeholder?: boolean;
  className?: string;
  imgClassName?: string;
}

/**
 * Responsive image for media library uploads. The API already renders WebP variants, so this
 * is a plain <img> with srcset: no runtime optimizer, and the blurred LQIP shows through
 * until the image paints. The reserved aspect ratio prevents layout shift.
 */
export function MediaImage({
  source,
  alt,
  sizes = "100vw",
  priority = false,
  fill = false,
  fit = "cover",
  placeholder = true,
  className,
  imgClassName,
  ...props
}: MediaImageProps) {
  const lqip =
    placeholder && source.placeholder && PLACEHOLDER.test(source.placeholder)
      ? source.placeholder
      : undefined;

  return (
    <span
      data-slot="media-image"
      className={cn(
        "relative block overflow-hidden bg-fill-quaternary",
        fill && "absolute inset-0",
        className,
      )}
      style={fill ? undefined : { aspectRatio: `${source.width} / ${source.height}` }}
    >
      {lqip && (
        <span
          aria-hidden
          className="absolute inset-0 scale-110 bg-cover bg-center blur-xl"
          style={{ backgroundImage: `url("${lqip}")` }}
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element -- variants are pre-optimized by the API */}
      <img
        src={fallbackSrc(source)}
        srcSet={srcSet(source)}
        sizes={sizes}
        alt={alt}
        width={source.width}
        height={source.height}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        decoding="async"
        className={cn(
          "relative size-full",
          fit === "cover" ? "object-cover" : "object-contain",
          imgClassName,
        )}
        {...props}
      />
    </span>
  );
}
