/**
 * LSE BA/BSc degree classification (schemes for students from the 2018/19 academic year).
 *
 * Sources (Calendar PDFs):
 * - Three-year: 18 classification marks = 16 from Years 2–3 + First Year Average ×2.
 *   First = 10 firsts, or 8/9 firsts and aggregate ≥ 1180.
 * - Four-year: 26 marks = 24 from Years 2–4 + FYA ×2.
 *   First = 14 firsts, or 12/13 firsts and aggregate ≥ 1700.
 * Full unit = 2 classification marks; half unit (incl. LSE100) = 1.
 * Unofficial helper — always verify on your programme regulations.
 */

export type ClassName = "First" | "2:1" | "2:2" | "Third" | "Pass";
export type HonoursTarget = "First" | "2:1" | "2:2";
export type TargetClass = HonoursTarget | "Third" | "Pass" | "Fail";

export const CLASS_ORDER: ClassName[] = ["First", "2:1", "2:2", "Third", "Pass"];
export const TARGET_OPTIONS: TargetClass[] = [
  "First",
  "2:1",
  "2:2",
  "Third",
  "Pass",
  "Fail",
];

export const FIRST_CLASS_MARK = 70;
export const UPPER_MARK = 60;
export const LOWER_MARK = 50;
export const THIRD_MARK = 40;

interface ClassRule {
  cls: HonoursTarget;
  threshold: number;
  /** Marks at/above threshold that are enough alone */
  marks: number;
  /** Fewer marks enough with the aggregate */
  minMarks: number;
  aggregate: number;
}

export interface Scheme {
  name: string;
  years: 3 | 4;
  /** Classification marks from years after Year 1 */
  laterMarks: number;
  rules: ClassRule[];
  /** Third: this many marks of 40+ */
  thirdMarks: number;
  url: string;
}

export const THREE_YEAR: Scheme = {
  name: "Three-year BA/BSc (from 2018/19)",
  years: 3,
  laterMarks: 16,
  rules: [
    { cls: "First", threshold: 70, marks: 10, minMarks: 8, aggregate: 1180 },
    { cls: "2:1", threshold: 60, marks: 10, minMarks: 8, aggregate: 1030 },
    { cls: "2:2", threshold: 50, marks: 10, minMarks: 8, aggregate: 880 },
  ],
  thirdMarks: 16,
  url: "https://info.lse.ac.uk/staff/divisions/academic-registrars-division/Teaching-Quality-Assurance-and-Review-Office/Assets/Documents/Calendar/BA-BSc-Three-Year-scheme-for-students-from-2018.19.pdf",
};

export const FOUR_YEAR: Scheme = {
  name: "Four-year BA/BSc (from 2018/19)",
  years: 4,
  laterMarks: 24,
  rules: [
    { cls: "First", threshold: 70, marks: 14, minMarks: 12, aggregate: 1700 },
    { cls: "2:1", threshold: 60, marks: 14, minMarks: 12, aggregate: 1490 },
    { cls: "2:2", threshold: 50, marks: 14, minMarks: 12, aggregate: 1270 },
  ],
  thirdMarks: 24,
  url: "https://info.lse.ac.uk/staff/divisions/academic-registrars-division/Teaching-Quality-Assurance-and-Review-Office/Assets/Documents/Calendar/BA-BSc-Four-Year-scheme-for-students-from-2018.19.pdf",
};

export function schemeForYears(years: number): Scheme {
  return years >= 4 ? FOUR_YEAR : THREE_YEAR;
}

export interface GradeCourse {
  code: string;
  year: number;
  units: number | null;
  /** 0–100, or null if not entered yet */
  mark: number | null;
}

export const isLSE100 = (code: string) => code.toUpperCase().startsWith("LSE100");

/** Full unit → 2 classification marks; half → 1; non-credit → 0. */
export const marksFor = (units: number | null | undefined) =>
  units == null || !Number.isFinite(units) || units <= 0 ? 0 : Math.round(units * 2);

/** Best six of nine Year 1 marks, rounded to nearest whole mark. */
export function firstYearAverage(marks: number[]): number {
  const best = [...marks].sort((a, b) => b - a).slice(0, 6);
  if (!best.length) return 0;
  return Math.round(best.reduce((s, m) => s + m, 0) / best.length);
}

const drop = (cls: ClassName, by: number): ClassName =>
  CLASS_ORDER[Math.min(CLASS_ORDER.indexOf(cls) + by, CLASS_ORDER.length - 1)];

/** Classify a full set of classification marks (FYA already included twice). */
export function classify(
  scheme: Scheme,
  marks: number[],
  failedUnits: number,
): { cls: ClassName; aggregate: number } {
  const aggregate = marks.reduce((s, m) => s + m, 0);
  const atLeast = (t: number) => marks.filter((m) => m >= t).length;
  let cls: ClassName = "Pass";
  for (const r of scheme.rules) {
    const n = atLeast(r.threshold);
    if (n >= r.marks || (n >= r.minMarks && aggregate >= r.aggregate)) {
      cls = r.cls;
      break;
    }
  }
  if (cls === "Pass" && atLeast(THIRD_MARK) >= scheme.thirdMarks) cls = "Third";
  if (failedUnits >= 3) cls = "Pass";
  else if (failedUnits > 1) cls = drop(cls, 1);
  return { cls, aggregate };
}

