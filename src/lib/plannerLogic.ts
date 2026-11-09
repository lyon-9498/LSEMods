import type { Course, IndexEntry, Req } from "./types";
import type { Plan, PlanItem, Slot } from "./planStore";
import type { Programme } from "./programmes";

export type Severity = "error" | "warn";
export interface Issue {
  severity: Severity;
  text: string;
}

export function satisfied(tree: Req, have: Set<string>): boolean {
  if (tree.type === "course") return have.has(tree.code);
  return tree.type === "and"
    ? tree.children.every((c) => satisfied(c, have))
    : tree.children.some((c) => satisfied(c, have));
}

function describeAll(tree: Req): string {
  if (tree.type === "course") return tree.code;
  const parts = tree.children.map((c) => (c.type === "course" ? c.code : `(${describeAll(c)})`));
  return tree.type === "and" ? parts.join(" and ") : `one of ${parts.join(", ")}`;
}

/** What is still missing, in words: "EC2A1 and (one of MA100, MA107)". */
export function describeUnmet(tree: Req, have: Set<string>): string {
  if (tree.type === "course") return tree.code;
  if (tree.type === "or") return describeAll(tree);
  const unmet = tree.children.filter((c) => !satisfied(c, have));
  if (unmet.length === 1) return describeUnmet(unmet[0], have);
  return unmet.map((c) => (c.type === "course" ? c.code : `(${describeUnmet(c, have)})`)).join(" and ");
}

/** Default placement from LSE's data: taught in Autumn and later = full year. */
export function defaultSlot(e: IndexEntry | undefined): Slot {
  if (!e) return "BOTH";
  const autumn = e.terms.includes("AT");
  const later = e.terms.includes("WT") || e.terms.includes("ST");
  if (autumn && later) return "BOTH";
  if (autumn) return "AT";
  if (later) return "WS";
  return e.units === 0.5 ? "AT" : "BOTH"; // no term data
}

export const slotOf = (item: PlanItem, byCode: Map<string, IndexEntry>): Slot =>
  item.slot ?? defaultSlot(byCode.get(item.code));

// Each year has two term positions: Autumn (0) and Winter/Spring (1).
const startPos = (year: number, slot: Slot) => year * 2 + (slot === "WS" ? 1 : 0);
const endPos = (year: number, slot: Slot) => year * 2 + (slot === "AT" ? 0 : 1);

export const SLOT_LABEL: Record<Slot, string> = { AT: "Autumn", WS: "Winter / Spring", BOTH: "Full year" };

/* ---------- capped courses ---------- */

/**
 * The course guide's "Capped 2025/26: ..." key fact (last year's cap). "Yes..." = capped, "No" = not capped,
 * anything else (or missing) = unknown. The raw text is kept so the exact wording can be shown on hover.
 */
export function cappedLastYear(raw: string | null | undefined): { capped: boolean; text: string } | null {
  if (!raw) return null;
  const t = raw.trim();
  if (/^yes\b/i.test(t)) return { capped: true, text: t };
  if (/^no\b/i.test(t)) return { capped: false, text: t };
  return null;
}

/** What a course's guide says about limited places. */
export interface CapInfo {
  /** places are first come, first served: choose it the moment course selection opens */
  firstCome: boolean;
  /** only last year's Key-facts line says it was capped; this year's Availability text doesn't */
  lastYearOnly: boolean;
  /** LSE's own wording, for hover text and notices */
  text: string;
}

const CAP_SENTENCE = /\bcapped\b|limited (number of )?places|first[- ]come|places (will be|are) (allocated|assigned)/i;
const FIRST_COME = /first[- ]come,?\s*(first[- ])?serve/i;

/**
 * Reads the Availability text ("This course is capped. ... places will be assigned on a first come first serve basis")
 * and falls back to last year's "Capped 2025/26: Yes" key fact. Returns null for uncapped courses.
 */
