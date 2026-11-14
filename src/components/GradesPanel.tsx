"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import {
  analyse,
  marksFor,
  parseMarkInput,
  schemeForYears,
  statusLabel,
  TARGET_OPTIONS,
  targetLabel,
  type GradeCourse,
  type TargetClass,
  type TargetResult,
} from "@/lib/gradeLogic";
import { isValidCourseCode } from "@/lib/async";
import { gradeActions, useGrades } from "@/lib/gradeStore";
import type { Plan } from "@/lib/planStore";
import type { IndexEntry } from "@/lib/types";
import { unitLabel } from "@/lib/labels";
import { cn } from "@/lib/cn";
import { MenuSelect } from "./MenuSelect";

function TargetClassSegment({
  value,
  onChange,
  labelledBy,
}: {
  value: TargetClass;
  onChange: (next: TargetClass) => void;
  labelledBy: string;
}) {
  const groupRef = useRef<HTMLDivElement>(null);
  const index = Math.max(0, TARGET_OPTIONS.indexOf(value));
  const count = TARGET_OPTIONS.length;

  const select = (next: TargetClass) => {
    onChange(next);
    const i = TARGET_OPTIONS.indexOf(next);
    requestAnimationFrame(() => {
      const radios = groupRef.current?.querySelectorAll<HTMLElement>('[role="radio"]');
      radios?.[i]?.focus();
    });
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      select(TARGET_OPTIONS[(index + 1) % count]!);
      return;
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      select(TARGET_OPTIONS[(index - 1 + count) % count]!);
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      select(TARGET_OPTIONS[0]!);
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      select(TARGET_OPTIONS[count - 1]!);
    }
  };

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-labelledby={labelledBy}
      className="relative grid w-full grid-cols-3 gap-1 rounded-[var(--radius-control)] border border-line bg-lilac-deep p-1 md:grid-cols-6 md:gap-0"
      onKeyDown={onKeyDown}
    >
      {/* Desktop sliding thumb; mobile uses per-cell mint fill instead */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-1 left-1 z-0 hidden w-[calc((100%-0.5rem)/6)] rounded-[calc(var(--radius-control)-4px)] bg-mint shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none md:block"
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {TARGET_OPTIONS.map((cls) => {
        const active = cls === value;
        return (
          <button
            key={cls}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={targetLabel(cls)}
            tabIndex={active ? 0 : -1}
            className={cn(
              "relative z-10 min-h-11 rounded-[calc(var(--radius-control)-4px)] px-1.5 text-sm font-semibold transition-colors duration-200 motion-reduce:transition-none",
              active
                ? "bg-mint text-night md:bg-transparent"
                : "text-muted hover:bg-lilac hover:text-night md:hover:bg-transparent md:hover:text-night",
            )}
            onClick={() => select(cls)}
          >
            {cls}
          </button>
        );
      })}
    </div>
  );
}

function AimOption({
  label,
  headline,
  detail,
}: {
  label?: string;
  headline: string;
  detail?: string;
}) {
  return (
    <div className="min-w-0">
      {label ? <p className="text-xs font-medium text-muted">{label}</p> : null}
      <p
        className={cn(
          "text-base font-semibold leading-snug text-night",
          label ? "mt-1" : null,
        )}
      >
        {headline}
      </p>
      {detail ? <p className="mt-1 text-sm leading-relaxed text-muted">{detail}</p> : null}
    </div>
  );
}

