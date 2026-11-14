"use client";

import { useEffect, useMemo, useState } from "react";
import { loadCoursesMeta, type CourseMeta } from "./coursesData";

/** Outside options derived from courses.csv (no longer from programmes/lists.json). */
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

function outsideSet(meta: Map<string, CourseMeta>): Set<string> {
  const out = new Set<string>();
  for (const c of meta.values()) {
    const status = (c.outsideOptionStatus ?? "").toLowerCase();
    if (status.includes("available") && !status.includes("not available") && status !== "closed") {
      out.add(c.code);
    }
  }
  return out;
}

export function useSharedLists(_cohort?: number): ListInfo | null {
  const [meta, setMeta] = useState<Map<string, CourseMeta> | null>(null);
  useEffect(() => {
    loadCoursesMeta()
      .then(setMeta)
      .catch(() => setMeta(new Map()));
  }, []);

  return useMemo(() => {
    if (!meta) return null;
    const outside = outsideSet(meta);
    return {
      cohort: 2026,
      outside1: outside,
      outside23: outside,
      named: [],
    };
  }, [meta]);
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
