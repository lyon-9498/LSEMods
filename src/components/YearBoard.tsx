"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import Link from "next/link";
import { Check, ChevronDown, MoreHorizontal, Search, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import type { Plan, PlanItem, Slot } from "@/lib/planStore";
import { planActions } from "@/lib/planStore";
import {
  SLOT_LABEL,
  fmtUnits,
  slotOf,
  type Issue,
  type YearSummary,
} from "@/lib/plannerLogic";
import { unitLabel } from "@/lib/labels";
import { searchCourses, type Prepared } from "@/lib/search";
import type { IndexEntry } from "@/lib/types";
import { cn } from "@/lib/cn";

const TERM_ORDER: Slot[] = ["BOTH", "AT", "WS"];

export function YearBoard({
  year,
  plan,
  byCode,
  prepared,
  issues,
  menuFor,
  setMenuFor,
  onAdd,
  requirements,
}: {
  year: YearSummary;
  plan: Plan;
  byCode: Map<string, IndexEntry>;
  prepared: Prepared[];
  issues: Map<string, Issue[]>;
  menuFor: string | null;
  setMenuFor: (code: string | null) => void;
  onAdd: (code: string) => void;
  /** Open degree choices for this year (rendered by DegreePanel's YearRequirements). */
  requirements?: ReactNode;
}) {
  const titleId = `plan-year-${year.year}-title`;
  const panelId = `plan-year-${year.year}-panel`;
  const hasItems = year.codes.length > 0;
  // Only show term groups that hold something: empty Autumn / Winter boxes read as drop zones,
  // but there is no drag — courses land in their term automatically.
  const columns = TERM_ORDER.map((slot) => ({ slot, codes: year.bySlot[slot] })).filter(
    (c) => c.codes.length > 0,
  );
  const pct = year.maxUnits > 0 ? Math.min(100, (year.units / year.maxUnits) * 100) : 0;
  const meterState =
    year.units > year.maxUnits + 1e-9
      ? "over"
      : year.units + 1e-9 >= year.maxUnits
        ? "full"
        : "partial";
  const hasError = year.issues.some((i) => i.severity === "error");
  // Full years start collapsed so a finished plan stays scannable; open years with work left.
  const [open, setOpen] = useState(() => meterState !== "full" || hasError);

  useEffect(() => {
    const syncFromHash = () => {
      if (typeof window === "undefined") return;
      if (window.location.hash === `#plan-year-${year.year}`) setOpen(true);
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, [year.year]);

  return (
    <section
      id={`plan-year-${year.year}`}
      aria-labelledby={titleId}
      className="plan-year rounded-[var(--radius)] border border-line bg-surface p-4"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            className="flex w-full min-h-11 flex-col rounded-[var(--radius-inner)] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-2"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="flex w-full flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span id={titleId} className="font-display text-xl text-night">
                Year {year.year}
              </span>
              <span
                className={cn(
                  "text-sm tabular",
                  meterState === "over"
                    ? "font-semibold text-destructive"
                    : meterState === "full"
                      ? "font-medium text-status-plan-text"
                      : "text-muted",
                )}
              >
                {fmtUnits(year.units)} / {fmtUnits(year.maxUnits)} units
              </span>
            </span>
            <span className="unit-meter mt-2 w-full" data-state={meterState} aria-hidden>
              <span style={{ width: `${pct}%` }} />
            </span>
            {!open && (
              <span className="mt-2 text-xs text-muted">
                {hasItems
                  ? `${year.codes.length} course${year.codes.length === 1 ? "" : "s"}`
                  : "Nothing planned yet"}
                {meterState === "full" ? " · full" : ""}
                {year.issues.length > 0
                  ? ` · ${year.issues.length} note${year.issues.length === 1 ? "" : "s"}`
                  : ""}
              </span>
            )}
          </button>
        </div>
        <button
          type="button"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-muted hover:bg-lilac hover:text-night"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? `Collapse Year ${year.year}` : `Expand Year ${year.year}`}
          onClick={() => setOpen((v) => !v)}
        >
          <ChevronDown
            className={cn(
              "size-5 transition-transform duration-200 motion-reduce:transition-none",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </button>
      </div>

      {open && (
        <div id={panelId} className="mt-3">
          {year.issues.length > 0 && (
            <ul className="mb-3 space-y-1">
              {year.issues.map((i, n) => (
                <li
                  key={n}
                  className={cn(
                    "flex items-start gap-1.5 text-xs",
                    i.severity === "error" ? "text-destructive" : "text-muted",
                  )}
                >
                  {i.severity === "error" ? (
                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  ) : null}
                  {i.text}
                </li>
              ))}
            </ul>
          )}

          {hasItems ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {columns.map(({ slot, codes }) => (
                <div
                  key={slot}
                  className={cn(
                    "rounded-[var(--radius-inner)] border border-line bg-lilac-deep/40 p-2",
                    (slot === "BOTH" || columns.length === 1) && "sm:col-span-2",
                  )}
                >
                  <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">
                    {SLOT_LABEL[slot]}
                  </h3>
                  <ul className="mt-2 space-y-2">
                    {codes.map((code) => {
                      const item = plan.items.find((i) => i.code === code);
                      if (!item) return null;
                      return (
                        <CourseCard
                          key={code}
                          item={item}
                          entry={byCode.get(code)}
                          byCode={byCode}
                          years={plan.years}
                          issues={issues.get(code) ?? []}
                          open={menuFor === code}
                          setMenuFor={setMenuFor}
                        />
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-[var(--radius-inner)] border border-dashed border-line-strong px-3 py-4 text-sm text-muted">
              Nothing planned for Year {year.year} yet.{" "}
              {requirements
                ? "Pick from the choices below or search for any course."
                : "Pick your degree or search for a course below."}
            </p>
          )}

          {requirements}

          <AddBox year={year.year} plan={plan} prepared={prepared} onAdd={onAdd} />
        </div>
      )}
    </section>
  );
}

function CourseCard({
  item,
  entry,
  byCode,
  years,
  issues,
  open,
  setMenuFor,
}: {
  item: PlanItem;
  entry: IndexEntry | undefined;
  byCode: Map<string, IndexEntry>;
  years: number;
  issues: Issue[];
  open: boolean;
  setMenuFor: (code: string | null) => void;
}) {
  const { code } = item;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hasError = issues.some((i) => i.severity === "error");

  return (
    <li
      className={cn(
        "relative rounded-[var(--radius-inner)] border bg-paper p-2.5 text-sm",
        hasError ? "border-status-check-border" : "border-line",
      )}
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
              {unitLabel(entry?.units ?? null)}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-xs font-medium text-night">
            {entry?.title ?? "Not in the current catalogue"}
          </p>
          {issues.map((iss, n) => (
            <p
              key={n}
              className={cn(
                "mt-0.5 flex items-start gap-1 text-xs",
                iss.severity === "error" ? "text-status-check-text" : "text-muted",
              )}
            >
              {iss.severity === "error" ? (
                <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden />
              ) : null}
              {iss.text}
            </p>
          ))}
        </div>
        <div className="relative shrink-0">
          <button
            ref={triggerRef}
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-[var(--radius-control)] text-muted hover:bg-lilac hover:text-night aria-expanded:bg-lilac aria-expanded:text-night"
            aria-label={`Options for ${code}`}
            aria-expanded={open}
            aria-haspopup="menu"
            onClick={() => setMenuFor(open ? null : code)}
          >
            <MoreHorizontal className="size-5" aria-hidden />
          </button>
          {open && (
            <CourseMenu
              item={item}
              currentSlot={slotOf(item, byCode)}
              years={years}
              triggerRef={triggerRef}
              close={() => setMenuFor(null)}
            />
          )}
        </div>
      </div>
    </li>
  );
}

function CourseMenu({
  item,
  currentSlot,
  years,
  triggerRef,
  close,
}: {
  item: PlanItem;
  currentSlot: Slot;
  years: number;
  triggerRef: RefObject<HTMLButtonElement | null>;
  close: () => void;
}) {
  const { code } = item;
  const menuRef = useRef<HTMLDivElement>(null);

  const items = () =>
    Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]') ?? []);

  const dismiss = (refocus: boolean) => {
    close();
    if (refocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    items()[0]?.focus();
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      close();
    };
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
    // Mount-only: focus the first item and listen for outside clicks while open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const list = items();
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      list[(at + step + list.length) % list.length]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      list[e.key === "Home" ? 0 : list.length - 1]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      dismiss(true);
    } else if (e.key === "Tab") {
      close();
    }
  };

  const itemClass =
    "flex min-h-11 w-full items-center justify-between gap-2 rounded-[var(--radius-badge)] px-3 text-left text-sm text-night hover:bg-lilac focus-visible:bg-lilac";
  const groupLabel = "px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted";

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={`${code} options`}
      className="absolute right-0 top-12 z-30 w-56 rounded-[var(--radius-control)] border border-line bg-surface p-1 shadow-lg"
      onKeyDown={onKeyDown}
    >
      <p className={groupLabel} aria-hidden>
        Move to
      </p>
      <div role="group" aria-label="Move to year">
        {Array.from({ length: years }, (_, i) => i + 1).map((yr) => {
          const current = yr === item.year;
          return (
            <button
              key={yr}
              type="button"
              role="menuitemradio"
              aria-checked={current}
              className={cn(itemClass, current && "font-semibold")}
              onClick={() => {
                if (!current) {
                  planActions.add(code, yr);
                  toast.message(`Moved ${code} to Year ${yr}`);
                }
                dismiss(true);
              }}
            >
              Year {yr}
              {current ? <Check className="size-4 text-status-plan-text" aria-hidden /> : null}
            </button>
          );
        })}
      </div>
      <div role="separator" className="my-1 h-px bg-line" />
      <p className={groupLabel} aria-hidden>
        Term
      </p>
      <div role="group" aria-label="Term">
        {(["AT", "WS", "BOTH"] as Slot[]).map((s) => {
          const current = s === currentSlot;
          return (
            <button
              key={s}
              type="button"
              role="menuitemradio"
              aria-checked={current}
              className={cn(itemClass, current && "font-semibold")}
              onClick={() => {
                if (!current) planActions.add(code, item.year, s);
                dismiss(true);
              }}
            >
              {SLOT_LABEL[s]}
              {current ? <Check className="size-4 text-status-plan-text" aria-hidden /> : null}
            </button>
          );
        })}
      </div>
      <div role="separator" className="my-1 h-px bg-line" />
      <button
        type="button"
        role="menuitem"
        className={cn(itemClass, "text-destructive hover:bg-destructive-bg focus-visible:bg-destructive-bg")}
        onClick={() => {
          const snapshot = { ...item };
          planActions.remove(code);
          close();
          toast.message(`Removed ${code}`, {
            action: {
              label: "Undo",
              onClick: () =>
                planActions.add(snapshot.code, snapshot.year, snapshot.slot, snapshot.paper),
            },
          });
        }}
      >
        Remove from Plan
      </button>
    </div>
  );
}

function AddBox({
  year,
  plan,
  prepared,
  onAdd,
}: {
  year: number;
  plan: Plan;
  prepared: Prepared[];
  onAdd: (code: string) => void;
}) {
  const id = useId();
  const inputId = `${id}-input`;
  const listId = `${id}-list`;
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const query = q.trim();
  const hits = useMemo(
    () => (query.length < 2 ? [] : searchCourses(prepared, query).items.slice(0, 8)),
    [query, prepared],
  );
  const plannedYear = useMemo(
    () => new Map(plan.items.map((i) => [i.code, i.year] as const)),
    [plan.items],
  );
  const showList = open && query.length >= 2;

  useEffect(() => setActive(0), [query]);

  const pick = (code: string) => {
    if (plannedYear.get(code) === year) {
      toast.message(`${code} is already in Year ${year}`);
    } else {
      onAdd(code);
    }
    setQ("");
    setOpen(false);
  };

  return (
    <div className="relative mt-4">
      <label htmlFor={inputId} className="block text-sm font-medium text-night">
        Add another course to Year {year}
      </label>
      <div className="relative mt-1.5">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
          aria-hidden
        />
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            showList && hits[active] ? `${id}-opt-${hits[active].code}` : undefined
          }
          autoComplete="off"
          spellCheck={false}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              if (q) setQ("");
              setOpen(false);
              return;
            }
            if (!showList || hits.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => (i + 1) % hits.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => (i - 1 + hits.length) % hits.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              const hit = hits[active];
              if (hit) pick(hit.code);
            }
          }}
          placeholder="Search by code or title"
          className="field-input pl-9"
        />
      </div>
      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label={`Courses matching ${query}`}
          className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-[var(--radius-control)] border border-line bg-surface py-1 shadow-lg"
        >
          {hits.length === 0 ? (
            <li className="px-3 py-3 text-sm text-muted" role="presentation">
              No courses match “{query}”.
            </li>
          ) : (
            hits.map((c, i) => {
              const inYear = plannedYear.get(c.code);
              return (
                <li
                  key={c.code}
                  id={`${id}-opt-${c.code}`}
                  role="option"
                  aria-selected={i === active}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-2 px-3 py-1.5 text-sm",
                    i === active && "bg-lilac",
                  )}
                  // Keep focus in the input so blur doesn't close the list before the click lands.
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(c.code)}
                >
                  <span className="w-14 shrink-0 font-data text-xs font-bold text-indigo">
                    {c.code}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-night">{c.title}</span>
                  {inYear != null ? (
                    <span className="shrink-0 rounded-full bg-status-plan-bg px-2 py-0.5 text-[11px] font-medium text-status-plan-text">
                      {inYear === year ? "In this year" : `In Year ${inYear} · move`}
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs text-muted">{unitLabel(c.units)}</span>
                  )}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
