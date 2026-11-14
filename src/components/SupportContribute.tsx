"use client";

import { useState } from "react";
import { OPEN_COLLECTIVE_URL } from "@/lib/config";
import { cn } from "@/lib/cn";

type Cadence = "once" | "monthly";

function contributeHref(cadence: Cadence): string {
  const base = OPEN_COLLECTIVE_URL.replace(/\/$/, "");
  // Open Collective donate page accepts interval=onetime|month
  const interval = cadence === "monthly" ? "month" : "onetime";
  return `${base}/donate?interval=${interval}`;
}

const OPTIONS = [
  ["once", "One-off"],
  ["monthly", "Monthly"],
] as const;

export function SupportContribute() {
  const [cadence, setCadence] = useState<Cadence>("once");

  return (
    <div className="mt-6 flex flex-col gap-3">
      <div
        className="relative inline-grid w-full max-w-sm grid-cols-2 rounded-[var(--radius-control)] border border-white/36 bg-white/10 p-1 sm:w-auto"
        role="group"
        aria-label="Contribution cadence"
      >
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-1 left-1 z-0 w-[calc(50%-0.25rem)] rounded-[calc(var(--radius-control)-4px)] bg-mint shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
            cadence === "monthly" && "translate-x-full",
          )}
        />
        {OPTIONS.map(([id, label]) => {
          const active = cadence === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              className={cn(
                "relative z-10 min-h-11 rounded-[calc(var(--radius-control)-4px)] px-4 text-sm font-semibold transition-colors duration-200 motion-reduce:transition-none sm:min-w-[7.5rem]",
                active ? "text-night" : "text-white/85 hover:text-white",
              )}
              onClick={() => setCadence(id)}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <a
          href={contributeHref(cadence)}
          target="_blank"
          rel="noreferrer"
          className="btn-primary inline-flex w-full items-center justify-center px-6 sm:w-auto"
        >
          Contribute on Open Collective
        </a>
        <a
          href={`${OPEN_COLLECTIVE_URL.replace(/\/$/, "")}#section-budget`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-12 w-full items-center justify-center rounded-[var(--radius-control)] border border-white/36 px-6 text-sm font-semibold text-white sm:w-auto"
        >
          View Public Ledger
        </a>
      </div>
    </div>
  );
}
