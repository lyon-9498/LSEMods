"use client";

import { useSyncExternalStore } from "react";
import { debounce, isValidCourseCode } from "./async";

/** Marks keyed by course code. */
export type GradeMap = Record<string, number>;

export const GRADES_KEY = "lsemods-grades-v1";
export const EMPTY_GRADES: GradeMap = {};
const MAX_MARKS = 120;
const MAX_IMPORT_BYTES = 100_000;

/** Returns null when JSON is missing/invalid — callers decide empty vs reject. */
function parseGrades(raw: string | null): GradeMap | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    if (!p || typeof p !== "object" || Array.isArray(p)) return null;
    const hasMarks = "marks" in p;
    if (hasMarks && (p.marks == null || typeof p.marks !== "object" || Array.isArray(p.marks))) {
      return null;
    }
    const src = hasMarks
      ? (p.marks as Record<string, unknown>)
      : (p as Record<string, unknown>);
    const out: GradeMap = {};
    let n = 0;
    for (const [k, v] of Object.entries(src)) {
      if (k === "version") continue;
      if (n >= MAX_MARKS) break;
      const code = k.trim().toUpperCase();
      if (!isValidCourseCode(code)) continue;
      const mark = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(mark) || mark < 0 || mark > 100) continue;
      out[code] = Math.round(mark * 100) / 100;
      n++;
    }
    // Plain object with no valid marks and no marks bag → reject (avoid wiping on junk)
    if (!hasMarks && Object.keys(out).length === 0) return null;
    return out;
  } catch {
    return null;
  }
}

function load(): GradeMap {
  if (typeof window === "undefined") return EMPTY_GRADES;
  try {
    return parseGrades(localStorage.getItem(GRADES_KEY)) ?? EMPTY_GRADES;
  } catch {
    return EMPTY_GRADES;
  }
}

let state: GradeMap = EMPTY_GRADES;
let hydrated = false;
const listeners = new Set<() => void>();
let storageBound = false;

const persist = debounce(() => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(GRADES_KEY, JSON.stringify({ version: 1, marks: state }));
  } catch {
    /* ignore */
  }
}, 180);

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  state = load();
  hydrated = true;
}

function scheduleHydration() {
  if (hydrated || typeof window === "undefined") return;
  queueMicrotask(() => {
    if (hydrated) return;
    ensureHydrated();
    listeners.forEach((l) => l());
  });
}

function commit(next: GradeMap) {
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
      if (e.key !== GRADES_KEY) return;
      state = load();
      hydrated = true;
      listeners.forEach((l) => l());
    });
  }
  return () => listeners.delete(listener);
}

export const useGrades = (): GradeMap =>
  useSyncExternalStore(subscribe, () => state, () => EMPTY_GRADES);

export function exportGradesJson(): string {
  ensureHydrated();
  return JSON.stringify({ version: 1, marks: state }, null, 2);
}

export function importGradesJson(raw: string): boolean {
  if (raw.length > MAX_IMPORT_BYTES) return false;
  const next = parseGrades(raw);
  if (!next) return false;
  commit(next);
  return true;
}

export const gradeActions = {
  set(code: string, mark: number | null) {
    ensureHydrated();
    const normalized = code.trim().toUpperCase();
    if (!isValidCourseCode(normalized)) return;
    const next = { ...state };
    if (mark == null) {
      delete next[normalized];
    } else {
      if (Object.keys(next).length >= MAX_MARKS && !(normalized in next)) return;
      next[normalized] = Math.min(100, Math.max(0, Math.round(mark * 100) / 100));
    }
    commit(next);
  },
  clear() {
    ensureHydrated();
    commit({});
  },
};
