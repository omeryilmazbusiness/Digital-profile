"use client";

import { Switch as SwitchPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

/** iOS toggle (51×31pt). The thumb stretches while pressed and mirrors in RTL. */
export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "group relative inline-flex h-[1.9375rem] w-[3.1875rem] shrink-0 cursor-pointer items-center rounded-full bg-fill p-0.5",
        "transition-colors duration-(--duration-base) ease-ios [-webkit-tap-highlight-color:transparent]",
        "disabled:cursor-not-allowed disabled:opacity-40 data-[state=checked]:bg-switch-on",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block h-[1.6875rem] w-[1.6875rem] rounded-full bg-white shadow-[0_3px_8px_rgb(0_0_0/0.15),0_1px_1px_rgb(0_0_0/0.16)]",
          "transition-[translate,width] duration-(--duration-base) ease-spring group-active:w-8",
          "data-[state=checked]:translate-x-5 group-active:data-[state=checked]:translate-x-[0.9375rem]",
          "rtl:data-[state=checked]:-translate-x-5 rtl:group-active:data-[state=checked]:-translate-x-[0.9375rem]",
        )}
      />
    </SwitchPrimitive.Root>
  );
}