export function courseCap(
  c: { availability: string | null; stats?: { capped: string | null } } | null | undefined,
): CapInfo | null {
  if (!c) return null;
  const sentences = (c.availability ?? "").split(/(?<=[.!?])\s+/);
  const relevant = sentences.filter((x) => CAP_SENTENCE.test(x) && !/\bnot capped\b/i.test(x));
  const cappedNow = relevant.some((x) => /\bcapped\b|limited (number of )?places/i.test(x));
  const firstCome = relevant.some((x) => FIRST_COME.test(x));
  if (cappedNow || firstCome) return { firstCome, lastYearOnly: false, text: relevant.join(" ") };
  const kf = cappedLastYear(c.stats?.capped);
  if (kf?.capped) return { firstCome: false, lastYearOnly: true, text: `Capped 2025/26: ${kf.text}` };
  return null;
}

/* ---------- outside options ---------- */

/** What the planner needs to judge outside options; only built once a degree is chosen. */
export interface OutsideContext {
  outside1: Set<string>;
  outside23: Set<string>;
  /** courses the chosen degree names itself: compulsory, options and its own subject lists */
  degreeCodes: Set<string>;
  /** department prefixes of the chosen degree (e.g. AC and FM for Accounting and Finance) */
  ownPrefixes: Set<string>;
  /** per year, the papers that mention outside options and on what terms; null for older data without this */
  outsidePapers: Map<number, { label: string; rule: "allowed" | "exceptional" }[]> | null;
}

export function outsidePapers(prog: Programme): OutsideContext["outsidePapers"] {
  const papers = prog.years.flatMap((y) => y.papers);
  if (!papers.some((p) => p.outside !== undefined)) return null; // scraped before this was recorded
  const out = new Map<number, { label: string; rule: "allowed" | "exceptional" }[]>();
  for (const y of prog.years)
    out.set(
      y.year,
      y.papers.filter((p) => p.outside).map((p) => ({ label: p.label, rule: p.outside as "allowed" | "exceptional" })),
    );
  return out;
}

export const coursePrefix = (code: string) => code.match(/^[A-Z]+/)?.[0] ?? "";

// Subject words in a degree's name or department -> the course-code prefix of that department.
// LSE: an outside option is a course outside the subject(s) named in your degree.
const SUBJECTS: [RegExp, string][] = [
  [/economic history/i, "EH"],
  [/international relations/i, "IR"],
  [/international history/i, "HY"],
  [/social policy/i, "SP"],
  [/data science/i, "ST"],
  [/actuarial science/i, "ST"],
  [/anthropology/i, "AN"],
  [/econometrics|economics/i, "EC"],
  [/accounting/i, "AC"],
  [/finance/i, "FM"],
  [/geography|environment/i, "GY"],
  [/politics|government/i, "GV"],
  [/philosophy/i, "PH"],
  [/sociology/i, "SO"],
  [/mathematic/i, "MA"],
  [/statistic/i, "ST"],
  [/management/i, "MG"],
  [/\blaws?\b|\bllb\b/i, "LL"],
  [/psycholog/i, "PB"],
  [/history/i, "HY"],
];

export function degreePrefixes(name: string, department: string | null): Set<string> {
  const out = new Set<string>();
  let text = `${name} ${department ?? ""}`;
  for (const [re, prefix] of SUBJECTS) {
    if (re.test(text)) {
      out.add(prefix);
      text = text.replace(new RegExp(re.source, "gi"), " "); // "Economic History" must not also count as History
    }
  }
  return out;
}

export function degreeCourseCodes(prog: Programme): Set<string> {
  const s = new Set<string>();
  for (const y of prog.years)
    for (const p of y.papers) {
      p.compulsory.forEach((c) => s.add(c));
      p.options.forEach((c) => s.add(c));
      for (const name of p.lists)
        if (!/outside options list/i.test(name)) (prog.lists[name] ?? []).forEach((c) => s.add(c));
    }
  return s;
}

