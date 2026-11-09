"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  analyse,
  marksFor,
  marksToUnitsApprox,
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
import {
  exportGradesJson,
  gradeActions,
  importGradesJson,
  useGrades,
} from "@/lib/gradeStore";
import type { Plan } from "@/lib/planStore";
import type { IndexEntry } from "@/lib/types";
import { unitLabel } from "@/lib/labels";
import { cn } from "@/lib/cn";

function statusTone(status: TargetResult["status"]) {
  if (status === "secured") return "border-status-plan-border bg-status-plan-bg";
  if (status === "possible") return "note-needs-checking";
  return "border-line bg-lilac-deep";
}

function TargetSummaryBody({
  t,
  remaining,
}: {
  t: TargetResult;
  remaining: number;
}) {
  if (t.note && (t.cls === "Pass" || t.cls === "Fail")) {
    return <p className="mt-2 text-sm text-muted">{t.note}</p>;
  }

  if (t.status === "secured") {
    return (
      <p className="mt-2 text-sm text-muted">
        You already have enough classification marks for this class (subject to fail
        penalties).
      </p>
    );
  }

  if (t.status === "out_of_reach") {
    return (
      <p className="mt-2 text-sm text-muted">
        Not reachable with the marks left, even if everything remaining is 100.
      </p>
    );
  }

  const needs: string[] = [];
  if (t.routeMarks != null && t.routeMarks > 0) {
    const units =
      t.routeUnitsApprox != null
        ? ` (≈ ${t.routeUnitsApprox} unit${t.routeUnitsApprox === 1 ? "" : "s"})`
        : "";
    needs.push(
      `${t.threshold}+ in ${t.routeMarks} more mark${t.routeMarks === 1 ? "" : "s"}${units}`,
    );
  }
  if (t.routeAggMarks != null && t.routeAggAverage != null && t.aggregate != null) {
    needs.push(
      `or ${t.threshold}+ in ${t.routeAggMarks} and average ≥ ${t.routeAggAverage} across the ${remaining} remaining (aggregate ≥ ${t.aggregate})`,
    );
  }
  if (t.routeMarks === 0) {
    needs.push("mark count met — watch the aggregate as remaining marks land");
  }

  if (!needs.length) {
    return <p className="mt-2 text-sm text-muted">{t.note ?? "Enter marks to see what you need."}</p>;
  }

  return (
    <p className="mt-2 text-sm text-muted">
      Next:{" "}
      <span className="font-semibold text-night">
        {needs[0]}
        {remaining > 0 && t.routeMarks != null && t.routeMarks > 0
          ? ` of ${remaining} still to come`
          : ""}
      </span>
      {needs[1] ? <> · {needs[1]}</> : null}
    </p>
  );
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
        <div className="flex flex-col gap-3">
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

          <div className="flex flex-wrap items-center gap-2">
            <span id="grade-target-lead" className="text-sm text-muted">
              Show path to
            </span>
            <select
              id="grade-target"
              aria-labelledby="grade-target-lead"
              className="field-input min-h-11 w-full min-w-[14rem] border-2 border-mint font-semibold text-night sm:w-auto"
              value={target}
              onChange={(e) => setTarget(e.target.value as TargetClass)}
            >
              {TARGET_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {targetLabel(c)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div
          className={cn(
            "mt-4 rounded-[var(--radius-inner)] border p-4",
            selected ? statusTone(selected.status) : "border-line bg-lilac-deep",
          )}
          aria-live="polite"
        >
          {analysis.final ? (
            <>
              <p className="font-display text-lg text-night">
                Classification: {targetLabel(analysis.final.cls)}
              </p>
              <p className="mt-1 text-sm text-muted">
                Aggregate {analysis.final.aggregate} across {scheme.laterMarks + 2}{" "}
                classification marks.
              </p>
              {selected && selected.cls !== analysis.final.cls && (
                <p className="mt-2 text-sm text-muted">
                  Looking at {targetLabel(selected.cls)}: {statusLabel(selected.status)}.
                  {selected.note ? ` ${selected.note}` : null}
                </p>
              )}
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-display text-lg text-night">
                  {targetLabel(target)}
                </p>
                {selected && (
                  <p className="text-sm font-semibold capitalize text-night">
                    {statusLabel(selected.status)}
                  </p>
                )}
              </div>
              {analysis.known.length > 0 && (
                <p className="mt-1 text-sm text-muted">
                  Average so far {analysis.average!.toFixed(1)}
                  {analysis.projected
                    ? ` · keep averaging ~${Math.round(analysis.average!)} → ${targetLabel(analysis.projected)}`
                    : ""}
                </p>
              )}
              {selected && (
                <TargetSummaryBody t={selected} remaining={analysis.remaining} />
              )}
            </>
          )}

          <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm tabular">
            <div className="flex gap-1.5">
              <dt className="text-muted">Known</dt>
              <dd className="font-semibold text-night">{analysis.known.length}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-muted">Remaining</dt>
              <dd className="font-semibold text-night">
                {analysis.remaining}
                {analysis.remaining
                  ? ` · ≈ ${marksToUnitsApprox(analysis.remaining)}u`
                  : ""}
              </dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-muted">FYA</dt>
              <dd className="font-semibold text-night">
                {analysis.fya != null ? analysis.fya : "—"}
              </dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-muted">Scheme</dt>
              <dd className="font-semibold text-night">{scheme.years}-year</dd>
            </div>
          </dl>
        </div>

        {analysis.warnings.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm text-muted">
            {analysis.warnings.map((w) => (
              <li key={w} className="rounded-[var(--radius-badge)] border border-line px-3 py-2">
                {w}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-ghost px-4 text-sm"
            onClick={() => {
              const blob = new Blob([exportGradesJson()], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "lsemods-grades.json";
              a.click();
              URL.revokeObjectURL(url);
              toast.success("Grades exported");
            }}
          >
            Export Marks
          </button>
          <label className="btn-ghost inline-flex cursor-pointer items-center px-4 text-sm">
            Import Marks
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 100_000) {
                  toast.error("File too large");
                  return;
                }
                const text = await file.text();
                if (importGradesJson(text)) toast.success("Grades imported");
                else toast.error("Couldn’t import that file");
                e.target.value = "";
              }}
            />
          </label>
          <button
            type="button"
            className="min-h-12 rounded-[var(--radius-control)] border border-line px-4 text-sm text-danger"
            onClick={() => {
              if (confirm("Clear all saved marks?")) {
                gradeActions.clear();
                toast.message("Marks cleared");
              }
            }}
          >
            Clear Marks
          </button>
        </div>
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
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-lilac-deep px-3 py-3">
                  <h3 className="font-display text-base text-night">Year {y}</h3>
                  {y === 1 && analysis.fya != null && (
                    <p className="text-sm text-muted tabular">
                      First Year Average:{" "}
                      <span className="font-semibold text-night">{analysis.fya}</span> (best six
                      of nine · counted twice)
                    </p>
                  )}
                </div>
                {rows.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-muted">No courses planned for this year.</p>
                ) : (
                  <table className="w-full min-w-[40rem] table-fixed text-left text-sm">
                    <colgroup>
                      <col className="w-[6.5rem]" />
                      <col />
                      <col className="w-[5.5rem]" />
                      <col className="w-[5.5rem]" />
                      <col className="w-[7.5rem]" />
                    </colgroup>
                    <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
                      <tr>
                        <th className="px-3 py-2.5 font-semibold">Code</th>
                        <th className="px-3 py-2.5 font-semibold">Course</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Units</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Class</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Your mark</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((c) => {
                        const entry = byCode.get(c.code);
                        const classMarks = marksFor(c.units);
                        return (
                          <tr key={`${c.year}-${c.code}`} className="border-b border-line last:border-0">
                            <td className="px-3 py-2.5 align-middle">
                              <span className="chip-code px-1.5 py-0.5 text-xs tabular">
                                {c.code}
                              </span>
                            </td>
                            <td className="truncate px-3 py-2.5 align-middle text-muted">
                              {entry?.title ?? "—"}
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
            <label htmlFor="grades-extra-year" className="text-xs text-muted">
              Year
            </label>
            <select
              id="grades-extra-year"
              className="field-input min-h-11 w-24"
              value={extraYear}
              onChange={(e) => setExtraYear(Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="grades-extra-units" className="text-xs text-muted">
              Units
            </label>
            <select
              id="grades-extra-units"
              className="field-input min-h-11 w-28"
              value={extraUnits}
              onChange={(e) => setExtraUnits(Number(e.target.value) as 0.5 | 1)}
            >
              <option value={1}>1.0</option>
              <option value={0.5}>0.5</option>
            </select>
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
