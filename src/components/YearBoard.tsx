"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { MoreHorizontal, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import type { Plan, Slot } from "@/lib/planStore";
import { planActions } from "@/lib/planStore";
import {
  SLOT_LABEL,
  YEAR_MAX_UNITS,
  fmtUnits,
  type Issue,
  type YearSummary,
} from "@/lib/plannerLogic";
import { unitLabel } from "@/lib/labels";
import type { IndexEntry } from "@/lib/types";
import { cn } from "@/lib/cn";

export function YearBoard({
  year,
  plan,
  byCode,
  issues,
  menuFor,
  setMenuFor,
  onAdd,
}: {
  year: YearSummary;
  plan: Plan;
  byCode: Map<string, IndexEntry>;
  issues: Map<string, Issue[]>;
  menuFor: string | null;
  setMenuFor: (code: string | null) => void;
  onAdd: (code: string) => void;
}) {
  const columns: { slot: Slot; codes: string[] }[] = [
    { slot: "BOTH", codes: year.bySlot.BOTH },
    { slot: "AT", codes: year.bySlot.AT },
    { slot: "WS", codes: year.bySlot.WS },
  ];
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuFor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuFor(null);
    };
    const onPointer = (e: MouseEvent | PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuFor(null);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [menuFor, setMenuFor]);

  return (
    <section className="rounded-[var(--radius)] border border-line bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl text-night">Year {year.year}</h2>
        <p
          className={cn(
            "text-sm tabular",
            year.units > YEAR_MAX_UNITS ? "text-danger" : "text-muted",
          )}
        >
          {fmtUnits(year.units)} / {YEAR_MAX_UNITS} units
        </p>
      </div>
      {year.issues.map((i, n) => (
        <p
          key={n}
          className={cn(
            "mt-1 inline-flex items-start gap-1.5 text-xs",
            i.severity === "error" ? "text-danger" : "text-muted",
          )}
        >
          {i.severity === "error" ? (
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          ) : null}
          {i.text}
        </p>
      ))}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {columns
          .filter((c) => c.slot !== "BOTH" || c.codes.length > 0)
          .map(({ slot, codes }) => (
            <div
              key={slot}
              className={cn(
                "rounded-[var(--radius-inner)] border border-dashed border-line bg-lilac-deep/40 p-2",
                slot === "BOTH" && "sm:col-span-2",
              )}
            >
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                {SLOT_LABEL[slot]}
              </h3>
              <ul className="mt-2 space-y-2">
                {codes.map((code) => {
                  const e = byCode.get(code);
                  const item = plan.items.find((i) => i.code === code)!;
                  const open = menuFor === code;
                  return (
                    <li
                      key={code}
                      className="relative rounded-[var(--radius-inner)] border border-line bg-paper p-2.5 text-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Link
                              href={`/courses/${code}`}
                              className="chip-code rounded-md px-1.5 py-0.5 text-xs font-semibold tabular underline-offset-2 hover:underline"
                            >
                              {code}
                            </Link>
                            <span className="chip-unit rounded-md px-1.5 py-0.5 text-[10px] font-medium">
                              {unitLabel(e?.units ?? null)}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs font-medium text-night">
                            {e?.title ?? "Unknown"}
                          </p>
                          {(issues.get(code) || []).map((iss, n) => (
                            <p
                              key={n}
                              className={cn(
                                "text-xs",
                                iss.severity === "error" ? "text-danger" : "text-muted",
                              )}
                            >
                              {iss.text}
                            </p>
                          ))}
                        </div>
                        <div ref={open ? menuRef : undefined} className="relative shrink-0">
                          <button
                            type="button"
                            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-control)] border border-line-strong bg-surface text-night hover:bg-lilac"
                            aria-label={`Options for ${code}`}
                            aria-expanded={open}
                            aria-haspopup="menu"
                            onClick={() => setMenuFor(open ? null : code)}
                          >
                            <MoreHorizontal className="size-5" aria-hidden />
                          </button>
                          {open && (
                            <div
                              role="menu"
                              aria-label={`${code} options`}
                              className="absolute right-0 top-12 z-10 w-48 rounded-[var(--radius-control)] border border-line bg-surface p-1 shadow-lg"
                            >
                              {Array.from({ length: plan.years }, (_, i) => i + 1).map((yr) => (
                                <button
                                  key={yr}
                                  type="button"
                                  role="menuitem"
                                  className="block min-h-11 w-full rounded-[var(--radius-badge)] px-3 text-left text-sm hover:bg-lilac"
                                  onClick={() => {
                                    planActions.add(code, yr);
                                    setMenuFor(null);
                                    toast.message(`Moved ${code} to Year ${yr}`);
                                  }}
                                >
                                  Move to Year {yr}
                                </button>
                              ))}
                              {(["AT", "WS", "BOTH"] as Slot[]).map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  role="menuitem"
                                  className="block min-h-11 w-full rounded-[var(--radius-badge)] px-3 text-left text-sm hover:bg-lilac"
                                  onClick={() => {
                                    planActions.add(code, item.year, s);
                                    setMenuFor(null);
                                  }}
                                >
                                  Term: {SLOT_LABEL[s]}
                                </button>
                              ))}
                              <button
                                type="button"
                                role="menuitem"
                                className="block min-h-11 w-full rounded-[var(--radius-badge)] px-3 text-left text-sm text-danger hover:bg-lilac"
                                onClick={() => {
                                  planActions.remove(code);
                                  setMenuFor(null);
                                  toast.message(`Removed ${code}`);
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
                {codes.length === 0 && (
                  <li className="px-1 py-2 text-xs text-muted">Add courses below</li>
                )}
              </ul>
            </div>
          ))}
      </div>

      <AddBox year={year.year} byCode={byCode} onAdd={onAdd} />
    </section>
  );
}

function AddBox({
  year,
  byCode,
  onAdd,
}: {
  year: number;
  byCode: Map<string, IndexEntry>;
  onAdd: (code: string) => void;
}) {
  const [q, setQ] = useState("");
  const hits = useMemo(() => {
    const t = q.trim().toUpperCase();
    if (t.length < 2) return [];
    return [...byCode.values()]
      .filter((c) => c.code.includes(t) || c.title.toUpperCase().includes(t))
      .slice(0, 8);
  }, [q, byCode]);

  return (
    <div className="mt-3">
      <label className="block text-sm font-medium text-night">
        Add course to Year {year}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Code or title"
          className="field-input mt-1.5"
        />
      </label>
      {hits.length > 0 && (
        <ul className="mt-1 rounded-[var(--radius-control)] border border-line bg-surface shadow" role="listbox">
          {hits.map((c) => (
            <li key={c.code}>
              <button
                type="button"
                role="option"
                className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm hover:bg-lilac"
                onClick={() => {
                  onAdd(c.code);
                  setQ("");
                }}
              >
                <span className="font-semibold tabular text-night">{c.code}</span>
                <span className="truncate text-muted">{c.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
