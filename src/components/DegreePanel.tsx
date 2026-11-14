"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Plus, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { NonCreditCourseDialog } from "@/components/NonCreditCourseDialog";
import { isNonCreditUnits } from "@/lib/labels";
import {
  activeRouteId,
  allocateSlots,
  courseUnits,
  crossYearSlotKey,
  exclusiveChoiceCodes,
  findRoute,
  fitsSlotUnits,
  isInactiveOutsideSlot,
  isLockedSlot,
  lockedAutoFillEntries,
  otherRouteCourses,
  shortUnitLabel,
  slotAllowedCodes,
  slotKey,
  courseAssessmentNeedsChecking,
  slotNeedsChecking,
  slotStatusLabel,
  type SlotProgress,
} from "@/lib/degreeLogic";
import { canonicalCode, codesMatch } from "@/lib/courseAliases";
import { getCourseMeta, loadCoursesMeta, type CourseMeta } from "@/lib/coursesData";
import {
  loadProgramme,
  loadProgrammeIndex,
  type CrossYearRule,
  type Programme,
  type ProgrammeRoute,
  type ProgrammeSlot,
  type ProgrammeSummary,
} from "@/lib/programmes";
import { planActions, usePlan } from "@/lib/planStore";
import { fmtUnits, yearUnitCap } from "@/lib/plannerLogic";
import type { IndexEntry } from "@/lib/types";
import { safeHttpsUrl } from "@/lib/urls";
import { cn } from "@/lib/cn";
import { DegreeSearchSelect } from "@/components/DegreeSearchSelect";