function TargetSummaryBody({
  t,
  remaining,
}: {
  t: TargetResult;
  remaining: number;
}) {
  if (t.note && (t.cls === "Pass" || t.cls === "Fail")) {
    return <p className="mt-3 text-sm leading-relaxed text-muted">{t.note}</p>;
  }

  if (t.status === "secured") {
    return (
      <p className="mt-3 text-sm leading-relaxed text-muted">
        You've already got enough scores at this level — subject to fail penalties.
      </p>
    );
  }

  if (t.status === "out_of_reach") {
    return (
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Not reachable with the scores left, even if everything remaining is 100.
      </p>
    );
  }

  const options: { label?: string; headline: string; detail?: string }[] = [];

  if (t.routeMarks != null && t.routeMarks > 0) {
    const unitBit =
      t.routeUnitsApprox != null
        ? `about ${t.routeUnitsApprox} unit${t.routeUnitsApprox === 1 ? "" : "s"}`
        : null;
    const leftBit =
      remaining > 0
        ? `${remaining} score${remaining === 1 ? "" : "s"} still to enter`
        : null;
    options.push({
      headline: `Need ${t.routeMarks} more score${t.routeMarks === 1 ? "" : "s"} of ${t.threshold}+`,
      detail: [unitBit, leftBit].filter(Boolean).join(" · ") || undefined,
    });
  }

  if (t.routeAggMarks != null && t.routeAggAverage != null && t.aggregate != null) {
    options.push({
      headline: `${t.routeAggMarks} score${t.routeAggMarks === 1 ? "" : "s"} of ${t.threshold}+ and keep your average at least ${t.routeAggAverage}`,
      detail: `On the ${remaining} left. Official rule also needs a total of ${t.aggregate}+ across all scores.`,
    });
  }

  if (t.routeMarks === 0 && options.length === 0) {
    options.push({
      headline: "You've hit the score count",
      detail:
        t.aggregate != null
          ? `Keep an eye on your running total as the rest come in (official bar is ${t.aggregate}+).`
          : "Keep an eye on your running total as the rest come in.",
    });
  }

  if (!options.length) {
    return (
      <p className="mt-3 text-sm leading-relaxed text-muted">
        {t.note ?? "Enter scores to see what you need."}
      </p>
    );
  }

  if (options.length >= 2) {
    options[0]!.label = "Option A";
    options[1]!.label = "Option B · easier bar";
  }

  return (
    <div className="mt-3 space-y-3">
      <p className="text-sm leading-relaxed text-night">
        To get a {targetLabel(t.cls)} you could:
      </p>
      <div
        className={cn(
          "grid gap-4",
          options.length > 1 ? "sm:grid-cols-2 sm:gap-6" : null,
        )}
      >
        {options.map((opt, i) => (
          <AimOption key={opt.label ?? `aim-${i}`} {...opt} />
        ))}
      </div>
    </div>
  );
}

function statusChipClass(status: TargetResult["status"]) {
  if (status === "secured") {
    return "border-status-plan-border bg-status-plan-bg text-status-plan-text";
  }
  if (status === "out_of_reach") {
    return "border-status-check-border bg-status-check-bg text-status-check-text";
  }
  return "border-line bg-lilac text-indigo";
}

