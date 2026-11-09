"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { allocatePapers, paperKey } from "@/lib/degreeLogic";
import {
  cohortLabel,
  loadProgramme,
  loadProgrammeIndex,
  type Programme,
  type ProgrammeSummary,
  type Paper,
} from "@/lib/programmes";
import { planActions, usePlan } from "@/lib/planStore";
import type { IndexEntry } from "@/lib/types";
import { safeHttpsUrl } from "@/lib/urls";

export function DegreePanel({ byCode }: { byCode: Map<string, IndexEntry> }) {
  const plan = usePlan();
  const [all, setAll] = useState<ProgrammeSummary[] | null>(null);
  const [prog, setProg] = useState<Programme | null>(null);
  const [cohort, setCohort] = useState<number | null>(null);

  useEffect(() => {
    loadProgrammeIndex().then(setAll).catch(() => setAll([]));
  }, []);

  useEffect(() => {
    if (!plan.programme) {
      setProg(null);
      return;
    }
    loadProgramme(plan.programme).then(setProg).catch(() => setProg(null));
  }, [plan.programme]);

  const allocation = useMemo(
    () => (prog ? allocatePapers(prog, plan, byCode) : null),
    [prog, plan, byCode],
  );

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
        <h2 className="font-display text-lg text-night">Your Degree</h2>
        <p className="mt-2 text-sm text-muted">
          Couldn’t load programmes. Check your connection and refresh.
        </p>
      </section>
    );
  }

  const cohorts = [...new Set(all.map((p) => p.cohort))].sort((a, b) => b - a);
  const selected = all.find((p) => p.id === plan.programme);
  const current = cohort ?? selected?.cohort ?? cohorts[0];
  const options = all.filter((p) => p.cohort === current).sort((a, b) => a.name.localeCompare(b.name));

  const switchTo = (id: string | undefined) => {
    if (id === plan.programme) return;
    planActions.switchProgramme(id);
  };

  const fill = () => {
    if (!prog) return;
    const maxYear = Math.max(...prog.years.map((y) => y.year));
    if (maxYear > plan.years) planActions.setYears(Math.min(maxYear, 4));
    const entries: { code: string; year: number }[] = [];
    for (const y of prog.years)
      for (const p of y.papers)
        for (const code of p.compulsory) {
          if (byCode.has(code)) entries.push({ code, year: Math.min(y.year, 4) });
        }
    const added = planActions.addMany(entries);
    toast.success(`Added ${added} compulsory course${added === 1 ? "" : "s"}`);
  };

  return (
    <section className="rounded-[var(--radius)] border border-line bg-surface p-4">
      <details className="lg:open" open>
        <summary className="cursor-pointer font-display text-lg text-night lg:pointer-events-none lg:list-none">
          Your Degree
        </summary>
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Started</span>
            <select
              className="field-input"
              value={current}
              onChange={(e) => {
                switchTo(undefined);
                setCohort(Number(e.target.value));
              }}
            >
              {cohorts.map((c) => (
                <option key={c} value={c}>
                  {cohortLabel(c)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Degree</span>
            <select
              className="field-input"
              value={plan.programme ?? ""}
              onChange={(e) => switchTo(e.target.value || undefined)}
            >
              <option value="">Choose your degree…</option>
              {options.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {prog && (
            <>
              <button
                type="button"
                onClick={fill}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-[var(--radius-inner)] bg-indigo px-4 py-2 text-sm font-medium text-white"
              >
                Add Compulsory Courses
              </button>
              <RegulationsNote prog={prog} />
              <div className="space-y-3">
                {prog.years.map((y) => (
                  <div key={y.year}>
                    <h3 className="text-sm font-semibold text-night">Year {y.year}</h3>
                    <ul className="mt-2 space-y-2">
                      {y.papers.map((paper, i) => (
                        <PaperRow
                          key={paperKey(y.year, i)}
                          paper={paper}
                          year={y.year}
                          pkey={paperKey(y.year, i)}
                          prog={prog}
                          counted={allocation?.get(paperKey(y.year, i))?.counted ?? []}
                          byCode={byCode}
                        />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </details>
    </section>
  );
}

function RegulationsNote({ prog }: { prog: Programme }) {
  const href = safeHttpsUrl(prog.url);
  return (
    <p className="text-xs text-muted">
      From the{" "}
      {href ? (
        <a href={href} className="underline" target="_blank" rel="noreferrer">
          official {cohortLabel(prog.cohort)} regulations
        </a>
      ) : (
        <>official {cohortLabel(prog.cohort)} regulations</>
      )}
      . Footnotes aren’t enforced — check them yourself.
    </p>
  );
}

function PaperRow({
  paper,
  year,
  pkey,
  prog,
  counted,
  byCode,
}: {
  paper: Paper;
  year: number;
  pkey: string;
  prog: Programme;
  counted: string[];
  byCode: Map<string, IndexEntry>;
}) {
  const plan = usePlan();
  const planned = new Map(plan.items.map((i) => [i.code, i.year]));
  const codes = [
    ...paper.compulsory,
    ...paper.options.slice(0, 12),
    ...counted.filter((c) => !paper.compulsory.includes(c) && !paper.options.includes(c)),
  ];
  const listCodes = paper.lists.flatMap((n) => (prog.lists[n] ?? []).slice(0, 8));

  return (
    <li className="rounded-[var(--radius-inner)] border border-line bg-surface/60 p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium">{paper.label}</p>
        <span className="shrink-0 text-xs font-medium text-muted">
          {paper.choice
            ? paper.unitsNeeded != null
              ? `${counted.length ? "partial ·" : "choose"} ${paper.unitsNeeded}u`
              : "choose"
            : paper.compulsory.every((c) => planned.get(c) === year)
              ? "In plan"
              : paper.compulsory.every((c) => planned.has(c))
                ? "Wrong year"
                : "Missing"}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {[...new Set([...codes, ...listCodes])].slice(0, 16).map((code) => {
          const inPlan = planned.has(code);
          const known = byCode.has(code);
          if (!known) return null;
          return (
            <button
              key={code}
              type="button"
              title={byCode.get(code)?.title}
              className={`inline-flex min-h-11 items-center rounded-md px-2.5 text-xs font-medium ${
                inPlan
                  ? "bg-indigo text-white"
                  : "border border-line-strong bg-surface text-night hover:bg-lilac"
              }`}
              aria-pressed={inPlan}
              onClick={() =>
                inPlan
                  ? planActions.remove(code)
                  : planActions.add(code, year, undefined, paper.compulsory.includes(code) ? undefined : pkey)
              }
            >
              {inPlan ? `${code} · in plan` : `+ ${code}`}
            </button>
          );
        })}
      </div>
      {paper.lists[0] && (
        <p className="mt-2 text-xs text-muted">
          Lists: {paper.lists.join(", ")} — open{" "}
          <Link href="/courses" className="underline">
            Courses
          </Link>{" "}
          to browse.
        </p>
      )}
    </li>
  );
}
