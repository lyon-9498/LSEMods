"use client";

import { useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Download, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { DegreePanel, YearRequirements } from "./DegreePanel";
import { GradesPanel } from "./GradesPanel";
import { MenuSelect } from "./MenuSelect";
import { YearBoard } from "./YearBoard";
import { loadCourse, loadIndex } from "@/lib/api";
import { isValidCourseCode } from "@/lib/async";
import { useSharedLists } from "@/lib/courseLists";
import { loadCoursesMeta, type CourseMeta } from "@/lib/coursesData";
import { allocateSlots } from "@/lib/degreeLogic";
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
  outsidePapers,
  yearSummaries,
  type OutsideContext,
} from "@/lib/plannerLogic";
import { loadProgramme } from "@/lib/programmes";
import { prepare } from "@/lib/search";
import type { Course, IndexEntry } from "@/lib/types";
import { cn } from "@/lib/cn";

type Tab = "degree" | "grades";
const TABS: readonly (readonly [Tab, string])[] = [
  ["degree", "Degree Plan"],
  ["grades", "Grades"],
];

export function BuilderClient() {
  const plan = usePlan();
  const [index, setIndex] = useState<IndexEntry[]>([]);
  const [catalogueReady, setCatalogueReady] = useState(false);
  const [tab, setTab] = useState<Tab>("degree");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [details, setDetails] = useState<Map<string, Course | null>>(new Map());
  const [exemption, setExemption] = useState("");
  const [prog, setProg] = useState<Awaited<ReturnType<typeof loadProgramme>> | null>(null);
  const [courseMeta, setCourseMeta] = useState<Map<string, CourseMeta>>(new Map());
  const lists = useSharedLists();

  useEffect(() => {
    let alive = true;
    Promise.all([
      loadIndex().catch(() => [] as IndexEntry[]),
      loadCoursesMeta().catch(() => new Map<string, CourseMeta>()),
    ]).then(([idx, meta]) => {
      if (!alive) return;
      setIndex(idx);
      setCourseMeta(meta);
      setCatalogueReady(true);
    });
    return () => {
      alive = false;
    };
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
  const prepared = useMemo(() => prepare(index), [index]);
  const years = useMemo(() => yearSummaries(plan, byCode), [plan, byCode]);
  /** Ignore a stale programme while the newly picked one loads. */
  const activeProg = prog && prog.id === plan.programme ? prog : null;
  const allocation = useMemo(
    () => (activeProg ? allocateSlots(activeProg, plan, byCode, courseMeta) : null),
    [activeProg, plan, byCode, courseMeta],
  );

  const outside: OutsideContext | undefined = useMemo(() => {
    if (!lists || !activeProg) return undefined;
    return {
      outside1: lists.outside1,
      outside23: lists.outside23,
      degreeCodes: degreeCourseCodes(activeProg),
      ownPrefixes: degreePrefixes(activeProg.name, activeProg.department),
      outsidePapers: outsidePapers(activeProg),
    };
  }, [lists, activeProg]);

  const issues = useMemo(
    () => courseIssues(plan, details, byCode, outside, courseMeta),
    [plan, details, byCode, outside, courseMeta],
  );

  const isGrades = tab === "grades";
  const fileNoun = isGrades ? "Marks" : "Plan";

  const exportFile = () => {
    const payload = isGrades
      ? { name: "lsemods-grades.json", body: exportGradesJson(), ok: "Marks exported" }
      : { name: "lsemods-plan.json", body: exportPlanJson(), ok: "Plan exported" };
    const blob = new Blob([payload.body], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = payload.name;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(payload.ok);
  };

  // Clear straight away with an Undo, rather than a blocking browser confirm().
  const clearCurrent = () => {
    if (isGrades) {
      const snapshot = exportGradesJson();
      gradeActions.clear();
      toast.message("Marks cleared", {
        duration: 8000,
        action: { label: "Undo", onClick: () => importGradesJson(snapshot) },
      });
      return;
    }
    if (plan.items.length === 0 && plan.exemptions.length === 0) {
      toast.message("Your plan is already empty");
      return;
    }
    const snapshot = exportPlanJson();
    planActions.clear();
    toast.message("Plan cleared", {
      description: plan.programme ? "Your degree is kept — use Restore to re-add compulsories." : undefined,
      duration: 8000,
      action: { label: "Undo", onClick: () => importPlanJson(snapshot) },
    });
  };

  const onTabKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const ids = TABS.map(([id]) => id);
    const at = ids.indexOf(tab);
    let next: Tab | null = null;
    if (e.key === "ArrowRight") next = ids[(at + 1) % ids.length];
    else if (e.key === "ArrowLeft") next = ids[(at - 1 + ids.length) % ids.length];
    else if (e.key === "Home") next = ids[0];
    else if (e.key === "End") next = ids[ids.length - 1];
    if (!next) return;
    e.preventDefault();
    setTab(next);
    document.getElementById(`builder-tab-${next}`)?.focus();
  };

  return (
    <div className="space-y-6 pb-8 lg:pb-0">
      <header className="flex flex-wrap items-end justify-between gap-x-3 gap-y-4">
        <div className="min-w-0">
          <h1 className="font-display text-3xl tracking-tight text-night">Course Builder</h1>
          {plan.programme ? (
            <div className="mt-1.5 flex min-w-0 items-center gap-2">
              <p
                className={
                  activeProg
                    ? "min-w-0 truncate text-sm font-medium text-night"
                    : "min-w-0 truncate text-sm text-muted"
                }
                title={activeProg?.name}
              >
                {activeProg ? activeProg.name : "Loading your degree…"}
              </p>
              <span className="chip-code inline-flex shrink-0 items-center px-2 py-0.5 text-[11px] tabular">
                {plan.years}-year
              </span>
            </div>
          ) : (
            <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2">
              <span id="degree-years-label" className="text-sm text-muted">
                Degree length
              </span>
              <MenuSelect
                id="degree-years"
                labelledBy="degree-years-label"
                className="w-[8.5rem]"
                value={plan.years}
                onChange={(n) => planActions.setYears(n)}
                options={[
                  { value: 3, label: "3 years" },
                  { value: 4, label: "4 years" },
                ]}
              />
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label={`${fileNoun} file`}>
          <button
            type="button"
            className="btn-quiet inline-flex items-center gap-1.5 px-3 text-sm"
            aria-label={`Export ${fileNoun.toLowerCase()} as a JSON file`}
            onClick={exportFile}
          >
            <Download className="size-4" aria-hidden />
            <span>
              Export<span className="hidden sm:inline"> {fileNoun}</span>
            </span>
          </button>
          <label className="btn-quiet inline-flex cursor-pointer items-center gap-1.5 px-3 text-sm">
            <Upload className="size-4" aria-hidden />
            <span aria-hidden>
              Import<span className="hidden sm:inline"> {fileNoun}</span>
            </span>
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              aria-label={`Import ${fileNoun.toLowerCase()} from a JSON file`}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 200_000) {
                  toast.error("That file is too large to be an LSEmods export");
                  e.target.value = "";
                  return;
                }
                const text = await file.text();
                if (isGrades) {
                  if (importGradesJson(text)) toast.success("Marks imported");
                  else toast.error("Couldn’t read that file as LSEmods marks");
                } else if (importPlanJson(text)) {
                  toast.success("Plan imported");
                } else if (importGradesJson(text)) {
                  toast.success("Marks imported");
                  setTab("grades");
                } else {
                  toast.error("Couldn’t read that file as an LSEmods plan");
                }
                e.target.value = "";
              }}
            />
          </label>
          <button
            type="button"
            className="btn-destructive inline-flex items-center gap-1.5 px-3 text-sm"
            aria-label={`Clear ${fileNoun.toLowerCase()}`}
            onClick={clearCurrent}
          >
            <Trash2 className="size-4" aria-hidden />
            <span>
              Clear<span className="hidden sm:inline"> {fileNoun}</span>
            </span>
          </button>
        </div>
      </header>

      <div
        className="relative inline-grid w-full max-w-md grid-cols-2 rounded-[var(--radius-control)] border border-line bg-lilac-deep p-1 sm:w-auto"
        role="tablist"
        aria-label="Builder views"
        onKeyDown={onTabKey}
      >
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-1 left-1 z-0 w-[calc(50%-0.25rem)] rounded-[calc(var(--radius-control)-4px)] bg-mint shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
            tab === "grades" && "translate-x-full",
          )}
        />
        {TABS.map(([id, label]) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={`builder-tab-${id}`}
              aria-selected={active}
              aria-controls={`builder-panel-${id}`}
              tabIndex={active ? 0 : -1}
              className={cn(
                "relative z-10 min-h-11 rounded-[calc(var(--radius-control)-4px)] px-4 text-sm font-semibold transition-colors duration-200 motion-reduce:transition-none sm:min-w-[8.5rem]",
                active ? "text-night" : "text-muted hover:text-night",
              )}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          );
        })}
      </div>

      {tab === "grades" ? (
        <div role="tabpanel" id="builder-panel-grades" aria-labelledby="builder-tab-grades">
          <GradesPanel plan={plan} byCode={byCode} />
        </div>
      ) : (
        <div
          role="tabpanel"
          id="builder-panel-degree"
          aria-labelledby="builder-tab-degree"
          className="grid gap-6 lg:grid-cols-[300px_1fr] lg:items-start"
        >
          {/* Phone: degree → plan → exemptions. Laptop: sticky sidebar beside the plan. */}
          <div className="contents lg:sticky lg:top-20 lg:block lg:max-h-[calc(100dvh-6rem)] lg:space-y-4 lg:overflow-y-auto lg:overscroll-contain lg:p-1">
            {!catalogueReady ? (
              <p className="rounded-[var(--radius)] border border-line bg-surface p-4 text-sm text-muted">
                Loading degree list…
              </p>
            ) : (
              <DegreePanel byCode={byCode} />
            )}
            <section
              className="order-last rounded-[var(--radius)] border border-line bg-surface p-4 lg:order-none"
              aria-labelledby="exemptions-heading"
            >
              <h2 id="exemptions-heading" className="font-display text-lg text-night">
                Exemptions
              </h2>
              <p className="mt-1 text-xs text-muted">
                Courses you’ve already covered — they count as met prerequisites.
              </p>
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const code = exemption.trim().toUpperCase();
                  if (!code) return;
                  if (!isValidCourseCode(code)) {
                    toast.error(`“${exemption.trim()}” isn’t a valid course code`);
                    return;
                  }
                  if (plan.exemptions.includes(code)) {
                    toast.message(`${code} is already an exemption`);
                    setExemption("");
                    return;
                  }
                  planActions.addExemption(code);
                  setExemption("");
                  toast.success(`Exemption added: ${code}`);
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
                  autoComplete="off"
                  className="field-input"
                />
                <button type="submit" className="btn-dark shrink-0 px-4 text-sm">
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
          <div className="min-w-0 space-y-4">
            <h2 className="sr-only">Your plan</h2>
            {!catalogueReady ? (
              <p className="rounded-[var(--radius)] border border-line bg-surface p-4 text-sm text-muted">
                Loading course catalogue…
              </p>
            ) : (
              years.map((y) => (
                <YearBoard
                  key={y.year}
                  year={y}
                  plan={plan}
                  byCode={byCode}
                  prepared={prepared}
                  issues={issues}
                  menuFor={menuFor}
                  setMenuFor={setMenuFor}
                  onAdd={(code) => {
                    const from = plan.items.find((i) => i.code === code)?.year;
                    planActions.add(code, y.year);
                    toast.success(from ? `Moved ${code} to Year ${y.year}` : `Added ${code} to Year ${y.year}`);
                  }}
                  requirements={
                    activeProg ? (
                      <YearRequirements
                        prog={activeProg}
                        year={y.year}
                        allocation={allocation}
                        byCode={byCode}
                        courseMeta={courseMeta}
                      />
                    ) : null
                  }
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
