"use client";

import { useSyncExternalStore } from "react";
import { debounce, isValidCourseCode } from "./async";
import { isValidProgrammeId } from "./urls";

/** Where a course sits within its year: Autumn, Winter/Spring, or spanning the whole year. */
export type Slot = "AT" | "WS" | "BOTH";
export const SLOTS: Slot[] = ["AT", "WS", "BOTH"];

export interface PlanItem {
  code: string;
  year: number;
  slot?: Slot;
  paper?: string;
}
export interface Plan {
  years: number;
  items: PlanItem[];
  exemptions: string[];
  programme?: string;
}

export const PLAN_KEY = "lsemods-plan-v1";
export const EMPTY_PLAN: Plan = { years: 3, items: [], exemptions: [] };
const MAX_ITEMS = 80;
const MAX_EXEMPTIONS = 40;
const MAX_IMPORT_BYTES = 200_000;

type PersistListener = (err: string | null) => void;
const persistListeners = new Set<PersistListener>();

/** Returns null when JSON is missing/invalid — callers decide empty vs reject. */
function parsePlan(raw: string | null): Plan | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    if (!p || typeof p !== "object" || Array.isArray(p) || !Array.isArray(p.items)) return null;
    const items = p.items
      .filter((i: unknown): i is PlanItem => {
        const x = i as PlanItem;
        return (
          typeof x?.code === "string" &&
          isValidCourseCode(x.code) &&
          Number.isInteger(x?.year) &&
          x.year >= 1 &&
          x.year <= 6
        );
      })
      .slice(0, MAX_ITEMS)
      .map((i: PlanItem) => ({
        code: String(i.code).toUpperCase(),
        year: i.year,
        ...(i.slot && SLOTS.includes(i.slot) ? { slot: i.slot } : {}),
        ...(typeof i.paper === "string" && i.paper.length < 32 ? { paper: i.paper } : {}),
      }));
    const exemptions = Array.isArray(p.exemptions)
      ? p.exemptions
          .filter((x: unknown) => typeof x === "string" && isValidCourseCode(x as string))
          .map((c: string) => c.toUpperCase())
          .slice(0, MAX_EXEMPTIONS)
      : [];
    const programme =
      typeof p.programme === "string" && isValidProgrammeId(p.programme) ? p.programme : undefined;
    return {
      years: Math.min(Math.max(Number(p.years) || 3, 1), 6),
      items,
      exemptions,
      ...(programme ? { programme } : {}),
    };
  } catch {
    return null;
  }
}

function load(): Plan {
  if (typeof window === "undefined") return EMPTY_PLAN;
  try {
    return parsePlan(localStorage.getItem(PLAN_KEY)) ?? EMPTY_PLAN;
  } catch {
    return EMPTY_PLAN;
  }
}

let state: Plan = EMPTY_PLAN;
let hydrated = false;
const listeners = new Set<() => void>();
let storageBound = false;
let lastPersistError: string | null = null;

function setPersistError(err: string | null) {
  lastPersistError = err;
  persistListeners.forEach((l) => l(err));
}

const persist = debounce(() => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PLAN_KEY, JSON.stringify(state));
    setPersistError(null);
  } catch {
    setPersistError("couldn’t save in this browser");
  }
}, 180);

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  state = load();
  hydrated = true;
}

/** Load localStorage after the first paint so SSR HTML matches the initial client render. */
function scheduleHydration() {
  if (hydrated || typeof window === "undefined") return;
  queueMicrotask(() => {
    if (hydrated) return;
    ensureHydrated();
    listeners.forEach((l) => l());
  });
}

function commit(next: Plan) {
  ensureHydrated();
  state = next;
  persist();
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  scheduleHydration();
  if (!storageBound && typeof window !== "undefined") {
    storageBound = true;
    window.addEventListener("storage", (e) => {
      if (e.key !== PLAN_KEY) return;
      state = load();
      hydrated = true;
      listeners.forEach((l) => l());
    });
  }
  return () => {
    listeners.delete(listener);
  };
}

export const usePlan = (): Plan =>
  useSyncExternalStore(
    subscribe,
    () => state,
    () => EMPTY_PLAN,
  );

export function getPlanPersistError() {
  return lastPersistError;
}

/** Subscribe to persist errors (fires after debounced write attempt). */
export function onPlanPersistError(listener: PersistListener) {
  persistListeners.add(listener);
  return () => {
    persistListeners.delete(listener);
  };
}

export function exportPlanJson(): string {
  ensureHydrated();
  return JSON.stringify(state, null, 2);
}

export function importPlanJson(raw: string): boolean {
  if (raw.length > MAX_IMPORT_BYTES) return false;
  const next = parsePlan(raw);
  if (!next) return false;
  commit(next);
  return true;
}

export const planActions = {
  add(code: string, year: number, slot?: Slot, paper?: string) {
    ensureHydrated();
    const normalized = code.trim().toUpperCase();
    if (!isValidCourseCode(normalized)) return;
    const existing = state.items.find((i) => i.code === normalized);
    const items = state.items.filter((i) => i.code !== normalized);
    if (items.length >= MAX_ITEMS && !existing) return;
    const keepSlot = slot ?? existing?.slot;
    const keepPaper = paper ?? existing?.paper;
    commit({
      ...state,
      items: [
        ...items,
        {
          code: normalized,
          year,
          ...(keepSlot ? { slot: keepSlot } : {}),
          ...(keepPaper ? { paper: keepPaper } : {}),
        },
      ],
    });
  },
  remove(code: string) {
    ensureHydrated();
    const normalized = code.trim().toUpperCase();
    commit({ ...state, items: state.items.filter((i) => i.code !== normalized) });
  },
  setYears(n: number) {
    ensureHydrated();
    commit({ ...state, years: n, items: state.items.map((i) => (i.year > n ? { ...i, year: n } : i)) });
  },
  addExemption(raw: string) {
    ensureHydrated();
    const code = raw.trim().toUpperCase();
    if (!isValidCourseCode(code) || state.exemptions.includes(code)) return;
    if (state.exemptions.length >= MAX_EXEMPTIONS) return;
    commit({ ...state, exemptions: [...state.exemptions, code] });
  },
  removeExemption(code: string) {
    ensureHydrated();
    commit({ ...state, exemptions: state.exemptions.filter((c) => c !== code) });
  },
  setProgramme(id: string | undefined) {
    ensureHydrated();
    const { programme: _old, ...rest } = state;
    void _old;
    if (id && !isValidProgrammeId(id)) return;
    commit(id ? { ...rest, programme: id } : rest);
  },
  switchProgramme(id: string | undefined) {
    ensureHydrated();
    const { programme: _old, ...rest } = state;
    void _old;
    if (id && !isValidProgrammeId(id)) return;
    commit({ ...rest, items: [], ...(id ? { programme: id } : {}) });
  },
  addMany(entries: { code: string; year: number }[]) {
    ensureHydrated();
    const have = new Set(state.items.map((i) => i.code));
    const fresh: PlanItem[] = [];
    for (const e of entries) {
      const code = e.code.trim().toUpperCase();
      if (!isValidCourseCode(code) || have.has(code)) continue;
      if (state.items.length + fresh.length >= MAX_ITEMS) break;
      have.add(code);
      fresh.push({ code, year: e.year });
    }
    if (fresh.length) commit({ ...state, items: [...state.items, ...fresh] });
    return fresh.length;
  },
  clear() {
    ensureHydrated();
    commit({
      ...EMPTY_PLAN,
      years: state.years,
      ...(state.programme ? { programme: state.programme } : {}),
    });
  },
};
