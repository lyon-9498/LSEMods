"use client";

import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Filter, Search, X } from "lucide-react";
import type { IndexEntry, Meta } from "@/lib/types";
import { prepare, searchCourses } from "@/lib/search";
import { cn } from "@/lib/cn";
import { CourseCard } from "./CourseCard";

function examBucket(c: IndexEntry): "none" | "low" | "high" | "unknown" {
  const exams = c.assessment.filter((a) => /exam/i.test(a.type));
  if (!c.assessment.length) return "unknown";
  if (!exams.length) return "none";
  const w = exams.reduce((s, a) => s + a.weight, 0);
  if (w <= 50) return "low";
  return "high";
}

const PAGE_SIZE = 20;

/** Compact page number list: 1 … 4 5 6 … N */
function pageWindow(current: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set<number>([1, total, current, current - 1, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((n) => set.add(n));
  if (current >= total - 2) [total - 3, total - 2, total - 1].forEach((n) => set.add(n));
  const sorted = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push("gap");
    out.push(sorted[i]);
  }
  return out;
}

export function CatalogueClient({
  index,
  meta,
}: {
  index: IndexEntry[];
  meta: Meta | null;
}) {
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState("");
  const [term, setTerm] = useState("");
  const [units, setUnits] = useState("");
  const [level, setLevel] = useState("");
  const [exam, setExam] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [page, setPage] = useState(1);
  const searchRef = useRef<HTMLInputElement>(null);
  const listTopRef = useRef<HTMLDivElement>(null);
  const sheetCloseRef = useRef<HTMLButtonElement>(null);
  const sheetTriggerRef = useRef<HTMLButtonElement>(null);

  const deferredQuery = useDeferredValue(query);
  const prepared = useMemo(() => prepare(index), [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && sheetOpen) {
        setSheetOpen(false);
        return;
      }
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  useEffect(() => {
    if (!sheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sheetCloseRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      sheetTriggerRef.current?.focus();
    };
  }, [sheetOpen]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (mq.matches) setSheetOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const departments = useMemo(
    () =>
      [...new Set(index.map((c) => c.department).filter(Boolean) as string[])].sort(),
    [index],
  );

  const activeFilters = [dept, term, units, level, exam].filter(Boolean).length;

  const filtered = useMemo(() => {
    let items = searchCourses(prepared, deferredQuery).items;
    if (dept) items = items.filter((c) => c.department === dept);
    if (term) items = items.filter((c) => c.terms.includes(term));
    if (units) items = items.filter((c) => String(c.units) === units);
    if (level) items = items.filter((c) => String(c.courseLevel) === level);
    if (exam) items = items.filter((c) => examBucket(c) === exam);
    return items;
  }, [prepared, deferredQuery, dept, term, units, level, exam]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);

  useEffect(() => {
    setPage(1);
  }, [deferredQuery, dept, term, units, level, exam]);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  const goToPage = (n: number) => {
    const next = Math.min(Math.max(1, n), pageCount);
    setPage(next);
    listTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const clearFilters = () => {
    setDept("");
    setTerm("");
    setUnits("");
    setLevel("");
    setExam("");
  };

  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filtered.length);

  const filterProps: FilterFieldsProps = {
    departments,
    dept,
    setDept,
    term,
    setTerm,
    units,
    setUnits,
    level,
    setLevel,
    exam,
    setExam,
    activeFilters,
    clearFilters,
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="band-grid rounded-[var(--radius)] px-5 py-8 text-white sm:px-8 sm:py-10">
        <h1 className="font-display text-[2rem] font-extrabold leading-[1.02] tracking-[-0.03em] sm:text-5xl">
          Browse LSE courses and sketch your degree plan.
        </h1>
        <p className="mt-3 max-w-xl text-sm text-white/80 sm:text-base">
          Every undergraduate course with assessment weightings and exam formats.
          {meta ? (
            <>
              {" "}
              <span className="whitespace-nowrap tabular text-white/70">{meta.session}</span>
            </>
          ) : null}
        </p>
        <label className="relative mt-6 block">
          <span className="sr-only">Search courses</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a code, title or convenor"
            className="h-14 w-full rounded-[18px] border-0 bg-white py-3 pl-12 pr-14 text-sm font-medium text-night shadow-[0_12px_32px_rgba(10,6,40,0.28)] placeholder:text-muted/70 sm:h-16 sm:text-base"
          />
          <kbd className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-md border border-line-strong bg-lilac px-2 py-0.5 font-data text-xs text-muted sm:inline">
            /
          </kbd>
        </label>
      </section>

      <div className="flex items-center justify-between gap-3 lg:hidden">
        <p className="text-sm text-muted tabular">
          {filtered.length} of {index.length} courses
          {activeFilters ? ` · ${activeFilters} filters` : ""}
        </p>
        <button
          ref={sheetTriggerRef}
          type="button"
          onClick={() => setSheetOpen(true)}
          className="btn-ghost inline-flex min-h-11 items-center gap-2 px-4 text-sm"
          aria-expanded={sheetOpen}
          aria-controls="filter-sheet"
        >
          <Filter className="size-4" aria-hidden />
          Filters{activeFilters ? ` · ${activeFilters}` : ""}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-[var(--radius)] border border-line bg-surface p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg text-night">Filters</h2>
              {activeFilters > 0 && (
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center text-xs font-medium text-violet underline underline-offset-2"
                  onClick={clearFilters}
                >
                  Reset
                </button>
              )}
            </div>
            <div className="mt-4">
              <FilterFields {...filterProps} />
            </div>
          </div>
        </aside>

        <div ref={listTopRef} className="flex flex-col gap-3 scroll-mt-20">
          <p
            className="hidden text-sm font-medium text-muted tabular lg:block"
            aria-live="polite"
          >
            {filtered.length} of {index.length} courses
            {dept ? ` in ${dept}` : ""}
            {filtered.length > 0
              ? ` · showing ${rangeStart}–${rangeEnd}`
              : ""}
          </p>
          {filtered.length === 0 ? (
            <div className="rounded-[var(--radius)] border border-dashed border-line p-8 text-center">
              <p className="text-muted">No courses match. Try SP100 or clear filters.</p>
              {(activeFilters > 0 || query) && (
                <button
                  type="button"
                  className="btn-ghost mt-4 inline-flex px-4 text-sm"
                  onClick={() => {
                    clearFilters();
                    setQuery("");
                  }}
                >
                  Clear Search &amp; Filters
                </button>
              )}
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {pageItems.map((c) => (
                <li key={c.code}>
                  <CourseCard course={c} />
                </li>
              ))}
            </ul>
          )}
          {filtered.length > PAGE_SIZE && (
            <nav
              className="mt-2 flex flex-col items-center gap-3 border-t border-line pt-4"
              aria-label="Course list pages"
            >
              <p className="text-sm text-muted tabular lg:hidden">
                Showing {rangeStart}–{rangeEnd} of {filtered.length}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <button
                  type="button"
                  className="btn-ghost inline-flex min-h-11 items-center justify-center gap-1 px-3 text-sm disabled:opacity-40"
                  disabled={safePage <= 1}
                  aria-label="Previous page"
                  onClick={() => goToPage(safePage - 1)}
                >
                  <ChevronLeft className="size-4" aria-hidden />
                  Prev
                </button>
                {pageWindow(safePage, pageCount).map((item, i) =>
                  item === "gap" ? (
                    <span key={`gap-${i}`} className="px-1 text-muted" aria-hidden>
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      className={cn(
                        "inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-control)] text-sm font-semibold tabular",
                        item === safePage
                          ? "bg-indigo text-white"
                          : "border border-line-strong bg-surface text-night hover:bg-lilac",
                      )}
                      aria-label={`Page ${item}`}
                      aria-current={item === safePage ? "page" : undefined}
                      onClick={() => goToPage(item)}
                    >
                      {item}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  className="btn-ghost inline-flex min-h-11 items-center justify-center gap-1 px-3 text-sm disabled:opacity-40"
                  disabled={safePage >= pageCount}
                  aria-label="Next page"
                  onClick={() => goToPage(safePage + 1)}
                >
                  Next
                  <ChevronRight className="size-4" aria-hidden />
                </button>
              </div>
              <p className="text-xs text-muted tabular">
                Page {safePage} of {pageCount}
              </p>
            </nav>
          )}
        </div>
      </div>

      {sheetOpen && (
        <div
          id="filter-sheet"
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="filter-sheet-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close filters"
            onClick={() => setSheetOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-[var(--radius)] bg-surface p-4 pb-[calc(5rem+env(safe-area-inset-bottom))] shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="filter-sheet-title" className="font-display text-lg text-night">
                Filters
              </h2>
              <button
                ref={sheetCloseRef}
                type="button"
                className="inline-flex size-11 items-center justify-center rounded-full hover:bg-lilac"
                onClick={() => setSheetOpen(false)}
                aria-label="Close filters"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <FilterFields {...filterProps} />
            <button
              type="button"
              className="btn-primary mt-6 flex w-full items-center justify-center px-6"
              onClick={() => setSheetOpen(false)}
            >
              Show {filtered.length} Courses
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

type FilterFieldsProps = {
  departments: string[];
  dept: string;
  setDept: (v: string) => void;
  term: string;
  setTerm: (v: string) => void;
  units: string;
  setUnits: (v: string) => void;
  level: string;
  setLevel: (v: string) => void;
  exam: string;
  setExam: (v: string) => void;
  activeFilters: number;
  clearFilters: () => void;
};

function FilterFields({
  departments,
  dept,
  setDept,
  term,
  setTerm,
  units,
  setUnits,
  level,
  setLevel,
  exam,
  setExam,
  activeFilters,
  clearFilters,
}: FilterFieldsProps) {
  const uid = useId();
  const deptId = `${uid}-dept`;
  const examName = `${uid}-exam`;

  return (
    <div className="flex flex-col gap-4">
      <Field label="Department" htmlFor={deptId}>
        <select
          id={deptId}
          className="field-input"
          value={dept}
          onChange={(e) => setDept(e.target.value)}
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Term">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Term">
          {[
            ["", "Any"],
            ["AT", "Autumn"],
            ["WT", "Winter"],
            ["ST", "Spring"],
          ].map(([v, label]) => (
            <button
              key={v || "any"}
              type="button"
              aria-pressed={term === v}
              className={cn(
                "min-h-11 rounded-full px-3 text-sm font-medium",
                term === v
                  ? "bg-indigo text-white"
                  : "border border-line-strong bg-surface text-night",
              )}
              onClick={() => setTerm(v)}
            >
              {label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Unit size">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Unit size">
          {[
            ["", "Any"],
            ["0.5", "½ unit"],
            ["1", "1 unit"],
          ].map(([v, label]) => (
            <button
              key={v || "any"}
              type="button"
              aria-pressed={units === v}
              className={cn(
                "min-h-11 rounded-full px-3 text-sm font-medium",
                units === v
                  ? "bg-indigo text-white"
                  : "border border-line-strong bg-surface text-night",
              )}
              onClick={() => setUnits(v)}
            >
              {label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Level">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Level">
          {[
            ["", "Any"],
            ["1", "100"],
            ["2", "200"],
            ["3", "300"],
          ].map(([v, label]) => (
            <button
              key={v || "any"}
              type="button"
              aria-pressed={level === v}
              className={cn(
                "min-h-11 rounded-full px-3 text-sm font-medium",
                level === v
                  ? "bg-indigo text-white"
                  : "border border-line-strong bg-surface text-night",
              )}
              onClick={() => setLevel(v)}
            >
              {label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Exam weighting">
        <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Exam weighting">
          {[
            ["", "Any"],
            ["none", "No exam"],
            ["low", "50% or less"],
            ["high", "Over 50%"],
          ].map(([v, label]) => (
            <label key={v || "any"} className="flex min-h-11 items-center gap-2 text-sm text-night">
              <input
                type="radio"
                name={examName}
                checked={exam === v}
                onChange={() => setExam(v)}
                className="size-4 accent-[var(--indigo)]"
              />
              {label}
            </label>
          ))}
        </div>
      </Field>
      {activeFilters > 0 ? (
        <button
          type="button"
          className="inline-flex min-h-11 items-center text-sm font-medium text-violet underline underline-offset-2 hover:text-indigo"
          onClick={clearFilters}
        >
          Reset filters
        </button>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
  htmlFor,
}: {
  label: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="font-semibold text-night">
          {label}
        </label>
      ) : (
        <span className="font-semibold text-night">{label}</span>
      )}
      {children}
    </div>
  );
}