/** Is this planned course being taken as an outside option (on the list for its year, not part of the degree)? */
export function isOutsideOption(code: string, year: number, ctx: OutsideContext | undefined): boolean {
  if (!ctx || ctx.degreeCodes.has(code)) return false;
  return year === 1 ? ctx.outside1.has(code) : ctx.outside23.has(code) || ctx.outside1.has(code);
}

export function courseIssues(
  plan: Plan,
  details: Map<string, Course | null>,
  byCode: Map<string, IndexEntry>,
  outside?: OutsideContext,
): Map<string, Issue[]> {
  const out = new Map<string, Issue[]>();
  const planned = new Set(plan.items.map((i) => i.code));

  for (const item of plan.items) {
    const issues: Issue[] = [];
    if (!byCode.has(item.code)) issues.push({ severity: "warn", text: "Not in the current catalogue data" });

    // Outside options (only judged once a degree is chosen, and only for courses the degree doesn't name itself)
    if (outside && !outside.degreeCodes.has(item.code)) {
      const on1 = outside.outside1.has(item.code);
      const on23 = outside.outside23.has(item.code);
      if (item.year >= 2 && on1 && !on23) {
        issues.push({
          severity: "warn",
          text: "Only on the Year 1 outside options list, so it isn’t an approved outside option in Years 2 and 3",
        });
      }
      // Only warn about taking an outside option at all when the regulations restrict it
      if (outside.outsidePapers && isOutsideOption(item.code, item.year, outside)) {
        const papers = outside.outsidePapers.get(item.year) ?? [];
        if (!papers.some((p) => p.rule === "allowed")) {
          const exceptional = papers.filter((p) => p.rule === "exceptional").map((p) => p.label);
          issues.push({
            severity: "warn",
            text: exceptional.length
              ? `Your regulations only allow an outside option in Year ${item.year} in exceptional circumstances (${exceptional.join(", ")}); you’ll need your department’s permission`
              : `Your Year ${item.year} regulations don’t include an outside option`,
          });
        }
      }
      const prefix = coursePrefix(item.code);
      if ((on1 || on23) && outside.ownPrefixes.has(prefix)) {
        issues.push({
          severity: "warn",
          text: `${prefix} is your own degree’s subject, so this can’t count as an outside option`,
        });
      }
    }

    const slot = slotOf(item, byCode);
    const myStart = startPos(item.year, slot);
    const myEnd = endPos(item.year, slot);
    const others = plan.items.filter((i) => i.code !== item.code);

    // Term the data says it's taught in vs where it's been put
    const e = byCode.get(item.code);
    if (e && e.terms.length > 0) {
      const autumn = e.terms.includes("AT");
      const later = e.terms.includes("WT") || e.terms.includes("ST");
      if (slot === "AT" && !autumn) issues.push({ severity: "warn", text: "LSE data doesn’t list it in the Autumn Term" });
      if (slot === "WS" && !later) issues.push({ severity: "warn", text: "LSE data doesn’t list it in the Winter or Spring Term" });
      if (slot === "BOTH" && !(autumn && later)) issues.push({ severity: "warn", text: "LSE data lists it in one term only" });
      if (slot !== "BOTH" && autumn && later) issues.push({ severity: "warn", text: "LSE data lists it across the whole year" });
    }

    const d = details.get(item.code);
    if (d) {
      // A prerequisite counts if it finishes before this course starts (or is an exemption).
      const before = new Set([
        ...plan.exemptions,
        ...others.filter((i) => endPos(i.year, slotOf(i, byCode)) < myStart).map((i) => i.code),
      ]);
      // A co-requisite counts if it starts no later than this course ends.
      const upTo = new Set([
        ...plan.exemptions,
        ...others.filter((i) => startPos(i.year, slotOf(i, byCode)) <= myEnd).map((i) => i.code),
      ]);
      if (d.prereqTree && !satisfied(d.prereqTree, before)) {
        issues.push({ severity: "error", text: `Needs ${describeUnmet(d.prereqTree, before)} in an earlier term` });
      }
      if (d.coreqTree && !satisfied(d.coreqTree, upTo)) {
        issues.push({ severity: "error", text: `Needs ${describeUnmet(d.coreqTree, upTo)} by the same term` });
      }
      for (const p of d.preclusions) {
        if (planned.has(p.code)) {
          issues.push({ severity: "error", text: `Can’t take with ${p.code}: they’re mutually exclusive` });
        }
      }
      if (d.prereqCheck) {
        issues.push({ severity: "warn", text: "Prerequisite wording is unusual; check the course page" });
      }
    }
    out.set(item.code, issues);
  }
  return out;
}