export function DegreePanel({ byCode }: { byCode: Map<string, IndexEntry> }) {
  const plan = usePlan();
  const [all, setAll] = useState<ProgrammeSummary[] | null>(null);
  const [prog, setProg] = useState<Programme | null>(null);
  const [courseMeta, setCourseMeta] = useState<Map<string, CourseMeta>>(new Map());
  /** After the user picks a degree, auto-drop locked courses into the plan once data loads. */
  const [pendingFill, setPendingFill] = useState(false);
  /** One-shot: saved degree + empty plan should fill compulsories (incl. LSE100) on hydrate. */
  const hydrateFillDone = useRef(false);

  useEffect(() => {
    loadProgrammeIndex().then(setAll).catch(() => setAll([]));
    loadCoursesMeta()
      .then(setCourseMeta)
      .catch(() => setCourseMeta(new Map()));
  }, []);

  useEffect(() => {
    if (!plan.programme) {
      setProg(null);
      return;
    }
    loadProgramme(plan.programme).then(setProg).catch(() => setProg(null));
  }, [plan.programme]);

  /** Keep plan.years locked to the selected degree length (PPE → 4, most BSc → 3). */
  useEffect(() => {
    if (!prog || prog.id !== plan.programme) return;
    const degreeYears = Math.min(Math.max(prog.lengthYears, 3), 4);
    if (plan.years !== degreeYears) planActions.setYears(degreeYears);
  }, [prog, plan.programme, plan.years]);

  useEffect(() => {
    if (hydrateFillDone.current) return;
    if (!prog || prog.id !== plan.programme) return;
    hydrateFillDone.current = true;
    if (plan.items.length === 0) setPendingFill(true);
  }, [prog, plan.programme, plan.items.length]);

  useEffect(() => {
    if (!pendingFill || !prog || prog.id !== plan.programme) return;
    const degreeYears = Math.min(Math.max(prog.lengthYears, 3), 4);
    planActions.setYears(degreeYears);
    const known = (code: string) =>
      byCode.has(canonicalCode(code)) || courseMeta.has(canonicalCode(code)) || code === "LSE100";
    const entries = lockedAutoFillEntries(prog, known);
    const added = planActions.addMany(entries);
    setPendingFill(false);
    if (added > 0) {
      toast.success(`Added ${added} compulsory course${added === 1 ? "" : "s"}`);
    } else {
      toast.message("No compulsory courses to add for this degree");
    }
  }, [pendingFill, prog, plan.programme, byCode, courseMeta]);

  /** Avoid flashing the previous degree while the next programme JSON loads. */
  const activeProg = prog && prog.id === plan.programme ? prog : null;

  const allocation = useMemo(
    () => (activeProg ? allocateSlots(activeProg, plan, byCode, courseMeta) : null),
    [activeProg, plan, byCode, courseMeta],
  );

  /** Only offer restore when something locked was removed from the plan. */
  const missingCompulsory = useMemo(() => {
    if (!activeProg) return [];
    const known = (code: string) =>
      byCode.has(canonicalCode(code)) || courseMeta.has(canonicalCode(code)) || code === "LSE100";
    const planned = new Set(plan.items.map((i) => canonicalCode(i.code)));
    return lockedAutoFillEntries(activeProg, known).filter(
      (e) => !planned.has(canonicalCode(e.code)),
    );
  }, [activeProg, plan.items, byCode, courseMeta]);

  /** Backfill LSE100 if an earlier fill raced ahead of the catalogue (other Y1 locked courses already in). */
  useEffect(() => {
    if (!activeProg) return;
    const planned = new Set(plan.items.map((i) => canonicalCode(i.code)));
    if (planned.has("LSE100")) return;
    const known = (code: string) =>
      byCode.has(canonicalCode(code)) || courseMeta.has(canonicalCode(code)) || code === "LSE100";
    const locked = lockedAutoFillEntries(activeProg, known);
    const lse = locked.find((e) => e.code === "LSE100");
    if (!lse) return;
    const othersIn = locked.some((e) => e.code !== "LSE100" && planned.has(e.code));
    if (!othersIn) return;
    planActions.addMany([lse]);
  }, [activeProg, plan.items, byCode, courseMeta]);

  if (all === null) {
    return (
      <section className="rounded-[var(--radius)] border border-line bg-surface p-4">
        <p className="text-sm text-muted">Loading degree list…</p>
      </section>
    );
  }

  if (all.length === 0) {
    return (
      <section className="rounded-[var(--radius)] border border-line bg-surface p-4">
        <h2 className="font-display text-lg text-night">Degree requirements</h2>
        <p className="mt-2 text-sm text-muted">
          Couldn’t load programmes. Check your connection and refresh.
        </p>
      </section>
    );
  }

  const options = [...all].sort((a, b) => a.name.localeCompare(b.name));

  const switchTo = (id: string | undefined) => {
    if (id === plan.programme) return;
    planActions.switchProgramme(id);
    if (id) {
      const summary = all.find((p) => p.id === id);
      if (summary) planActions.setYears(Math.min(Math.max(summary.years, 3), 4));
      setPendingFill(true);
    } else {
      setPendingFill(false);
    }
  };

  const fill = () => {
    if (!activeProg) return;
    const degreeYears = Math.min(Math.max(activeProg.lengthYears, 3), 4);
    planActions.setYears(degreeYears);
    const known = (code: string) =>
      byCode.has(canonicalCode(code)) || courseMeta.has(canonicalCode(code)) || code === "LSE100";
    const added = planActions.addMany(lockedAutoFillEntries(activeProg, known));
    toast.success(`Added ${added} compulsory course${added === 1 ? "" : "s"}`);
  };

  const plannedYearAll = new Map(
    plan.items.map((i) => [canonicalCode(i.code), i.year] as const),
  );
  const yearStates = activeProg
    ? activeProg.years
        .filter((y) => y.year <= plan.years)
        .map((y) => ({
          year: y.year,
          unitsLeft: yearUnitsLeft(plan.items, y.year, byCode, courseMeta),
          ...yearSlotState(
            activeProg,
            y,
            allocation,
            plannedYearAll,
            courseMeta,
            yearIsFull(plan.items, y.year, byCode, courseMeta),
          ),
        }))
    : [];

  return (
    <section
      className="rounded-[var(--radius)] border border-line bg-surface p-4"
      aria-label="Your degree"
    >
      <div className="space-y-3">
        <DegreeSearchSelect
          options={options}
          value={plan.programme}
          onChange={switchTo}
        />
        {!plan.programme && (
          <p className="text-xs text-muted">
            Pick your degree to drop in its compulsory courses and see what’s left to choose in
            each year.
          </p>
        )}
        {activeProg && (
          <>
            {missingCompulsory.length > 0 && (
              <button
                type="button"
                onClick={fill}
                className="btn-quiet inline-flex w-full items-center justify-center px-4 py-2 text-sm"
              >
                Restore {missingCompulsory.length} Missing Compulsory
                {missingCompulsory.length === 1 ? " Course" : " Courses"}
              </button>
            )}
            <ul
              className="divide-y divide-line overflow-hidden rounded-[var(--radius-inner)] border border-line"
              aria-label="Requirements by year"
            >
              {yearStates.map((ys) => {
                const open = ys.actionSlots.filter((a) => !a.done && !a.spare).length;
                // Slots are often alternatives (an option OR an outside option), so counting
                // open slots overstates the work — show the units still needed instead.
                const badge =
                  ys.unitsLeft < -1e-9
                    ? `${fmtUnits(-ys.unitsLeft)}u over`
                    : ys.unitsLeft > 1e-9
                      ? `${fmtUnits(ys.unitsLeft)}u to choose`
                      : open > 0
                        ? `${open} to fix`
                        : null;
                return (
                  <li key={ys.year}>
                    <a
                      href={`#plan-year-${ys.year}`}
                      className="flex min-h-11 items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-lilac"
                    >
                      <span className="font-medium text-night">Year {ys.year}</span>
                      {badge ? (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-semibold",
                            ys.unitsLeft < -1e-9
                              ? "bg-destructive-bg text-destructive"
                              : "bg-lilac text-indigo",
                          )}
                        >
                          {badge}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-status-plan-text">
                          <Check className="size-3.5" aria-hidden />
                          All set
                        </span>
                      )}
                    </a>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-muted">
              Compulsory courses are added for you. Open choices sit inside each year’s card.{" "}
              <RegulationsNote prog={activeProg} inline />
            </p>
            {activeProg.crossYearRules.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Across years
                </h3>
                <ul className="mt-2 space-y-2">
                  {activeProg.crossYearRules.map((rule) => {
                    const progress = allocation?.get(crossYearSlotKey(rule.order));
                    return (
                      <CrossYearSlotRow
                        key={crossYearSlotKey(rule.order)}
                        rule={rule}
                        prog={activeProg}
                        counted={progress?.counted ?? []}
                        countedUnits={progress?.units ?? 0}
                        byCode={byCode}
                        courseMeta={courseMeta}
                      />
                    );
                  })}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function RegulationsNote({ prog, inline }: { prog: Programme; inline?: boolean }) {
  const href = safeHttpsUrl(prog.url);
  const link = href ? (
    <a href={href} className="underline" target="_blank" rel="noreferrer">
      official programme page
    </a>
  ) : (
    <>official programme page</>
  );
  if (inline) {
    return <>From the {link}.</>;
  }
  return <p className="text-xs text-muted">From the {link}.</p>;
}

function applyRoute(
  year: number,
  pkey: string,
  slot: ProgrammeSlot,
  route: ProgrammeRoute,
  prog: Programme,
) {
  const keep = new Set(route.courses.map(canonicalCode));
  for (const code of otherRouteCourses(slot, route.id)) {
    if (keep.has(canonicalCode(code))) continue;
    planActions.remove(code);
  }
  for (const code of route.courses) {
    planActions.add(canonicalCode(code), year, undefined, pkey);
  }
  // Dependent slots (e.g. Paper 4) may require fixed courses for this same route id.
  const yearSlots = prog.years.find((y) => y.year === year)?.slots ?? [];
  for (const other of yearSlots) {
    if (other.order === slot.order || !other.routes?.length) continue;
    const dep = findRoute(other, route.id);
    const depKey = slotKey(year, other.order);
    for (const r of other.routes) {
      if (r.id === route.id) continue;
      for (const code of r.courses) {
        if (keep.has(canonicalCode(code))) continue;
        if ((dep?.courses ?? []).some((c) => codesMatch(c, code))) continue;
        planActions.remove(code);
      }
    }
    for (const code of dep?.courses ?? []) {
      planActions.add(canonicalCode(code), year, undefined, depKey);
    }
  }
}

/** choose_one_of: keep only this code (or its route bundle); drop the rest. */
function pickExclusiveChoice(
  year: number,
  pkey: string,
  slot: ProgrammeSlot,
  code: string,
  prog: Programme,
) {
  const canon = canonicalCode(code);
  if (slot.routes?.length) {
    const route =
      slot.routes.find((r) => r.courses.some((c) => codesMatch(c, canon))) ?? null;
    if (route) {
      applyRoute(year, pkey, slot, route, prog);
      return;
    }
  }
  for (const other of exclusiveChoiceCodes(slot)) {
    if (other !== canon) planActions.remove(other);
  }
  planActions.add(canon, year, undefined, pkey);
}

/** Drop illegal multi-picks left over from older plans. */
function pruneExclusiveConflicts(year: number, slot: ProgrammeSlot, plannedInYear: Set<string>) {
  if (slot.ruleType !== "choose_one_of") return;
  if (slot.routes?.length) {
    const scored = slot.routes
      .map((r) => {
        const codes = r.courses.map(canonicalCode);
        const hits = codes.filter((c) => plannedInYear.has(c));
        const complete = codes.length > 0 && hits.length === codes.length;
        return { r, hits, complete, score: hits.length + (complete ? 10 : 0) };
      })
      .filter((x) => x.hits.length > 0)
      .sort((a, b) => b.score - a.score);
    if (scored.length <= 1) return;
    const keep = new Set(scored[0].r.courses.map(canonicalCode));
    for (const { r } of scored.slice(1)) {
      for (const c of r.courses) {
        if (!keep.has(canonicalCode(c))) planActions.remove(c);
      }
    }
    return;
  }
  const hits = exclusiveChoiceCodes(slot).filter((c) => plannedInYear.has(c));
  if (hits.length <= 1) return;
  for (const c of hits.slice(1)) planActions.remove(c);
}

function CourseChip({
  code,
  year,
  pkey,
  inPlan,
  locked,
  title,
  units,
  needsCheck,
  overCap,
  capUnits,
  onToggle,
}: {
  code: string;
  year: number;
  pkey: string;
  inPlan: boolean;
  locked?: boolean;
  title?: string;
  units: number | null;
  needsCheck?: boolean;
  /** Adding this course would exceed the slot unit target. */
  overCap?: boolean;
  capUnits?: number | null;
  onToggle?: () => void;
}) {
  const [nonCreditOpen, setNonCreditOpen] = useState(false);
  const unit = shortUnitLabel(units);
  const nonCredit = isNonCreditUnits(units);
  // Empty assessment is expected on non-credit skills courses — don't also flag "check".
  const showCheck = Boolean(needsCheck) && !nonCredit;
  const blocked = Boolean(overCap) && !inPlan;
  // Filled chips: code only (+ "check" if needed). Units / compulsory live in the slot header.
  const parts = [code, inPlan ? null : unit, showCheck ? "check" : null].filter(Boolean);
  const label = `${inPlan ? "" : "+ "}${parts.join(" · ")}`;
  const blockedTitle =
    blocked && capUnits != null
      ? `Would exceed this slot’s ${capUnits}u`
      : blocked
        ? "Would exceed this slot’s unit total"
        : undefined;

  const confirmAdd = () => {
    if (blocked) {
      toast.message(blockedTitle ?? "This slot is already full");
      setNonCreditOpen(false);
      return;
    }
    if (onToggle) onToggle();
    else planActions.add(code, year, undefined, pkey);
    setNonCreditOpen(false);
  };

  const dialog = nonCreditOpen ? (
    <NonCreditCourseDialog
      code={code}
      title={title}
      onClose={() => setNonCreditOpen(false)}
      onConfirmAdd={inPlan ? undefined : confirmAdd}
    />
  ) : null;

  if (locked && inPlan) {
    // Code-only — full course card lives on the year board.
    const chip = (
      <span className="inline-flex min-h-11 items-center rounded-[var(--radius-badge)] border border-line bg-lilac px-2 py-1 text-xs font-medium text-night">
        <span className="chip-code px-1.5 py-0.5 text-[11px] tabular underline-offset-2 group-hover:underline">
          {code}
        </span>
      </span>
    );
    if (!nonCredit) {
      return (
        <Link
          href={`/courses/${code}`}
          title={title ? `${title} — view course` : "View course"}
          aria-label={`View ${code}${title ? `: ${title}` : ""}`}
          className="group inline-flex rounded-[var(--radius-badge)] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-mint"
        >
          {chip}
        </Link>
      );
    }
    return (
      <>
        <button
          type="button"
          title={title ?? "View course"}
          className="group inline-flex rounded-[var(--radius-badge)] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-mint"
          onClick={() => setNonCreditOpen(true)}
        >
          {chip}
        </button>
        {dialog}
      </>
    );
  }

  if (locked && !inPlan) {
    return (
      <>
        <button
          type="button"
          title={title ?? "Add compulsory course to plan"}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-badge)] border border-dashed border-line-strong bg-surface px-2.5 text-xs font-medium text-night hover:bg-lilac"
          onClick={() => {
            if (nonCredit) setNonCreditOpen(true);
            else planActions.add(code, year, undefined, pkey);
          }}
        >
          <span className="chip-code px-1.5 py-0.5 text-[11px] tabular">{code}</span>
          <span className="text-muted">Add</span>
        </button>
        {dialog}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        title={
          blockedTitle ?? title ?? (nonCredit ? "Non-credit course — tap for details" : undefined)
        }
        disabled={blocked}
        aria-disabled={blocked || undefined}
        className={cn(
          "inline-flex min-h-11 items-center rounded-md px-2.5 text-xs font-medium",
          inPlan
            ? "bg-indigo text-surface"
            : blocked
              ? "cursor-not-allowed border border-line bg-lilac-deep text-muted opacity-70"
              : nonCredit
                ? "border border-mint bg-surface text-night hover:bg-lilac"
                : "border border-line-strong bg-surface text-night hover:bg-lilac",
        )}
        aria-pressed={inPlan}
        onClick={() => {
          if (inPlan) {
            onToggle?.();
            return;
          }
          if (blocked) {
            toast.message(blockedTitle ?? "This slot is already full");
            return;
          }
          if (nonCredit) {
            setNonCreditOpen(true);
            return;
          }
          onToggle?.();
        }}
      >
        {inPlan ? parts.join(" · ") : label}
      </button>
      {dialog}
    </>
  );
}

function SlotRow({
  slot,
  label,
  deferredNote,
  spare,
  done,
  year,
  pkey,
  prog,
  counted,
  countedUnits,
  byCode,
  courseMeta,
}: {
  slot: ProgrammeSlot;
  label: string;
  deferredNote?: string;
  spare?: boolean;
  done: boolean;
  year: number;
  pkey: string;
  prog: Programme;
  counted: string[];
  countedUnits: number;
  byCode: Map<string, IndexEntry>;
  courseMeta: Map<string, CourseMeta>;
}) {
  const plan = usePlan();
  const planned = new Map(
    plan.items.map((i) => [canonicalCode(i.code), i.year] as const),
  );
  const plannedInYear = new Set(
    [...planned.entries()].filter(([, y]) => y === year).map(([c]) => c),
  );

  useEffect(() => {
    pruneExclusiveConflicts(year, slot, plannedInYear);
    // Only when the planned set for this year changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: prune stale multi-picks
  }, [year, slot.order, slot.ruleType, [...plannedInYear].sort().join(",")]);

  if (isInactiveOutsideSlot(slot)) return null;

  const { codes } = slotAllowedCodes(slot, prog, year, courseMeta);
  const locked = isLockedSlot(slot);
  const status = slotStatusLabel(slot, counted, planned, year, countedUnits);
  const yearRoute =
    prog.years
      .find((y) => y.year === year)
      ?.slots.map((s) => activeRouteId(s, plannedInYear))
      .find((id) => id != null) ?? null;
  const dependentRoute =
    slot.routes?.length && slot.ruleType !== "choose_one_of" && yearRoute
      ? findRoute(slot, yearRoute)
      : undefined;
  const isRoutePicker = Boolean(slot.routes?.length && slot.ruleType === "choose_one_of");

  // Only codes allowed in this slot — never merge compulsory courses into an options list.
  const showCodes = isRoutePicker
    ? []
    : locked
      ? codes
      : [...new Set([...codes, ...counted.map(canonicalCode).filter((c) => codes.includes(c))])];

  // Hide empty outside-option shells that survived filtering with nothing to pick.
  if (
    slot.ruleType === "outside_option" &&
    showCodes.length === 0 &&
    !dependentRoute?.courses?.length
  ) {
    return null;
  }

  const missingStatus = status === "Missing";
  const lockedPrimaryCode =
    locked && slot.ruleType === "LSE100"
      ? "LSE100"
      : locked && slot.courses.length === 1
        ? canonicalCode(slot.courses[0])
        : null;
  const unitsHint =
    slot.units != null && slot.units > 0 ? (
      <span className="font-data text-xs font-medium text-muted">{slot.units}u</span>
    ) : null;
  // Single locked primary: header owns the code — don't also render an Add chip.
  const hidePrimaryChipRow =
    Boolean(lockedPrimaryCode) &&
    showCodes.length === 1 &&
    canonicalCode(showCodes[0]) === lockedPrimaryCode;
  const lockedPrimaryTitle = lockedPrimaryCode
    ? (byCode.get(lockedPrimaryCode)?.title ?? getCourseMeta(courseMeta, lockedPrimaryCode)?.title)
    : undefined;

  const countedHere = new Set(counted.map(canonicalCode));
  const enforceCap =
    slot.ruleType === "choose_units_from_list" || slot.ruleType === "outside_option";
  const rows: PickerRowData[] = locked
    ? []
    : showCodes.flatMap((code) => {
        const canon = canonicalCode(code);
        const known = byCode.has(canon) || courseMeta.has(canon) || canon === "LSE100";
        if (!known) return [];
        const meta = getCourseMeta(courseMeta, code);
        const u = courseUnits(code, byCode, courseMeta);
        const here = countedHere.has(canon);
        const plannedIn = planned.get(canon);
        const overCap = enforceCap && !here && !fitsSlotUnits(slot.units, countedUnits, u);
        const state: OptionState = here
          ? "here"
          : plannedIn != null
            ? "elsewhere"
            : overCap
              ? "blocked"
              : "available";
        return [
          {
            code: canon,
            title: byCode.get(canon)?.title ?? meta?.title,
            units: u,
            needsCheck: courseAssessmentNeedsChecking(meta),
            state,
            note:
              state === "elsewhere"
                ? plannedIn === year
                  ? "Used elsewhere"
                  : `In Year ${plannedIn}`
                : state === "blocked"
                  ? "Slot full"
                  : undefined,
            noteTitle:
              state === "elsewhere"
                ? "Already in your plan and counted towards another requirement"
                : state === "blocked"
                  ? slot.units != null
                    ? `Would go over this slot’s ${slot.units}u — remove a course first`
                    : "This slot is already full"
                  : undefined,
            onAdd: () => {
              if (slot.ruleType === "choose_one_of") {
                pickExclusiveChoice(year, pkey, slot, canon, prog);
                return;
              }
              planActions.add(canon, year, undefined, pkey);
            },
            onRemove: () => planActions.remove(canon),
          },
        ];
      });

  return (
    <li
      className={cn(
        "rounded-[var(--radius-inner)] border p-3 text-sm",
        locked && missingStatus
          ? "border-dashed border-line-strong bg-lilac-deep/60"
          : "border-line bg-surface",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="flex min-h-7 flex-wrap items-center gap-2 font-medium text-night">
            {lockedPrimaryCode ? (
              <span className="chip-code px-2 py-0.5 text-xs tabular">{lockedPrimaryCode}</span>
            ) : (
              <span>{label}</span>
            )}
            {unitsHint}
          </p>
          {lockedPrimaryTitle ? (
            <p className="mt-0.5 text-xs text-muted">
              {lockedPrimaryTitle}
              {missingStatus ? " · compulsory, not in your plan" : null}
              {status === "Wrong year" ? " · compulsory in this year" : null}
            </p>
          ) : null}
        </div>
        {lockedPrimaryCode && missingStatus ? (
          <button
            type="button"
            className="btn-quiet inline-flex shrink-0 items-center gap-1 px-3 text-sm"
            onClick={() => planActions.add(lockedPrimaryCode, year, undefined, pkey)}
          >
            <Plus className="size-4" aria-hidden />
            Add
          </button>
        ) : (
          <SlotStatus status={spare ? "Optional" : status} done={done} />
        )}
      </div>

      {slotNeedsChecking(slot) && (
        <p className="note-needs-checking mt-2 inline-flex items-start gap-1.5 rounded-[var(--radius-badge)] px-2 py-1.5 text-xs">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            Needs checking
            {slot.issue ? `: ${slot.issue}` : null}
            {!slot.issue && (slot.confidence ?? "").toUpperCase() === "UNVERIFIED"
              ? ": unverified in the source data"
              : null}
          </span>
        </p>
      )}

      {isRoutePicker ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {slot.routes!.map((route, idx) => {
            const active = activeRouteId(slot, plannedInYear) === route.id;
            const routeTag =
              slot.routes!.length === 2
                ? idx === 0
                  ? "Either"
                  : "Or"
                : `Option ${idx + 1}`;
            return (
              <button
                key={route.id}
                type="button"
                aria-pressed={active}
                onClick={() => applyRoute(year, pkey, slot, route, prog)}
                className={cn(
                  "rounded-[var(--radius-inner)] border px-3 py-3 text-left transition",
                  active
                    ? "border-mint bg-status-plan-bg"
                    : "border-line-strong bg-surface hover:bg-lilac",
                )}
              >
                <p className="flex items-center gap-1 text-xs font-semibold text-muted">
                  {active ? <Check className="size-3.5 text-status-plan-text" aria-hidden /> : null}
                  {active ? "Chosen" : routeTag}
                </p>
                <p className="mt-0.5 font-medium text-night">{route.label}</p>
                {route.courses.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {route.courses.map((code) => (
                      <span
                        key={code}
                        className="inline-flex items-center rounded-md bg-lilac px-2 py-1 font-data text-[11px] font-bold text-indigo"
                      >
                        {code}
                        {shortUnitLabel(courseUnits(code, byCode, courseMeta))
                          ? ` · ${shortUnitLabel(courseUnits(code, byCode, courseMeta))}`
                          : ""}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      ) : null}

      {dependentRoute?.courses?.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {dependentRoute.courses.map((code) => {
            const canon = canonicalCode(code);
            return (
              <CourseChip
                key={code}
                code={canon}
                year={year}
                pkey={pkey}
                inPlan={planned.has(canon)}
                locked
                title={byCode.get(canon)?.title ?? getCourseMeta(courseMeta, code)?.title}
                units={courseUnits(code, byCode, courseMeta)}
                needsCheck={courseAssessmentNeedsChecking(getCourseMeta(courseMeta, code))}
              />
            );
          })}
        </div>
      ) : null}

      {locked && showCodes.length > 0 && !hidePrimaryChipRow && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {showCodes.map((code) => {
            const canon = canonicalCode(code);
            const known = byCode.has(canon) || courseMeta.has(canon) || canon === "LSE100";
            if (!known) {
              return (
                <span
                  key={code}
                  className="inline-flex min-h-11 items-center rounded-[var(--radius-badge)] border border-dashed border-line-strong px-2.5 text-xs text-muted"
                  title="Not in the current catalogue"
                >
                  {code}
                </span>
              );
            }
            const meta = getCourseMeta(courseMeta, code);
            return (
              <CourseChip
                key={code}
                code={canon}
                year={year}
                pkey={pkey}
                inPlan={planned.has(canon)}
                locked
                title={byCode.get(canon)?.title ?? meta?.title}
                units={courseUnits(code, byCode, courseMeta)}
                needsCheck={courseAssessmentNeedsChecking(meta)}
              />
            );
          })}
        </div>
      )}

      {rows.length > 0 && (
        <PickerList rows={rows} done={done} label={label} deferredNote={deferredNote} />
      )}
    </li>
  );
}

type OptionState = "here" | "elsewhere" | "available" | "blocked";

interface PickerRowData {
  code: string;
  title?: string;
  units: number | null;
  needsCheck: boolean;
  state: OptionState;
  /** Short reason shown instead of an Add button ("In Year 2", "Slot full"). */
  note?: string;
  noteTitle?: string;
  onAdd: () => void;
  onRemove: () => void;
}

const PICKER_PREVIEW = 5;
const PICKER_MAX_RENDER = 60;
const STATE_ORDER: Record<OptionState, number> = { here: 0, available: 1, blocked: 2, elsewhere: 3 };

/**
 * Titled option rows for a requirement slot. Unfilled: shows the first few options, a
 * "Show all" toggle and a filter for long lists. Filled: collapses to the chosen course(s).
 */
function PickerList({
  rows,
  done,
  label,
  deferredNote,
}: {
  rows: PickerRowData[];
  done: boolean;
  label: string;
  /** Set when an earlier slot offers the same list — start collapsed to avoid repeating it. */
  deferredNote?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState("");
  const filterId = useId();

  const here = rows.filter((r) => r.state === "here");
  const rest = rows
    .filter((r) => r.state !== "here")
    .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state]);
  const q = query.trim().toLowerCase();
  const filtered = q
    ? rest.filter((r) => r.code.toLowerCase().includes(q) || (r.title ?? "").toLowerCase().includes(q))
    : rest;
  const listOpen = expanded || (!done && !deferredNote);
  const visible = showAll || q ? filtered.slice(0, PICKER_MAX_RENDER) : filtered.slice(0, PICKER_PREVIEW);
  const hiddenCount = filtered.length - visible.length;

  if (!listOpen && !done) {
    return (
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 flex-1 text-xs text-muted">{deferredNote}</p>
        <button
          type="button"
          className="btn-quiet inline-flex items-center gap-1 px-3 text-sm"
          onClick={() => setExpanded(true)}
          aria-label={`Choose for ${label}`}
        >
          Choose
          <ChevronDown className="size-4" aria-hidden />
        </button>
      </div>
    );
  }

  if (!listOpen) {
    return (
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 flex-1 text-xs text-muted">
          {here.map((r, i) => (
            <span key={r.code}>
              {i > 0 ? ", " : null}
              <span className="font-data font-bold text-indigo">{r.code}</span>
              {r.title ? ` ${r.title}` : null}
            </span>
          ))}
        </p>
        {rest.length > 0 && (
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-1 rounded-[var(--radius-control)] px-2 text-sm font-medium text-indigo hover:bg-lilac"
            onClick={() => setExpanded(true)}
            aria-label={`Change ${label}`}
          >
            Change
            <ChevronDown className="size-4" aria-hidden />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      {here.length > 0 && (
        <ul className="space-y-1.5" aria-label={`${label}: chosen`}>
          {here.map((r) => (
            <OptionRow key={r.code} row={r} />
          ))}
        </ul>
      )}
      {rest.length > 8 && (
        <div>
          <label htmlFor={filterId} className="sr-only">
            Filter {label} options
          </label>
          <input
            id={filterId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Filter ${rest.length} options by code or title`}
            className="field-input"
            autoComplete="off"
          />
        </div>
      )}
      {filtered.length === 0 ? (
        <p className="px-1 text-xs text-muted">No options match “{query.trim()}”.</p>
      ) : (
        <ul className="space-y-1.5" aria-label={`${label}: options`}>
          {visible.map((r) => (
            <OptionRow key={r.code} row={r} />
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {hiddenCount > 0 && !showAll && !q ? (
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-1 rounded-[var(--radius-control)] px-2 text-sm font-medium text-indigo hover:bg-lilac"
            onClick={() => setShowAll(true)}
          >
            Show all {filtered.length} options
            <ChevronDown className="size-4" aria-hidden />
          </button>
        ) : hiddenCount > 0 ? (
          <p className="px-1 text-xs text-muted">
            Showing {visible.length} of {filtered.length} — type to narrow it down.
          </p>
        ) : (
          <span />
        )}
        {(done || deferredNote) && expanded && (
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] px-2 text-sm font-medium text-indigo hover:bg-lilac"
            onClick={() => {
              setExpanded(false);
              setShowAll(false);
              setQuery("");
            }}
          >
            {done ? "Done" : "Hide"}
          </button>
        )}
      </div>
    </div>
  );
}

function OptionRow({ row }: { row: PickerRowData }) {
  const [nonCreditOpen, setNonCreditOpen] = useState(false);
  const nonCredit = isNonCreditUnits(row.units);
  const unit = shortUnitLabel(row.units);
  const add = () => {
    if (nonCredit) setNonCreditOpen(true);
    else row.onAdd();
  };
  const muted = row.state === "elsewhere" || row.state === "blocked";

  return (
    <li
      className={cn(
        "flex min-h-12 items-center gap-2 rounded-[var(--radius-badge)] border py-1 pl-2 pr-1",
        row.state === "here"
          ? "border-status-plan-border bg-status-plan-bg"
          : "border-line bg-surface",
      )}
    >
      <Link
        href={`/courses/${row.code}`}
        className="chip-code shrink-0 px-1.5 py-0.5 text-[11px] tabular underline-offset-2 hover:underline"
        title="View course"
      >
        {row.code}
      </Link>
      <span className={cn("min-w-0 flex-1", muted && "opacity-70")}>
        <span className="line-clamp-2 text-xs font-medium leading-snug text-night">
          {row.title ?? "Title not in catalogue"}
        </span>
        {row.needsCheck && !nonCredit ? (
          <span className="text-[11px] text-status-check-text">Assessment needs checking</span>
        ) : null}
      </span>
      {unit ? <span className="shrink-0 font-data text-[11px] text-muted">{unit}</span> : null}
      {row.state === "here" ? (
        <button
          type="button"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-muted hover:bg-destructive-bg hover:text-destructive"
          aria-label={`Remove ${row.code}${row.title ? `: ${row.title}` : ""}`}
          onClick={row.onRemove}
        >
          <X className="size-4" aria-hidden />
        </button>
      ) : row.state === "available" ? (
        <button
          type="button"
          className="btn-quiet inline-flex shrink-0 items-center gap-1 px-2.5 text-xs"
          aria-label={`Add ${row.code}${row.title ? `: ${row.title}` : ""}`}
          onClick={add}
        >
          <Plus className="size-3.5" aria-hidden />
          Add
        </button>
      ) : (
        <span
          className="inline-flex min-h-11 shrink-0 items-center px-2 text-[11px] font-medium text-muted"
          title={row.noteTitle}
        >
          {row.note}
        </span>
      )}
      {nonCreditOpen ? (
        <NonCreditCourseDialog
          code={row.code}
          title={row.title}
          onClose={() => setNonCreditOpen(false)}
          onConfirmAdd={() => {
            row.onAdd();
            setNonCreditOpen(false);
          }}
        />
      ) : null}
    </li>
  );
}

function prettyStatus(status: string): string {
  const s = status.replace(" / ", " of ");
  if (s === "choose") return "Choose 1";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function SlotStatus({ status, done }: { status: string; done: boolean }) {
  if (done) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-status-plan-bg px-2 py-0.5 text-xs font-medium text-status-plan-text">
        <Check className="size-3.5" aria-hidden />
        Done
      </span>
    );
  }
  if (status === "Wrong year") {
    return (
      <span className="note-needs-checking shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium">
        Wrong year
      </span>
    );
  }
  if (status === "Missing" || status === "Optional") {
    return <span className="shrink-0 pt-0.5 text-xs font-medium text-muted">{status}</span>;
  }
  return (
    <span className="shrink-0 rounded-full bg-lilac px-2 py-0.5 text-xs font-semibold text-indigo">
      {prettyStatus(status)}
    </span>
  );
}

function CrossYearSlotRow({
  rule,
  prog,
  counted,
  countedUnits,
  byCode,
  courseMeta,
}: {
  rule: CrossYearRule;
  prog: Programme;
  counted: string[];
  countedUnits: number;
  byCode: Map<string, IndexEntry>;
  courseMeta: Map<string, CourseMeta>;
}) {
  const plan = usePlan();
  const planned = new Map(plan.items.map((i) => [canonicalCode(i.code), i.year] as const));
  const defaultYear = rule.appliesToYears[0] ?? 2;
  const pkey = crossYearSlotKey(rule.order);
  const { codes } = slotAllowedCodes(rule, prog, defaultYear, courseMeta);
  const showCodes = [...new Set([...codes, ...counted.map(canonicalCode)])];
  const countedHere = new Set(counted.map(canonicalCode));
  const done =
    rule.units != null && rule.units > 0
      ? countedUnits + 1e-9 >= rule.units
      : counted.length > 0;
  const status = counted.length
    ? `${shortUnitLabel(countedUnits) ?? ""}${rule.units != null ? ` / ${rule.units}u` : ""}`.trim()
    : rule.units != null
      ? `choose ${rule.units}u`
      : "Optional";

  const rows: PickerRowData[] = showCodes.flatMap((code) => {
    const canon = canonicalCode(code);
    if (!(byCode.has(canon) || courseMeta.has(canon))) return [];
    const meta = getCourseMeta(courseMeta, code);
    const u = courseUnits(code, byCode, courseMeta);
    const here = countedHere.has(canon);
    const plannedIn = planned.get(canon);
    const overCap = !here && !fitsSlotUnits(rule.units, countedUnits, u);
    const state: OptionState = here
      ? "here"
      : plannedIn != null
        ? "elsewhere"
        : overCap
          ? "blocked"
          : "available";
    return [
      {
        code: canon,
        title: byCode.get(canon)?.title ?? meta?.title,
        units: u,
        needsCheck: courseAssessmentNeedsChecking(meta),
        state,
        note: state === "elsewhere" ? `In Year ${plannedIn}` : state === "blocked" ? "Slot full" : undefined,
        noteTitle:
          state === "blocked"
            ? rule.units != null
              ? `Would go over this rule’s ${rule.units}u — remove a course first`
              : "Already full"
            : undefined,
        onAdd: () => planActions.add(canon, defaultYear, undefined, pkey),
        onRemove: () => planActions.remove(canon),
      },
    ];
  });

  return (
    <li className="rounded-[var(--radius-inner)] border border-line bg-surface p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-night">
            {slotLabel(rule)}
            {rule.units != null && rule.units > 0 ? (
              <span className="ml-1.5 font-data text-xs font-medium text-muted">{rule.units}u</span>
            ) : null}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            Years {rule.years} · added to Year {defaultYear}; move it from its card if needed.
          </p>
        </div>
        <SlotStatus status={status} done={done} />
      </div>

      {slotNeedsChecking(rule) && (
        <p className="note-needs-checking mt-2 inline-flex items-start gap-1.5 rounded-[var(--radius-badge)] px-2 py-1.5 text-xs">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            Needs checking
            {rule.issue ? `: ${rule.issue}` : null}
            {!rule.issue && (rule.confidence ?? "").toUpperCase() === "UNVERIFIED"
              ? ": unverified in the source data"
              : null}
          </span>
        </p>
      )}

      {rows.length > 0 && <PickerList rows={rows} done={done} label={slotLabel(rule)} />}
    </li>
  );
}

type ProgrammeYearDef = Programme["years"][number];

interface ActionSlot {
  slot: ProgrammeSlot;
  done: boolean;
  /** Open choice in a year that already has its full units — only needed after a swap. */
  spare: boolean;
  counted: string[];
  units: number;
}

/** Units still to plan before the year reaches its normal load (4u, or 4.5u in Year 1). */
function yearUnitsLeft(
  items: { code: string; year: number }[],
  year: number,
  byCode: Map<string, IndexEntry>,
  courseMeta: Map<string, CourseMeta>,
): number {
  const units = items
    .filter((i) => i.year === year)
    .reduce((sum, i) => sum + (courseUnits(i.code, byCode, courseMeta) ?? 0), 0);
  return Math.round((yearUnitCap(year) - units) * 100) / 100;
}

/** True when the year's planned units already reach its normal load. */
function yearIsFull(
  items: { code: string; year: number }[],
  year: number,
  byCode: Map<string, IndexEntry>,
  courseMeta: Map<string, CourseMeta>,
): boolean {
  return yearUnitsLeft(items, year, byCode, courseMeta) <= 1e-9;
}

function slotDone(slot: ProgrammeSlot, status: string, countedUnits: number): boolean {
  if (status === "In plan" || status.startsWith("Route")) return true;
  if (!isLockedSlot(slot) && slot.units != null && slot.units > 0) {
    return countedUnits + 1e-9 >= slot.units;
  }
  return false;
}

/**
 * Requirement slots for one programme year that still need the student's attention (or that
 * hold a choice they made). Compulsory courses already in the right year are "met" and live
 * only on the year board.
 */
export function yearSlotState(
  prog: Programme,
  y: ProgrammeYearDef,
  allocation: Map<string, SlotProgress> | null,
  plannedYear: Map<string, number>,
  courseMeta: Map<string, CourseMeta>,
  yearFull = false,
): { actionSlots: ActionSlot[]; metLocked: number } {
  let metLocked = 0;
  const actionSlots: ActionSlot[] = [];
  for (const slot of y.slots) {
    if (isInactiveOutsideSlot(slot)) continue;
    const progress = allocation?.get(slotKey(y.year, slot.order));
    const counted = progress?.counted ?? [];
    const units = progress?.units ?? 0;
    const status = slotStatusLabel(slot, counted, plannedYear, y.year, units);
    if (isLockedSlot(slot) && status === "In plan") {
      metLocked += 1;
      continue;
    }
    if (
      slot.ruleType === "outside_option" &&
      !slot.routes?.length &&
      slotAllowedCodes(slot, prog, y.year, courseMeta).codes.length === 0
    ) {
      continue;
    }
    const done = slotDone(slot, status, units);
    const spare = !done && yearFull && !isLockedSlot(slot) && counted.length === 0;
    actionSlots.push({ slot, done, spare, counted, units });
  }
  return { actionSlots, metLocked };
}

/** "Still to choose" block rendered inside a YearBoard card. */
export function YearRequirements({
  prog,
  year,
  allocation,
  byCode,
  courseMeta,
}: {
  prog: Programme;
  year: number;
  allocation: Map<string, SlotProgress> | null;
  byCode: Map<string, IndexEntry>;
  courseMeta: Map<string, CourseMeta>;
}) {
  const plan = usePlan();
  const [reviewOpen, setReviewOpen] = useState(false);
  const y = prog.years.find((py) => py.year === year);
  if (!y) return null;
  const plannedYear = new Map(plan.items.map((i) => [canonicalCode(i.code), i.year] as const));
  const unitsLeft = yearUnitsLeft(plan.items, year, byCode, courseMeta);
  const yearFull = unitsLeft <= 1e-9;
  const { actionSlots } = yearSlotState(prog, y, allocation, plannedYear, courseMeta, yearFull);
  if (actionSlots.length === 0) return null;

  const open = actionSlots.filter((a) => !a.done && !a.spare).length;
  const base = actionSlots.map((a) => slotLabel(a.slot));
  const totals = new Map<string, number>();
  for (const l of base) totals.set(l, (totals.get(l) ?? 0) + 1);
  const seen = new Map<string, number>();
  const labels = base.map((l) => {
    const total = totals.get(l) ?? 0;
    if (total < 2) return l;
    const n = (seen.get(l) ?? 0) + 1;
    seen.set(l, n);
    return `${l} — choice ${n} of ${total}`;
  });
  // Several slots often share one option list (e.g. "Options" ×3). Keep only the first open
  // one expanded; the rest wait behind a Choose button instead of repeating the same list.
  const firstOpenByBase = new Map<string, number>();
  actionSlots.forEach((a, i) => {
    if (!a.done && !a.spare && !firstOpenByBase.has(base[i])) firstOpenByBase.set(base[i], i);
  });
  const deferred = actionSlots.map((a, i) => {
    if (a.spare) {
      return `Year ${year} already has ${fmtUnits(yearUnitCap(year))} units — only needed if you swap a course out.`;
    }
    const first = firstOpenByBase.get(base[i]);
    if (a.done || a.counted.length > 0 || first == null || first === i) return undefined;
    return `Same list as ${labels[first]}.`;
  });

  if (open === 0 && !reviewOpen) {
    return (
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <p className="inline-flex items-center gap-1.5 text-sm font-medium text-status-plan-text">
          <Check className="size-4" aria-hidden />
          All degree choices for Year {year} made
        </p>
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-1 rounded-[var(--radius-control)] px-2 text-sm font-medium text-indigo hover:bg-lilac"
          onClick={() => setReviewOpen(true)}
        >
          Review
          <ChevronDown className="size-4" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-line pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-night">
          {open > 0 ? "Still to choose" : "Degree choices"}
        </h3>
        {open > 0 ? (
          <p className="text-xs text-muted">
            {unitsLeft > 1e-9
              ? `${fmtUnits(unitsLeft)} ${unitsLeft === 1 ? "unit" : "units"} left to plan`
              : `${open} to fix`}
          </p>
        ) : (
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] px-2 text-sm font-medium text-indigo hover:bg-lilac"
            onClick={() => setReviewOpen(false)}
          >
            Hide
          </button>
        )}
      </div>
      <ul className="mt-2 space-y-2">
        {actionSlots.map((a, i) => (
          <SlotRow
            key={slotKey(year, a.slot.order)}
            slot={a.slot}
            label={labels[i]}
            deferredNote={deferred[i]}
            spare={a.spare}
            done={a.done}
            year={year}
            pkey={slotKey(year, a.slot.order)}
            prog={prog}
            counted={a.counted}
            countedUnits={a.units}
            byCode={byCode}
            courseMeta={courseMeta}
          />
        ))}
      </ul>
    </div>
  );
}

function slotLabel(slot: ProgrammeSlot): string {
  const paper = slot.text?.match(/\b(Paper\s+\d+)\b/i)?.[1];
  if (paper) {
    if (slot.ruleType === "choose_one_of" && slot.routes?.length) return `${paper} · maths route`;
    if (slot.ruleType === "outside_option") return `${paper} · outside options`;
    return paper;
  }
  switch (slot.ruleType) {
    case "compulsory":
      return slot.courses.length === 1 ? slot.courses[0] : "Compulsory";
    case "dissertation":
      return slot.courses[0] ? `Dissertation · ${slot.courses[0]}` : "Dissertation";
    case "LSE100":
      return "LSE100";
    case "choose_one_of":
      return slot.routes?.length ? "Choose a route" : "Choose one";
    case "choose_units_from_list":
      return "Options";
    case "outside_option":
      return "Outside option";
    default:
      return slot.ruleType;
  }
}
