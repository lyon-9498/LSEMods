"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { DegreePanel } from "./DegreePanel";
import { GradesPanel } from "./GradesPanel";
import { WeeklySketch } from "./WeeklySketch";
import { YearBoard } from "./YearBoard";
import { loadCourse, loadIndex } from "@/lib/api";
import { useSharedLists } from "@/lib/courseLists";
import { exportGradesJson, gradeActions, importGradesJson } from "@/lib/gradeStore";
import {
  exportPlanJson,
  importPlanJson,
  onPlanPersistError,
  planActions,
  usePlan,
} from "@/lib/planStore";
import {
  courseIssues,
  degreeCourseCodes,
  degreePrefixes,
  fmtUnits,
  outsidePapers,
  yearSummaries,
  type OutsideContext,
} from "@/lib/plannerLogic";
import { loadProgramme } from "@/lib/programmes";
import type { Course, IndexEntry } from "@/lib/types";
import { cn } from "@/lib/cn";

export function BuilderClient() {
  const plan = usePlan();
  const [index, setIndex] = useState<IndexEntry[]>([]);
  const [tab, setTab] = useState<"degree" | "week" | "grades">("degree");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [details, setDetails] = useState<Map<string, Course | null>>(new Map());
  const [exemption, setExemption] = useState("");
  const [prog, setProg] = useState<Awaited<ReturnType<typeof loadProgramme>> | null>(null);
  const lists = useSharedLists(prog?.cohort);

  useEffect(() => {
    loadIndex().then(setIndex).catch(() => setIndex([]));
  }, []);

  useEffect(() => {
    return onPlanPersistError((err) => {
      if (err) toast.warning(err);
    });
  }, []);

  useEffect(() => {
    if (!plan.programme) {
      setProg(null);
      return;
    }
    loadProgramme(plan.programme).then(setProg).catch(() => setProg(null));
  }, [plan.programme]);

  const codesKey = plan.items
    .map((i) => i.code)
    .sort()
    .join(",");

  useEffect(() => {
    let alive = true;
    const codes = codesKey ? codesKey.split(",").filter(Boolean) : [];
    if (codes.length === 0) {
      setDetails(new Map());
      return;
    }
    Promise.all(
      codes.map((c) =>
        loadCourse(c)
          .then((d): [string, Course | null] => [c, d])
          .catch((): [string, Course | null] => [c, null]),
      ),
    ).then((pairs) => {
      if (alive) setDetails(new Map(pairs));
    });
    return () => {
      alive = false;
    };
  }, [codesKey]);

  const byCode = useMemo(() => new Map(index.map((c) => [c.code, c])), [index]);
  const years = useMemo(() => yearSummaries(plan, byCode), [plan, byCode]);

  const outside: OutsideContext | undefined = useMemo(() => {
    if (!lists || !prog) return undefined;
    return {
      outside1: lists.outside1,
      outside23: lists.outside23,
      degreeCodes: degreeCourseCodes(prog),
      ownPrefixes: degreePrefixes(prog.name, prog.department),
      outsidePapers: outsidePapers(prog),
    };
  }, [lists, prog]);

  const issues = useMemo(
    () => courseIssues(plan, details, byCode, outside),
    [plan, details, byCode, outside],
  );
  const totalUnits = years.reduce((s, y) => s + y.units, 0);

  const exportLabel = tab === "grades" ? "Export Marks" : "Export Plan";
  const importLabel = tab === "grades" ? "Import Marks" : "Import Plan";
  const clearLabel = tab === "grades" ? "Clear Marks" : "Clear Plan";

  return (
    <div className="space-y-6 pb-8 lg:pb-0">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl tracking-tight text-night">Course Builder</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Start from compulsory courses, then add options by year and term.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="flex min-h-11 items-center gap-2 text-sm text-night">
            <span className="font-medium">Years</span>
            <select
              className="field-input w-auto"
              value={plan.years}
              onChange={(e) => planActions.setYears(Number(e.target.value))}
              aria-label="Number of degree years"
            >
              {[3, 4].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn-ghost px-3 text-sm"
            onClick={() => {
              const payload =
                tab === "grades"
                  ? { name: "lsemods-grades.json", body: exportGradesJson(), ok: "Grades exported" }
                  : { name: "lsemods-plan.json", body: exportPlanJson(), ok: "Plan exported" };
              const blob = new Blob([payload.body], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = payload.name;
              a.click();
              URL.revokeObjectURL(url);
              toast.success(payload.ok);
            }}
          >
            {exportLabel}
          </button>
          <label className="btn-ghost inline-flex cursor-pointer items-center px-3 text-sm">
            {importLabel}
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              aria-label={importLabel}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 200_000) {
                  toast.error("File too large");
                  return;
                }
                const text = await file.text();
                if (tab === "grades") {
                  if (importGradesJson(text)) toast.success("Grades imported");
                  else toast.error("Couldn’t import that file");
                } else if (importPlanJson(text)) {
                  toast.success("Plan imported");
                } else if (importGradesJson(text)) {
                  toast.success("Grades imported");
                  setTab("grades");
                } else {
                  toast.error("Couldn’t import that file");
                }
                e.target.value = "";
              }}
            />
          </label>
          <button
            type="button"
            className="min-h-12 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-sm font-medium text-danger hover:bg-lilac"
            onClick={() => {
              if (tab === "grades") {
                if (confirm("Clear all saved marks?")) {
                  gradeActions.clear();
                  toast.message("Marks cleared");
                }
                return;
              }
              if (confirm("Clear all planned courses?")) {
                planActions.clear();
                toast.message("Plan cleared");
              }
            }}
          >
            {clearLabel}
          </button>
        </div>
      </header>

      <div className="flex flex-wrap gap-1 border-b border-line" role="tablist" aria-label="Builder views">
        {(
          [
            ["degree", "Degree Plan"],
            ["grades", "Grades"],
            ["week", "Timetable Sketch"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`builder-tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`builder-panel-${id}`}
            tabIndex={tab === id ? 0 : -1}
            className={cn(
              "min-h-11 border-b-2 px-3 text-sm font-medium",
              tab === id ? "border-mint text-night" : "border-transparent text-muted hover:text-night",
            )}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab !== "grades" && (
        <p className="text-sm text-muted tabular" aria-live="polite">
          {fmtUnits(totalUnits)} units planned
          {plan.items.length ? ` · ${plan.items.length} courses` : ""}
        </p>
      )}

      {tab === "week" ? (
        <div
          role="tabpanel"
          id="builder-panel-week"
          aria-labelledby="builder-tab-week"
        >
          <WeeklySketch />
        </div>
      ) : tab === "grades" ? (
        <div
          role="tabpanel"
          id="builder-panel-grades"
          aria-labelledby="builder-tab-grades"
        >
          <GradesPanel plan={plan} byCode={byCode} />
        </div>
      ) : (
        <div
          role="tabpanel"
          id="builder-panel-degree"
          aria-labelledby="builder-tab-degree"
          className="grid gap-6 lg:grid-cols-[300px_1fr]"
        >
          <div className="space-y-4">
            <DegreePanel byCode={byCode} />
            <section className="rounded-[var(--radius)] border border-line bg-surface p-4">
              <h2 className="font-display text-lg text-night">Exemptions</h2>
              <p className="mt-1 text-sm text-muted">
                Courses already covered — they count as met prerequisites.
              </p>
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!exemption.trim()) return;
                  planActions.addExemption(exemption);
                  setExemption("");
                  toast.success("Exemption added");
                }}
              >
                <label className="sr-only" htmlFor="exemption-code">
                  Exemption course code
                </label>
                <input
                  id="exemption-code"
                  value={exemption}
                  onChange={(e) => setExemption(e.target.value)}
                  placeholder="e.g. SP100"
                  className="field-input"
                />
                <button
                  type="submit"
                  className="btn-dark shrink-0 px-4 text-sm"
                >
                  Add
                </button>
              </form>
              {plan.exemptions.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {plan.exemptions.map((c) => (
                    <li key={c}>
                      <button
                        type="button"
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-sm text-night hover:bg-lilac"
                        onClick={() => planActions.removeExemption(c)}
                        aria-label={`Remove exemption ${c}`}
                      >
                        <span className="font-data tabular">{c}</span>
                        <X className="size-3.5" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
          <div className="space-y-4">
            {years.map((y) => (
              <YearBoard
                key={y.year}
                year={y}
                plan={plan}
                byCode={byCode}
                issues={issues}
                menuFor={menuFor}
                setMenuFor={setMenuFor}
                onAdd={(code) => {
                  planActions.add(code, y.year);
                  toast.success(`Added ${code}`);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