export interface TargetResult {
  cls: TargetClass;
  threshold: number;
  status: "secured" | "possible" | "out_of_reach";
  /** More classification marks needed at threshold (route 1) */
  routeMarks: number | null;
  /** More marks at threshold for aggregate route */
  routeAggMarks: number | null;
  /** Average needed across all remaining classification marks */
  routeAggAverage: number | null;
  aggregate: number | null;
  marksNeeded: number | null;
  minMarks: number | null;
  /** Approximate remaining units for route 1 (marks / 2) */
  routeUnitsApprox: number | null;
  /** Short plain-language note (Pass / Fail / edge cases) */
  note: string | null;
}

export interface Analysis {
  scheme: Scheme;
  fya: number | null;
  fyaMarks: { code: string; mark: number; used: boolean }[] | null;
  known: number[];
  remaining: number;
  average: number | null;
  final: { cls: ClassName; aggregate: number } | null;
  projected: ClassName | null;
  targets: TargetResult[];
  failedUnits: number;
  warnings: string[];
}

export function analyse(scheme: Scheme, courses: GradeCourse[]): Analysis {
  const warnings: string[] = [];
  const counted = courses.filter((c) => marksFor(c.units) > 0);
  const unknownUnits = courses.filter((c) => c.units == null);
  if (unknownUnits.length) {
    warnings.push(
      `No unit value for ${unknownUnits.map((c) => c.code).join(", ")}, so not counted.`,
    );
  }

  const y1 = counted.filter((c) => c.year === 1);
  const y1Marks = y1.reduce((n, c) => n + marksFor(c.units), 0);
  if (y1.length && y1Marks !== 9) {
    warnings.push(
      `Year 1 has ${y1Marks} classification marks; LSE expects nine (four papers plus LSE100).`,
    );
  }

  let fya: number | null = null;
  let fyaMarks: Analysis["fyaMarks"] = null;
  if (y1.length && y1.every((c) => c.mark !== null) && y1Marks >= 6) {
    const list = y1.flatMap((c) =>
      Array.from({ length: marksFor(c.units) }, () => ({
        code: c.code,
        mark: c.mark as number,
      })),
    );
    list.sort((p, q) => q.mark - p.mark);
    fyaMarks = list.map((m, i) => ({ ...m, used: i < 6 }));
    fya = firstYearAverage(list.map((m) => m.mark));
  }

  const later = counted.filter((c) => c.year >= 2);
  const laterPlanned = later.reduce((n, c) => n + marksFor(c.units), 0);
  if (later.length && laterPlanned !== scheme.laterMarks) {
    warnings.push(
      `Years 2+ have ${laterPlanned} classification marks planned; LSE counts ${scheme.laterMarks}.`,
    );
  }
  const laterKnown = later
    .filter((c) => c.mark !== null)
    .flatMap((c) => Array(marksFor(c.units)).fill(c.mark as number) as number[]);

  const known = [...laterKnown, ...(fya !== null ? [fya, fya] : [])];
  const remaining = Math.max(0, scheme.laterMarks - laterKnown.length) + (fya === null ? 2 : 0);
  const knownSum = known.reduce((s, m) => s + m, 0);
  const average = known.length ? knownSum / known.length : null;

  const failedUnits = courses
    .filter(
      (c) =>
        c.mark !== null &&
        c.mark < THIRD_MARK &&
        !isLSE100(c.code) &&
        marksFor(c.units) > 0,
    )
    .reduce((s, c) => s + (c.units ?? 0), 0);
  if (failedUnits > 0) {
    warnings.push(
      `${failedUnits} unit${failedUnits === 1 ? "" : "s"} failed so far. More than one failed unit drops the degree by a class; three cap it at a Pass.`,
    );
  }

  const final = remaining === 0 ? classify(scheme, known, failedUnits) : null;
  const projected =
    remaining > 0 && average !== null
      ? classify(scheme, [...known, ...Array(remaining).fill(Math.round(average))], failedUnits)
          .cls
      : null;

  const honoursTargets: TargetResult[] = scheme.rules.map((r) => {
    const have = known.filter((m) => m >= r.threshold).length;
    const base = {
      cls: r.cls as TargetClass,
      threshold: r.threshold,
      aggregate: r.aggregate,
      marksNeeded: r.marks,
      minMarks: r.minMarks,
      note: null as string | null,
    };
    if (have >= r.marks || (have >= r.minMarks && knownSum >= r.aggregate)) {
      return {
        ...base,
        status: "secured" as const,
        routeMarks: 0,
        routeAggMarks: 0,
        routeAggAverage: 0,
        routeUnitsApprox: 0,
      };
    }
    const moreA = r.marks - have;
    const routeMarks = moreA <= remaining ? moreA : null;
    const moreB = Math.max(0, r.minMarks - have);
    let routeAggMarks: number | null = null;
    let routeAggAverage: number | null = null;
    if (moreB <= remaining && remaining > 0) {
      const avg = Math.max((r.aggregate - knownSum) / remaining, (moreB * r.threshold) / remaining);
      if (avg <= 100) {
        routeAggMarks = moreB;
        routeAggAverage = Math.ceil(avg * 10) / 10;
      }
    }
    const status =
      routeMarks !== null || routeAggMarks !== null
        ? ("possible" as const)
        : ("out_of_reach" as const);
    return {
      ...base,
      status,
      routeMarks,
      routeAggMarks,
      routeAggAverage,
      routeUnitsApprox: routeMarks != null ? Math.round((routeMarks / 2) * 10) / 10 : null,
    };
  });

  const thirdHave = known.filter((m) => m >= THIRD_MARK).length;
  const thirdNeed = Math.max(0, scheme.thirdMarks - thirdHave);
  let third: TargetResult;
  if (thirdHave >= scheme.thirdMarks) {
    third = {
      cls: "Third",
      threshold: THIRD_MARK,
      status: "secured",
      routeMarks: 0,
      routeAggMarks: null,
      routeAggAverage: null,
      aggregate: null,
      marksNeeded: scheme.thirdMarks,
      minMarks: scheme.thirdMarks,
      routeUnitsApprox: 0,
      note: null,
    };
  } else if (thirdNeed <= remaining) {
    third = {
      cls: "Third",
      threshold: THIRD_MARK,
      status: "possible",
      routeMarks: thirdNeed,
      routeAggMarks: null,
      routeAggAverage: null,
      aggregate: null,
      marksNeeded: scheme.thirdMarks,
      minMarks: scheme.thirdMarks,
      routeUnitsApprox: Math.round((thirdNeed / 2) * 10) / 10,
      note: null,
    };
  } else {
    third = {
      cls: "Third",
      threshold: THIRD_MARK,
      status: "out_of_reach",
      routeMarks: null,
      routeAggMarks: null,
      routeAggAverage: null,
      aggregate: null,
      marksNeeded: scheme.thirdMarks,
      minMarks: scheme.thirdMarks,
      routeUnitsApprox: null,
      note: null,
    };
  }

  const passNote =
    "Pass is awarded via fail penalties or falling short of Third.";
  const failNote =
    "Fail means not eligible for a degree — usually too many fails or incomplete assessment.";

  let pass: TargetResult;
  let fail: TargetResult;
  if (final) {
    pass = {
      cls: "Pass",
      threshold: 0,
      status: final.cls === "Pass" ? "secured" : "out_of_reach",
      routeMarks: null,
      routeAggMarks: null,
      routeAggAverage: null,
      aggregate: null,
      marksNeeded: null,
      minMarks: null,
      routeUnitsApprox: null,
      note:
        final.cls === "Pass"
          ? "Classification is Pass."
          : `Classified as ${targetLabel(final.cls as TargetClass)} — above Pass.`,
    };
    fail = {
      cls: "Fail",
      threshold: 0,
      status: "out_of_reach",
      routeMarks: null,
      routeAggMarks: null,
      routeAggAverage: null,
      aggregate: null,
      marksNeeded: null,
      minMarks: null,
      routeUnitsApprox: null,
      note: `A degree class was awarded (${targetLabel(final.cls as TargetClass)}).`,
    };
  } else {
    pass = {
      cls: "Pass",
      threshold: 0,
      status: failedUnits >= 3 ? "secured" : "possible",
      routeMarks: null,
      routeAggMarks: null,
      routeAggAverage: null,
      aggregate: null,
      marksNeeded: null,
      minMarks: null,
      routeUnitsApprox: null,
      note:
        failedUnits >= 3
          ? "Three or more failed units already cap the award at Pass."
          : passNote,
    };
    fail = {
      cls: "Fail",
      threshold: 0,
      status: "possible",
      routeMarks: null,
      routeAggMarks: null,
      routeAggAverage: null,
      aggregate: null,
      marksNeeded: null,
      minMarks: null,
      routeUnitsApprox: null,
      note: failNote,
    };
  }

  return {
    scheme,
    fya,
    fyaMarks,
    known,
    remaining,
    average,
    final,
    projected,
    targets: [...honoursTargets, third, pass, fail],
    failedUnits,
    warnings,
  };
}

export function targetLabel(cls: TargetClass | ClassName): string {
  if (cls === "First") return "First";
  if (cls === "2:1") return "Upper second (2:1)";
  if (cls === "2:2") return "Lower second (2:2)";
  if (cls === "Third") return "Third class";
  if (cls === "Pass") return "Pass";
  return "Fail";
}

export function statusLabel(status: TargetResult["status"]): string {
  if (status === "secured") return "Secured";
  if (status === "possible") return "Possible";
  return "Out of reach";
}

export function parseMarkInput(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return Math.round(n * 100) / 100;
}

/** Approx units from classification marks (2 marks ≈ 1 unit). */
export function marksToUnitsApprox(marks: number): number {
  return Math.round((marks / 2) * 10) / 10;
}
