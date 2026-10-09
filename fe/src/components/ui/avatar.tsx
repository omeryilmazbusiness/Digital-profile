"use client";

import { Avatar as AvatarPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

const sizes = {
  sm: "size-8 text-footnote",
  md: "size-11 text-headline",
  lg: "size-16 text-title-3",
  xl: "size-24 text-title-1",
} as const;

/** Up to two initials from the first and last words, in any script. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/u).filter(Boolean);
  if (words.length === 0) return "";
  const first = Array.from(words[0])[0] ?? "";
  const last = words.length > 1 ? (Array.from(words.at(-1)!)[0] ?? "") : "";
  return (first + last).toLocaleUpperCase();
}

export interface AvatarProps {
  /** Person's name: the image's alt text and the source of the fallback initials. */
  name: string;
  src?: string;
  size?: keyof typeof sizes;
  className?: string;
}

/** Round portrait with an initials fallback while loading or when the image fails. */
export function Avatar({ name, src, size = "md", className }: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden rounded-full bg-fill select-none",
        sizes[size],
        className,
      )}
    >
      {src && <AvatarPrimitive.Image src={src} alt={name} className="size-full object-cover" />}
      <AvatarPrimitive.Fallback
        delayMs={src ? 400 : undefined}
        className="flex size-full items-center justify-center bg-[linear-gradient(180deg,#a5abb8,#858994)] font-semibold text-white"
      >
        <span aria-hidden>{initials(name)}</span>
        <span className="sr-only">{name}</span>
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
