"use client";

import { useSyncExternalStore } from "react";
import { debounce } from "./async";

export type WeekDay = 1 | 2 | 3 | 4 | 5; // Mon–Fri

export interface WeekBlock {
  id: string;
  code: string;
  day: WeekDay;
  startMin: number;
  endMin: number;
  label: string;
}

interface WeekPlan {
  blocks: WeekBlock[];
}

const KEY = "lsemods-week-v1";
const EMPTY: WeekPlan = { blocks: [] };

function load(): WeekPlan {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const p = JSON.parse(raw);
    if (!p || !Array.isArray(p.blocks)) return EMPTY;
    return {
      blocks: p.blocks.filter((b: WeekBlock) => {
        if (!b || typeof b.id !== "string" || typeof b.code !== "string") return false;
        if (![1, 2, 3, 4, 5].includes(b.day)) return false;
        if (typeof b.startMin !== "number" || typeof b.endMin !== "number") return false;
        if (!Number.isFinite(b.startMin) || !Number.isFinite(b.endMin)) return false;
        if (b.endMin <= b.startMin) return false;
        return typeof b.label === "string";
      }),
    };
  } catch {
    return EMPTY;
  }
}

let state: WeekPlan = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

const persist = debounce(() => {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}, 100);

function ensure() {
  if (hydrated || typeof window === "undefined") return;
  state = load();
  hydrated = true;
}

function scheduleHydration() {
  if (hydrated || typeof window === "undefined") return;
  queueMicrotask(() => {
    if (hydrated) return;
    ensure();
    listeners.forEach((l) => l());
  });
}

function commit(next: WeekPlan) {
  ensure();
  state = next;
  persist();
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  scheduleHydration();
  return () => listeners.delete(l);
}

export const useWeekPlan = () =>
  useSyncExternalStore(subscribe, () => state, () => EMPTY);

export function blocksClash(a: WeekBlock, b: WeekBlock) {
  return a.day === b.day && a.startMin < b.endMin && b.startMin < a.endMin;
}

export const weekActions = {
  addForCourse(code: string) {
    ensure();
    const normalized = code.trim().toUpperCase();
    if (!normalized) return;
    if (state.blocks.some((b) => b.code === normalized)) return;
    const id = `${normalized}-${Date.now()}`;
    const lecture: WeekBlock = {
      id: `${id}-lec`,
      code: normalized,
      day: 1,
      startMin: 10 * 60,
      endMin: 11 * 60,
      label: "Lecture (placeholder)",
    };
    const cls: WeekBlock = {
      id: `${id}-cls`,
      code: normalized,
      day: 3,
      startMin: 14 * 60,
      endMin: 15 * 60,
      label: "Class (placeholder)",
    };
    commit({ blocks: [...state.blocks, lecture, cls] });
  },
  update(block: WeekBlock) {
    commit({ blocks: state.blocks.map((b) => (b.id === block.id ? block : b)) });
  },
  remove(id: string) {
    commit({ blocks: state.blocks.filter((b) => b.id !== id) });
  },
  removeCode(code: string) {
    const c = code.toUpperCase();
    commit({ blocks: state.blocks.filter((b) => b.code !== c) });
  },
  clear() {
    commit(EMPTY);
  },
};

export const DAY_LABELS: Record<WeekDay, string> = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
};

export function formatTime(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
