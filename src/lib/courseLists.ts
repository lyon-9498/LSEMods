"use client";

import { useEffect, useMemo, useState } from "react";
import { loadSharedLists, type CohortLists } from "./programmes";

/** Outside options and shared subject lists for one start year (the most recent one by default). */
export interface ListInfo {
  cohort: number;
  outside1: Set<string>;
  outside23: Set<string>;
  named: { name: string; codes: Set<string> }[];
}

export const OUTSIDE1_KEY = "outside1";
export const OUTSIDE23_KEY = "outside23";
export const OUTSIDE1_LABEL = "Outside option · Year 1";
export const OUTSIDE23_LABEL = "Outside option · Years 2 & 3";

export function useSharedLists(cohort?: number): ListInfo | null {
  const [all, setAll] = useState<Record<string, CohortLists> | null>(null);
  useEffect(() => {
    loadSharedLists()
      .then(setAll)
      .catch(() => setAll({})); // no lists.json yet: features stay hidden
  }, []);

  return useMemo(() => {
    if (!all) return null;
    const cohorts = Object.keys(all).map(Number).sort((a, b) => b - a);
    if (cohorts.length === 0) return null;
    const c = cohort !== undefined && all[String(cohort)] ? cohort : cohorts[0];
    const d = all[String(c)];
    return {
      cohort: c,
      outside1: new Set(d.outsideYear1),
      outside23: new Set(d.outsideYears23),
      named: Object.entries(d.lists).map(([name, v]) => ({ name, codes: new Set(v.codes) })),
    };
  }, [all, cohort]);
}

/** The lists a course is on, as {key, label} (keys are used in the Browse filter URL). */
export function listsForCourse(info: ListInfo, code: string): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  if (info.outside1.has(code)) out.push({ key: OUTSIDE1_KEY, label: OUTSIDE1_LABEL });
  if (info.outside23.has(code)) out.push({ key: OUTSIDE23_KEY, label: OUTSIDE23_LABEL });
  for (const l of info.named) if (l.codes.has(code)) out.push({ key: `list:${l.name}`, label: l.name });
  return out;
}

/** Courses on the list a Browse filter key refers to (null if the key is unknown). */
export function codesForKey(info: ListInfo, key: string): Set<string> | null {
  if (key === OUTSIDE1_KEY) return info.outside1;
  if (key === OUTSIDE23_KEY) return info.outside23;
  if (key.startsWith("list:")) return info.named.find((l) => l.name === key.slice(5))?.codes ?? null;
  return null;
}