export interface YearSummary {
  year: number;
  codes: string[];
  bySlot: Record<Slot, string[]>;
  /** planned but not counted in unit totals (LSE100) */
  excluded: string[];
  units: number;
  unknownUnits: boolean;
  autumn: number;
  winter: number;
  issues: Issue[];
}

export const fmtUnits = (n: number) => String(Math.round(n * 100) / 100);

/** LSE caps: no more than 4 units in a year; terms should be balanced at about 2 units each. */
export const YEAR_MAX_UNITS = 4;
export const TERM_MAX_UNITS = 2;
/** LSE describes term balance as expected rather than an absolute rule, so this is a warning by default. */
export const TERM_LIMIT_SEVERITY: Severity = "warn";

/** LSE100 is taken on top of the four papers, so it's left out of every unit total. */
export const isExcludedFromUnits = (code: string) => code.startsWith("LSE100");
const unitsWord = (n: number) => `${fmtUnits(n)} unit${n === 1 ? "" : "s"}`;

export function yearSummaries(plan: Plan, byCode: Map<string, IndexEntry>): YearSummary[] {
  const out: YearSummary[] = [];
  for (let y = 1; y <= plan.years; y++) {
    const inYear = plan.items.filter((i) => i.year === y);
    const codes = inYear.map((i) => i.code).sort();
    const bySlot: Record<Slot, string[]> = { AT: [], WS: [], BOTH: [] };
    for (const i of inYear) bySlot[slotOf(i, byCode)].push(i.code);
    for (const k of Object.keys(bySlot) as Slot[]) bySlot[k].sort();
    const excluded = codes.filter(isExcludedFromUnits);
    let units = 0;
    let unknownUnits = false;
    let autumn = 0;
    let winter = 0;
    for (const i of inYear) {
      if (isExcludedFromUnits(i.code)) continue;
      const e = byCode.get(i.code);
      if (!e || e.units === null) {
        unknownUnits = true;
        continue;
      }
      units += e.units;
      // Load follows where it's placed: a full-year course counts half in each term.
      const slot = slotOf(i, byCode);
      if (slot === "AT") autumn += e.units;
      else if (slot === "WS") winter += e.units;
      else {
        autumn += e.units / 2;
        winter += e.units / 2;
      }
    }
    const issues: Issue[] = [];
    const counted = codes.length - excluded.length;
    if (unknownUnits) {
      issues.push({ severity: "warn", text: `${unitsWord(units)} counted; some courses have no unit value in the data.` });
    }
    if (units > YEAR_MAX_UNITS) {
      issues.push({ severity: "error", text: `${unitsWord(units)} in this year: the maximum is ${YEAR_MAX_UNITS}.` });
    } else if (counted > 0 && !unknownUnits && units < YEAR_MAX_UNITS) {
      issues.push({ severity: "warn", text: `${unitsWord(units)} planned. LSE undergraduate years are normally ${YEAR_MAX_UNITS} units.` });
    }
    for (const [name, load] of [["Autumn", autumn], ["Winter / Spring", winter]] as const) {
      if (load > TERM_MAX_UNITS) {
        issues.push({
          severity: TERM_LIMIT_SEVERITY,
          text: `${name}: ${unitsWord(load)}, more than ${TERM_MAX_UNITS}. LSE expects terms to be balanced; check with your department.`,
        });
      }
    }
    out.push({ year: y, codes, bySlot, excluded, units, unknownUnits, autumn, winter, issues });
  }
  return out;
}