export function GradesPanel({
  plan,
  byCode,
}: {
  plan: Plan;
  byCode: Map<string, IndexEntry>;
}) {
  const grades = useGrades();
  const [extraCode, setExtraCode] = useState("");
  const [extraYear, setExtraYear] = useState(1);
  const [extraUnits, setExtraUnits] = useState<0.5 | 1>(1);
  const [extras, setExtras] = useState<
    { code: string; year: number; units: number }[]
  >([]);
  const [target, setTarget] = useState<TargetClass>("First");

  const scheme = schemeForYears(plan.years);

  const courses: GradeCourse[] = useMemo(() => {
    const fromPlan = plan.items.map((i) => ({
      code: i.code,
      year: i.year,
      units: byCode.get(i.code)?.units ?? null,
      mark: grades[i.code] ?? null,
    }));
    const inPlan = new Set(plan.items.map((i) => i.code));
    const extra = extras
      .filter((e) => !inPlan.has(e.code))
      .map((e) => ({
        code: e.code,
        year: e.year,
        units: byCode.get(e.code)?.units ?? e.units,
        mark: grades[e.code] ?? null,
      }));
    return [...fromPlan, ...extra];
  }, [plan.items, extras, byCode, grades]);

  const analysis = useMemo(() => analyse(scheme, courses), [scheme, courses]);
  const selected =
    analysis.targets.find((t) => t.cls === target) ?? analysis.targets[0];

  const years = Array.from({ length: plan.years }, (_, i) => i + 1);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[var(--radius)] border border-line bg-surface p-4 sm:p-6">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="font-display text-xl text-night">Grade tracker</h2>
            <p className="mt-1 text-sm text-muted">
              Full unit = 2 marks · half unit = 1 · Year 1 average counted twice.{" "}
              <a
                href={scheme.url}
                target="_blank"
                rel="noreferrer"
                className="text-violet underline underline-offset-2 hover:text-indigo"
              >
                Official scheme PDF
              </a>
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <span id="grade-target-lead" className="text-sm font-medium text-night">
              Aim for
            </span>
            <TargetClassSegment
              value={target}
              onChange={setTarget}
              labelledBy="grade-target-lead"
            />
          </div>
        </div>

        <div
          className={cn(
            "mt-5 space-y-5 rounded-[var(--radius-inner)] border border-line bg-surface p-4 sm:p-5",
            selected?.status === "out_of_reach" && "note-needs-checking",
            selected?.status === "secured" && "border-status-plan-border bg-status-plan-bg",
          )}
          aria-live="polite"
        >
          {analysis.final ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display text-2xl tracking-tight text-night">
                  {targetLabel(analysis.final.cls)}
                </p>
                <span className="inline-flex min-h-8 items-center rounded-full border border-line bg-lilac px-3 text-xs font-semibold text-indigo">
                  Final result
                </span>
              </div>
              <p className="text-sm text-muted">
                Based on all {scheme.laterMarks + 2} scores for a {scheme.years}-year degree
                (running total{" "}
                <span className="font-data tabular text-night">
                  {analysis.final.aggregate}
                </span>
                ).
              </p>
              {selected && selected.cls !== analysis.final.cls && (
                <p className="text-sm text-muted">
                  Checking {targetLabel(selected.cls)}: {statusLabel(selected.status)}.
                  {selected.note ? ` ${selected.note}` : null}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-display text-2xl tracking-tight text-night">
                  {targetLabel(target)}
                </p>
                {selected && (
                  <span
                    className={cn(
                      "inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-semibold",
                      statusChipClass(selected.status),
                    )}
                  >
                    {statusLabel(selected.status)}
                  </span>
                )}
              </div>

              {analysis.known.length > 0 ? (
                <p className="text-sm leading-relaxed text-muted">
                  Average so far{" "}
                  <span className="font-data tabular font-semibold text-night">
                    {analysis.average!.toFixed(1)}
                  </span>
                  {analysis.projected ? (
                    <>
                      {" "}
                      — on pace for a {targetLabel(analysis.projected)}
                    </>
                  ) : null}
                  .
                </p>
              ) : (
                <p className="text-sm leading-relaxed text-muted">
                  Enter scores below to see how you're doing.
                </p>
              )}

              {selected && (
                <TargetSummaryBody t={selected} remaining={analysis.remaining} />
              )}
            </div>
          )}

          {(() => {
            const total = scheme.laterMarks + 2;
            const filled = analysis.known.length;
            const laterFilled = Math.max(0, filled - (analysis.fya != null ? 2 : 0));
            const laterLeft = Math.max(0, scheme.laterMarks - laterFilled);
            return (
              <div className="space-y-4 border-t border-line pt-4">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium text-muted">
                      Progress · {scheme.years}-year degree
                    </p>
                    <p className="mt-1 font-data text-2xl tabular font-semibold leading-none text-night">
                      {filled}
                      <span className="text-base font-medium text-muted"> / {total}</span>
                    </p>
                  </div>
                  <p className="text-sm text-muted">
                    {analysis.remaining === 0
                      ? "All scores in"
                      : `${analysis.remaining} still to enter`}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted">Year 1 average</p>
                    <p className="mt-1 font-data text-lg tabular font-semibold text-night">
                      {analysis.fya != null ? analysis.fya : "—"}
                    </p>
                    <p className="mt-1 text-sm leading-snug text-muted">
                      {analysis.fya != null
                        ? `Best 6 of your Year 1 scores, written twice → counts as 2 of ${total}.`
                        : `Enter Year 1 scores first. Best 6 become one average, written twice → 2 of ${total}.`}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted">
                      Scores from Years 2–{scheme.years}
                    </p>
                    <p className="mt-1 font-data text-lg tabular font-semibold text-night">
                      {laterFilled}
                      <span className="text-sm font-medium text-muted">
                        {" "}
                        / {scheme.laterMarks}
                      </span>
                    </p>
                    <p className="mt-1 text-sm leading-snug text-muted">
                      {laterLeft === 0
                        ? "All later-year scores entered."
                        : `${laterLeft} left · each full unit adds 2 scores.`}
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {analysis.warnings.length > 0 && (
          <ul className="mt-3 space-y-1.5 text-sm leading-snug text-muted">
            {analysis.warnings.map((w) => (
              <li key={w} className="pl-0">
                {w}
              </li>
            ))}
          </ul>
        )}
      </div>

      {courses.length === 0 ? (
        <p className="rounded-[var(--radius)] border border-dashed border-line p-6 text-center text-sm text-muted">
          Add courses in Degree Plan first, or type a code below to track a mark.
        </p>
      ) : (
        <div className="space-y-4">
          {years.map((y) => {
            const rows = courses
              .filter((c) => c.year === y)
              .sort((a, b) => a.code.localeCompare(b.code));
            return (
              <section
                key={y}
                className="overflow-x-auto rounded-[var(--radius)] border border-line bg-surface"
              >
                <div className="flex flex-col gap-1 border-b border-line bg-lilac-deep px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2">
                  <h3 className="font-display text-base text-night">Year {y}</h3>
                  {y === 1 ? (
                    <p className="text-sm text-muted">
                      {analysis.fya != null ? (
                        <>
                          Year 1 average{" "}
                          <span className="font-data tabular font-semibold text-night">
                            {analysis.fya}
                          </span>
                          {" "}
                          (best 6 of 9, written twice) →{" "}
                          <span className="font-semibold text-night">2 of {scheme.laterMarks + 2}</span>{" "}
                          scores overall
                        </>
                      ) : (
                        <>
                          Best 6 of 9 Year 1 scores become one average, written twice — only 2 of{" "}
                          {scheme.laterMarks + 2} scores overall.
                        </>
                      )}
                    </p>
                  ) : null}
                </div>
                {rows.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-muted">No courses planned for this year.</p>
                ) : (
                  <table className="w-full min-w-[40rem] table-fixed text-left text-sm">
                    <colgroup>
                      <col className="w-[6.5rem]" />
                      <col />
                      <col className="w-[5.5rem]" />
                      <col className="w-[6.5rem]" />
                      <col className="w-[7.5rem]" />
                    </colgroup>
                    <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
                      <tr>
                        <th className="px-3 py-2.5 font-semibold">Code</th>
                        <th className="px-3 py-2.5 font-semibold">Course</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Units</th>
                        <th
                          className="px-3 py-2.5 text-right font-semibold"
                          title={
                            y === 1
                              ? "Weight in the Year 1 average pool (not a direct share of the final 18 marks)"
                              : "How many classification marks this course contributes (full unit = 2, half = 1)"
                          }
                        >
                          {y === 1 ? "Avg weight" : "Marks"}
                        </th>
                        <th className="px-3 py-2.5 text-right font-semibold">Your score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((c) => {
                        const entry = byCode.get(c.code);
                        const classMarks = marksFor(c.units);
                        const usedInFya =
                          y === 1 && analysis.fyaMarks
                            ? analysis.fyaMarks.some((m) => m.code === c.code && m.used)
                            : null;
                        return (
                          <tr key={`${c.year}-${c.code}`} className="border-b border-line last:border-0">
                            <td className="px-3 py-2.5 align-middle">
                              <span className="chip-code px-1.5 py-0.5 text-xs tabular">
                                {c.code}
                              </span>
                            </td>
                            <td className="truncate px-3 py-2.5 align-middle text-muted">
                              {entry?.title ?? "—"}
                              {usedInFya === false ? (
                                <span className="ml-2 text-xs text-muted">(not in best 6)</span>
                              ) : null}
                            </td>
                            <td className="px-3 py-2.5 text-right align-middle tabular text-muted">
                              {unitLabel(c.units)}
                            </td>
                            <td className="px-3 py-2.5 text-right align-middle tabular text-muted">
                              {classMarks || "—"}
                            </td>
                            <td className="px-3 py-2.5 text-right align-middle">
                              <input
                                type="number"
                                inputMode="decimal"
                                min={0}
                                max={100}
                                step={0.5}
                                className={cn(
                                  "field-input ml-auto w-full max-w-[6.5rem] text-right tabular",
                                  c.mark != null && c.mark >= 70 && "border-status-plan-border",
                                  c.mark != null && c.mark < 40 && "border-danger",
                                )}
                                aria-label={`Mark for ${c.code}`}
                                placeholder="—"
                                value={c.mark ?? ""}
                                disabled={classMarks === 0}
                                onChange={(e) => {
                                  const parsed = parseMarkInput(e.target.value);
                                  if (e.target.value.trim() === "") {
                                    gradeActions.set(c.code, null);
                                    return;
                                  }
                                  if (parsed == null) return;
                                  gradeActions.set(c.code, parsed);
                                }}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </section>
            );
          })}
        </div>
      )}

      <form
        className="flex flex-col gap-3 rounded-[var(--radius)] border border-line bg-surface p-4 sm:max-w-xl"
        onSubmit={(e) => {
          e.preventDefault();
          const code = extraCode.trim().toUpperCase();
          if (!code) return;
          if (!isValidCourseCode(code)) {
            toast.error("Enter a valid course code");
            return;
          }
          setExtras((prev) => {
            const rest = prev.filter((x) => x.code !== code);
            return [...rest, { code, year: extraYear, units: extraUnits }];
          });
          setExtraCode("");
          toast.success(`Added ${code} to tracker`);
        }}
      >
        <p className="text-sm font-medium text-night">Add a course not in your plan</p>
        <div className="flex flex-wrap gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="grades-extra-code" className="text-xs text-muted">
              Code
            </label>
            <input
              id="grades-extra-code"
              className="field-input w-36"
              value={extraCode}
              onChange={(e) => setExtraCode(e.target.value)}
              placeholder="e.g. EC201"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span id="grades-extra-year-label" className="text-xs text-muted">
              Year
            </span>
            <MenuSelect
              id="grades-extra-year"
              labelledBy="grades-extra-year-label"
              className="w-28"
              value={extraYear}
              onChange={setExtraYear}
              options={years.map((y) => ({ value: y, label: String(y) }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span id="grades-extra-units-label" className="text-xs text-muted">
              Units
            </span>
            <MenuSelect
              id="grades-extra-units"
              labelledBy="grades-extra-units-label"
              className="w-32"
              value={extraUnits}
              onChange={setExtraUnits}
              options={[
                { value: 1 as const, label: "1.0", description: "Full unit" },
                { value: 0.5 as const, label: "0.5", description: "Half unit" },
              ]}
            />
          </div>
          <div className="flex flex-col justify-end gap-1">
            <button type="submit" className="btn-dark px-4 text-sm">
              Add Row
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
