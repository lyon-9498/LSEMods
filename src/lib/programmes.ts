/** Degree regulations scraped by scrapers/scrape_programmes.py */

import { isValidProgrammeId } from "./urls";

export interface ProgrammeSummary {
  id: string;
  cohort: number;
  name: string;
  code: string | null;
  department: string | null;
  url: string;
  years: number;
  compulsory: number;
  choices: number;
}

export interface Paper {
  label: string;
  lines: string[];
  compulsory: string[];
  choice: boolean;
  options: string[];
  lists: string[];
  unitsNeeded: number | null;
  pickOne: boolean;
  alternatives: boolean;
  outside?: "allowed" | "exceptional" | null;
}

export interface Programme {
  id: string;
  cohort: number;
  name: string;
  code: string | null;
  department: string | null;
  url: string;
  years: { year: number; papers: Paper[] }[];
  lists: Record<string, string[]>;
  warnings: string[];
}

export interface CohortLists {
  outsideYear1: string[];
  outsideYears23: string[];
  lists: Record<string, { codes: string[]; usedBy: string[] }>;
  mismatches: { name: string; versions: number; programmes: number; differing: string[] }[];
}

const cache = new Map<string, Promise<unknown>>();

function getJson<T>(path: string): Promise<T> {
  if (!cache.has(path)) {
    cache.set(
      path,
      fetch(`/data/programmes/${path}`).then((r) => {
        if (!r.ok) throw new Error(`${path}: ${r.status}`);
        return r.json();
      }),
    );
  }
  return cache.get(path) as Promise<T>;
}

export const loadProgrammeIndex = () => getJson<ProgrammeSummary[]>("index.json");
export const loadSharedLists = () => getJson<Record<string, CohortLists>>("lists.json");

export function loadProgramme(id: string): Promise<Programme> {
  if (!isValidProgrammeId(id)) {
    return Promise.reject(new Error(`Invalid programme id: ${id}`));
  }
  return getJson<Programme>(`${id}.json`);
}

export const cohortLabel = (c: number) => `${c}/${String((c + 1) % 100).padStart(2, "0")}`;
