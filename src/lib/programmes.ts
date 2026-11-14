/** Programme structures from public/data/programmes.json (2026/27 entry). */

import { canonicalCode } from "./courseAliases";
import { isValidProgrammeId } from "./urls";

export type SlotRuleType =
  | "compulsory"
  | "choose_one_of"
  | "choose_units_from_list"
  | "outside_option"
  | "LSE100"
  | "dissertation";

/** Mutually exclusive path inside a slot (e.g. MA108+EC1B1 vs MA100). */
export interface ProgrammeRoute {
  id: string;
  label: string;
  courses: string[];
  units?: number | null;
  text?: string | null;
}

export interface ProgrammeSlot {
  order: number;
  ruleType: SlotRuleType;
  units: number | null;
  courses: string[];
  /** When set, the student picks one route rather than free codes from `courses`. */
  routes?: ProgrammeRoute[];
  text: string;
  confidence: string;
  issue: string | null;
  countsInYearTotal: boolean;
  ruleTypeRaw?: string;
  unitsRaw?: string;
}

export interface ProgrammeYear {
  year: number;
  slots: ProgrammeSlot[];
}

/** Slot that spans more than one year (e.g. LLB outside option in Year 2 or 3). */
export interface CrossYearRule extends ProgrammeSlot {
  /** Raw label from the data pack, e.g. "2-3", "1,2,4", "2 or 3". */
  years: string;
  /** Parsed year numbers the rule can apply in. */
  appliesToYears: number[];
}

export interface Programme {
  id: string;
  name: string;
  degree: string;
  lengthYears: number;
  department: string | null;
  url: string;
  totalUnits: number;
  ucasCode: string | null;
  yearAbroadOrPlacement?: string | null;
  years: ProgrammeYear[];
  crossYearRules: CrossYearRule[];
  optionPool: { compulsory: string[]; available: string[] };
  lse100Themes: string[];
}

/** Parse "2-3", "1,2,4", "2 or 3" into year numbers. */
export function parseCrossYearSpec(spec: string): number[] {
  const raw = (spec ?? "").trim().toLowerCase();
  if (!raw) return [];
  const out = new Set<number>();
  if (/^\d+\s*-\s*\d+$/.test(raw)) {
    const [a, b] = raw.split("-").map((n) => Number(n.trim()));
    if (Number.isFinite(a) && Number.isFinite(b)) {
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      for (let y = lo; y <= hi; y++) out.add(y);
    }
    return [...out].sort((x, y) => x - y);
  }
  for (const part of raw.split(/[,/]| or /i)) {
    const n = Number(part.trim());
    if (Number.isFinite(n) && n >= 1 && n <= 6) out.add(n);
  }
  return [...out].sort((x, y) => x - y);
}

export interface ProgrammeSummary {
  id: string;
  name: string;
  degree: string;
  years: number;
  department: string | null;
  url: string;
  ucasCode: string | null;
  compulsory: number;
  choices: number;
}

const ACRONYM_STOP = new Set([
  "a",
  "an",
  "and",
  "ba",
  "bachelor",
  "bsc",
  "for",
  "in",
  "laws",
  "llb",
  "of",
  "or",
  "the",
  "with",
]);

/** Initials from significant words — "BSc International Social and Public Policy" → "ISPP". */
export function programmeAcronym(name: string): string {
  const stripped = name.replace(/\([^)]*\)/g, " ");
  return stripped
    .split(/[\s,/]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0 && !ACRONYM_STOP.has(w.toLowerCase()))
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/** Haystack for degree search: name, slug, award, UCAS, acronyms (full + before "with"). */
export function programmeSearchHaystack(p: Pick<ProgrammeSummary, "id" | "name" | "degree" | "ucasCode">): string {
  const beforeWith = p.name.split(/\s+with\s+/i)[0] ?? p.name;
  return [
    p.name,
    p.id,
    p.id.replace(/-/g, " "),
    p.degree,
    p.ucasCode ?? "",
    programmeAcronym(p.name),
    programmeAcronym(beforeWith),
  ]
    .join(" ")
    .toLowerCase();
}

export function programmeMatchesQuery(
  p: Pick<ProgrammeSummary, "id" | "name" | "degree" | "ucasCode">,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = programmeSearchHaystack(p);
  if (hay.includes(q)) return true;
  return q.split(/\s+/).every((token) => token.length > 0 && hay.includes(token));
}

let allCache: Promise<Programme[]> | null = null;

function loadAll(): Promise<Programme[]> {
  if (!allCache) {
    allCache = fetch("/data/programmes.json?v=2026-hide-empty-outside")
      .then((r) => {
        if (!r.ok) throw new Error(`programmes.json: ${r.status}`);
        return r.json() as Promise<Programme[]>;
      })
      .then((list) =>
        list.map((p) => {
          const normalizeSlot = (s: ProgrammeSlot): ProgrammeSlot => ({
            ...s,
            courses: (s.courses ?? []).map((c) => String(c).toUpperCase()),
            countsInYearTotal: s.countsInYearTotal !== false,
            routes: Array.isArray(s.routes)
              ? s.routes.map((r) => ({
                  ...r,
                  id: String(r.id),
                  label: r.label || String(r.id),
                  courses: (r.courses ?? []).map((c) => String(c).toUpperCase()),
                }))
              : undefined,
          });
          const crossYearRules: CrossYearRule[] = (Array.isArray(p.crossYearRules) ? p.crossYearRules : [])
            .map((raw) => {
              const s = raw as CrossYearRule;
              const yearsLabel = typeof s.years === "string" ? s.years : "";
              return {
                ...normalizeSlot(s),
                years: yearsLabel,
                appliesToYears: parseCrossYearSpec(yearsLabel),
              };
            })
            .filter((r) => r.appliesToYears.length > 0);
          return {
            ...p,
            optionPool: p.optionPool ?? { compulsory: [], available: [] },
            lse100Themes: [
              ...new Set(
                (p.lse100Themes?.length ? p.lse100Themes : ["LSE100"]).map((t) =>
                  canonicalCode(t),
                ),
              ),
            ],
            crossYearRules,
            years: (p.years ?? []).map((y) => ({
              year: y.year,
              slots: (y.slots ?? []).map(normalizeSlot),
            })),
          };
        }),
      );
  }
  return allCache;
}

export async function loadProgrammeIndex(): Promise<ProgrammeSummary[]> {
  const all = await loadAll();
  return all.map((p) => {
    let compulsory = 0;
    let choices = 0;
    for (const y of p.years) {
      for (const s of y.slots) {
        if (s.ruleType === "compulsory" || s.ruleType === "dissertation" || s.ruleType === "LSE100") {
          compulsory += 1;
        } else {
          choices += 1;
        }
      }
    }
    return {
      id: p.id,
      name: p.name,
      degree: p.degree,
      years: p.lengthYears,
      department: p.department,
      url: p.url,
      ucasCode: p.ucasCode,
      compulsory,
      choices,
    };
  });
}

export async function loadProgramme(id: string): Promise<Programme> {
  if (!isValidProgrammeId(id)) {
    return Promise.reject(new Error(`Invalid programme id: ${id}`));
  }
  const all = await loadAll();
  const found = all.find((p) => p.id === id);
  if (!found) throw new Error(`Unknown programme: ${id}`);
  return found;
}

/** @deprecated Shared cohort lists.json is no longer the programme source of truth. */
export async function loadSharedLists(): Promise<Record<string, never>> {
  return {};
}

export type CohortLists = never;
