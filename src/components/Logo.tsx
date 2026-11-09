import Link from "next/link";
import { cn } from "@/lib/cn";

/** Mint square mark: 2×2 night squares (TL+BR solid, TR+BL 35% opacity) + LSEmods wordmark. */
export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/courses"
      className={cn("inline-flex items-center gap-2.5 text-white", className)}
      aria-label="LSEmods home"
    >
      <span
        className="grid size-8 shrink-0 grid-cols-2 grid-rows-2 gap-0.5 rounded-[8px] bg-mint p-1.5"
        aria-hidden
      >
        <span className="rounded-[2px] bg-mint-fg" />
        <span className="rounded-[2px] bg-mint-fg/35" />
        <span className="rounded-[2px] bg-mint-fg/35" />
        <span className="rounded-[2px] bg-mint-fg" />
      </span>
      <span className="font-display text-lg font-extrabold tracking-tight lg:text-xl">
        LSEmods
      </span>
    </Link>
  );
}
