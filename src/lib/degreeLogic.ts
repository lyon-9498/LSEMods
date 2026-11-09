import type { Plan } from "./planStore";
import type { Paper, Programme } from "./programmes";
import type { IndexEntry } from "./types";

/** Identifies a paper within a degree: "<year>#<position in that year>". */
export const paperKey = (year: number, index: number) => `${year}#${index}`;

/** Every course a paper's choice can be filled from: its named options plus all its lists. */
export function paperAllowed(paper: Paper, prog: Programme): Set<string> {
  const s = new Set(paper.options);
  for (const name of paper.lists) for (const c of prog.lists[name] ?? []) s.add(c);
  return s;
}

export interface PaperProgress {
  /** planned courses counted towards this paper's choice (each course counts for one paper only) */
  counted: string[];
  units: number;
}

/**
 * Share the planned courses of each year out between that year's papers, so a course can't fill two papers
 * (e.g. Papers 9 and 10 both drawing on the Economics Selection List).
 * 1. A course picked from a paper's chips or dropdown counts for that paper.
 * 2. Any other planned course in the year fills the first paper that still needs it and allows it.
 * Compulsory courses aren't part of the choice, so they're never shared out.
 */
export function allocatePapers(prog: Programme, plan: Plan, byCode: Map<string, IndexEntry>): Map<string, PaperProgress> {
  const out = new Map<string, PaperProgress>();
  const unitsOf = (c: string) => byCode.get(c)?.units ?? 0;

  for (const y of prog.years) {
    const year = Math.min(y.year, 4);
    const inYear = plan.items.filter((i) => i.year === year);
    const compulsory = new Set(y.papers.flatMap((p) => p.compulsory));
    const papers = y.papers.map((p, idx) => ({
      p,
      key: paperKey(y.year, idx),
      allowed: paperAllowed(p, prog),
      counted: [] as string[],
      units: 0,
    }));
    const needsMore = (e: (typeof papers)[number]) => {
      if (!e.p.choice) return false;
      if (e.p.unitsNeeded !== null) return e.units < e.p.unitsNeeded;
      return e.counted.length === 0; // "pick one", or no amount stated
    };
    const take = (e: (typeof papers)[number], code: string) => {
      e.counted.push(code);
      e.units += unitsOf(code);
      used.add(code);
    };
    const used = new Set<string>();

    for (const i of inYear) {
      if (!i.paper || compulsory.has(i.code)) continue;
      const e = papers.find((x) => x.key === i.paper);
      if (e && e.allowed.has(i.code)) take(e, i.code);
    }
    for (const i of inYear) {
      if (used.has(i.code) || compulsory.has(i.code)) continue;
      const e = papers.find((x) => x.allowed.has(i.code) && needsMore(x));
      if (e) take(e, i.code);
    }
    for (const e of papers) out.set(e.key, { counted: e.counted, units: e.units });
  }
  return out;
}
