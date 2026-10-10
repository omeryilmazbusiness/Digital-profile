import { cn } from "@/lib/utils";

/** The hotel name set as a two-line wordmark: brand above, property below. */
export function Wordmark({ name, className }: { name: string; className?: string }) {
  const [brand = name, ...rest] = name.split(" ");
  return (
    <span className={cn("flex flex-col leading-none", className)}>
      <span className="text-[0.95rem] font-semibold tracking-[0.34em] uppercase">{brand}</span>{" "}
      {rest.length > 0 && (
        <span className="mt-1.5 text-[0.625rem] font-medium tracking-[0.26em] uppercase opacity-65">
          {rest.join(" ")}
        </span>
      )}
    </span>
  );
}
