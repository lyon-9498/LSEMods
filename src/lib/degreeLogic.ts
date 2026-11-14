import { canonicalCode, codeAliases, codesMatch } from "./courseAliases";
import type { CourseMeta } from "./coursesData";
import { isLSE100Variant } from "./plannerLogic";
import type { Plan } from "./planStore";
import type { Programme, ProgrammeRoute, ProgrammeSlot, SlotRuleType } from "./programmes";
import type { IndexEntry } from "./types";

/** Slot id within a degree: "<year>#<order>". */
export const slotKey = (year: number, order: number) => `${year}#${order}`;

/** Cross-year rule id: "x#<order>". */
export const crossYearSlotKey = (order: number) => `x#${order}`;

/** @deprecated use slotKey */
export const paperKey = slotKey;

export const LOCKED_RULES: ReadonlySet<SlotRuleType> = new Set([
  "compulsory",
  "dissertation",
  "LSE100",
]);

export function isLockedSlot(slot: ProgrammeSlot): boolean {
  return LOCKED_RULES.has(slot.ruleType);
}

/**
 * Courses reserved by the degree (compulsory / dissertation / LSE100 / optionPool.compulsory).
 * Must not appear in outside-option or empty option-pool pickers.
 */
export function degreeReservedCodes(prog: Programme): Set<string> {
  const out = new Set<string>();
  for (const c of prog.optionPool?.compulsory ?? []) out.add(canonicalCode(c));
  for (const y of prog.years) {
    for (const slot of y.slots) {
      if (slot.ruleType === "compulsory" || slot.ruleType === "dissertation") {
        for (const c of slot.courses) out.add(canonicalCode(c));
      }
      if (slot.ruleType === "LSE100") {
        for (const a of codeAliases("LSE100")) out.add(a);
        for (const t of prog.lse100Themes ?? ["LSE100"]) {
          for (const a of codeAliases(t)) out.add(a);
        }
      }
    }
  }
  return out;
}

/**
 * True when an outside_option slot should not be shown (no real outside choice this year).
 * Examples: units 0, "None: all … compulsory", study-abroad notes with no course list.
 */
export function isInactiveOutsideSlot(slot: ProgrammeSlot): boolean {
  if (slot.ruleType !== "outside_option") return false;
  if (slot.units === 0) return true;
  const text = (slot.text ?? "").toLowerCase();
  if (/no year\s*\d\s*option|no outside option|all .{0,40}compulsory/.test(text)) return true;
  if (/\bnone\b/.test(text) && /compulsory|no year|no option|not a calendar|not shown/.test(text)) {
    return true;
  }
  // Study-abroad / exchange placeholders are not course pickers.
  if (
    !(slot.courses?.length) &&
    /study abroad|year abroad|fudan|partner university|exchange/.test(text)
  ) {
    return true;
  }
  return false;
}

export function slotNeedsChecking(slot: ProgrammeSlot, course?: CourseMeta): boolean {
  if (slot.issue) return true;
  if ((slot.confidence ?? "").toUpperCase() === "UNVERIFIED") return true;
  // Non-credit skills courses often have empty assessment — expected, not a data error.
  if (course && course.assessmentOk === false && course.units !== 0) return true;
  return false;
}

/** True when a listed course's broken assessment should flag the slot (skip 0u). */
export function courseAssessmentNeedsChecking(course?: CourseMeta | null): boolean {
  if (!course || course.assessmentOk !== false) return false;
  return course.units !== 0;
}

/** Which exclusive route is active in this year, based on planned courses. */
export function activeRouteId(
  slot: ProgrammeSlot,
  plannedCodes: Set<string>,
): string | null {
  if (!slot.routes?.length) return null;
  // Prefer a complete route match; then the richest partial match.
  let best: { id: string; score: number } | null = null;
  for (const route of slot.routes) {
    const codes = route.courses.map(canonicalCode);
    if (!codes.length) continue;
    const hits = codes.filter((c) => plannedCodes.has(c)).length;
    if (!hits) continue;
    const score = hits + (hits === codes.length ? 10 : 0);
    if (!best || score > best.score) best = { id: route.id, score };
  }
  return best?.id ?? null;
}

export function routeCodes(slot: ProgrammeSlot): string[] {
  if (!slot.routes?.length) return [];
  return [...new Set(slot.routes.flatMap((r) => r.courses.map(canonicalCode)))];
}

export function otherRouteCourses(slot: ProgrammeSlot, routeId: string): string[] {
  if (!slot.routes?.length) return [];
  return slot.routes
    .filter((r) => r.id !== routeId)
    .flatMap((r) => r.courses.map(canonicalCode));
}

export function findRoute(slot: ProgrammeSlot, routeId: string): ProgrammeRoute | undefined {
  return slot.routes?.find((r) => r.id === routeId);
}

/** Codes that cannot co-exist for a choose_one_of slot (flat list or all route courses). */
export function exclusiveChoiceCodes(slot: ProgrammeSlot): string[] {
  if (slot.ruleType !== "choose_one_of") return [];
  if (slot.routes?.length) return routeCodes(slot);
  return [...new Set(slot.courses.map(canonicalCode))];
}

/** Whether adding `courseUnits` would stay within the slot's unit target. */
export function fitsSlotUnits(
  slotUnits: number | null | undefined,
  countedUnits: number,
  courseUnits: number | null | undefined,
): boolean {
  if (slotUnits == null) return true;
  const add = courseUnits ?? 0;
  return countedUnits + add <= slotUnits + 1e-9;
}

/** Compact unit tag for chips: "0.5u" / "1u" / "non-credit". */
export function shortUnitLabel(units: number | null | undefined): string | null {
  if (units === null || units === undefined || Number.isNaN(units)) return null;
  if (units === 0) return "non-credit";
  const rounded = Math.round(units * 100) / 100;
  return `${rounded}u`;
}

export function courseUnits(
  code: string,
  byCode: Map<string, IndexEntry>,
  courseMeta: Map<string, CourseMeta>,
): number | null {
  const canon = canonicalCode(code);
  return byCode.get(canon)?.units ?? courseMeta.get(canon)?.units ?? null;
}

/**
 * Codes a slot can be filled from.
 * Empty choose_units_from_list → optionPool.available filtered by course_level <= year.
 */
export function slotAllowedCodes(
  slot: ProgrammeSlot,
  prog: Programme,
  year: number,
  courseMeta: Map<string, CourseMeta>,
): { codes: string[]; usedFallbackPool: boolean; label: string | null } {
  const listed = slot.courses.map(canonicalCode).filter(Boolean);

  if (slot.ruleType === "LSE100") {
    return { codes: ["LSE100"], usedFallbackPool: false, label: null };
  }

  if (slot.ruleType === "compulsory" || slot.ruleType === "dissertation") {
    return { codes: listed, usedFallbackPool: false, label: null };
  }

  if (slot.ruleType === "choose_one_of") {
    return { codes: listed, usedFallbackPool: false, label: null };
  }

  const reserved = degreeReservedCodes(prog);

  if (slot.ruleType === "choose_units_from_list") {
    if (listed.length > 0) {
      return {
        codes: listed.filter((c) => !reserved.has(c)),
        usedFallbackPool: false,
        label: null,
      };
    }
    const pool = (prog.optionPool?.available ?? [])
      .map(canonicalCode)
      .filter((code) => {
        if (reserved.has(code)) return false;
        const meta = courseMeta.get(code);
        if (!meta) return true; // keep unknown; index may still have it
        if (meta.courseLevel == null) return true;
        return meta.courseLevel <= year;
      });
    return {
      codes: [...new Set(pool)].sort(),
      usedFallbackPool: true,
      label: null,
    };
  }

  if (slot.ruleType === "outside_option") {
    if (isInactiveOutsideSlot(slot)) {
      return { codes: [], usedFallbackPool: false, label: null };
    }
    if (listed.length > 0) {
      return {
        codes: listed.filter((c) => !reserved.has(c)),
        usedFallbackPool: false,
        label: null,
      };
    }
    // Prefer courses marked available as outside options; fall back to optionPool.available.
    const fromStatus: string[] = [];
    const seen = new Set<string>();
    for (const meta of courseMeta.values()) {
      if (seen.has(meta.code)) continue;
      seen.add(meta.code);
      if (reserved.has(meta.code)) continue;
      const status = (meta.outsideOptionStatus ?? "").toLowerCase();
      if (!status.includes("available") || status.includes("not available") || status === "closed") {
        continue;
      }
      if (meta.courseLevel != null && meta.courseLevel > year) continue;
      fromStatus.push(meta.code);
    }
    if (fromStatus.length) {
      return {
        codes: fromStatus.sort(),
        usedFallbackPool: true,
        label: null,
      };
    }
    const pool = (prog.optionPool?.available ?? [])
      .map(canonicalCode)
      .filter((code) => {
        if (reserved.has(code)) return false;
        const meta = courseMeta.get(code);
        if (!meta || meta.courseLevel == null) return true;
        return meta.courseLevel <= year;
      });
    return {
      codes: [...new Set(pool)].sort(),
      usedFallbackPool: true,
      label: null,
    };
  }

  return { codes: listed, usedFallbackPool: false, label: null };
}

export interface SlotProgress {
  counted: string[];
  units: number;
}

function unitsOf(
  code: string,
  byCode: Map<string, IndexEntry>,
  courseMeta: Map<string, CourseMeta>,
): number {
  const canon = canonicalCode(code);
  return byCode.get(canon)?.units ?? courseMeta.get(canon)?.units ?? 0;
}

/**
 * Share planned courses between a year's slots so one course can't fill two choice slots.
 * Locked compulsories / dissertations / LSE100 are not shared into choice slots.
 */
export function allocateSlots(
  prog: Programme,
  plan: Plan,
  byCode: Map<string, IndexEntry>,
  courseMeta: Map<string, CourseMeta>,
): Map<string, SlotProgress> {
  const out = new Map<string, SlotProgress>();

  for (const y of prog.years) {
    const year = Math.min(y.year, 4);
    const inYear = plan.items.filter((i) => i.year === year);
    const lockedCodes = new Set<string>();
    for (const s of y.slots) {
      if (!isLockedSlot(s)) continue;
      for (const c of s.courses) lockedCodes.add(canonicalCode(c));
      if (s.ruleType === "LSE100") {
        for (const t of prog.lse100Themes ?? []) lockedCodes.add(canonicalCode(t));
        lockedCodes.add("LSE100");
      }
    }

    const slots = y.slots.map((s) => {
      const allowed = new Set(slotAllowedCodes(s, prog, year, courseMeta).codes.map(canonicalCode));
      return {
        s,
        key: slotKey(y.year, s.order),
        allowed,
        counted: [] as string[],
        units: 0,
      };
    });

    const used = new Set<string>();
    const needsMore = (e: (typeof slots)[number]) => {
      if (isLockedSlot(e.s)) return false;
      if (e.s.units != null) return e.units < e.s.units - 1e-9;
      return e.counted.length === 0;
    };
    const take = (e: (typeof slots)[number], code: string) => {
      e.counted.push(code);
      e.units += unitsOf(code, byCode, courseMeta);
      used.add(canonicalCode(code));
    };

    // 1. Explicit paper/slot assignment on the plan item
    for (const i of inYear) {
      const canon = canonicalCode(i.code);
      if (!i.paper || lockedCodes.has(canon)) continue;
      const e = slots.find((x) => x.key === i.paper);
      if (e && e.allowed.has(canon)) take(e, i.code);
    }

    // 2. Fill remaining choice slots greedily
    for (const i of inYear) {
      const canon = canonicalCode(i.code);
      if (used.has(canon) || lockedCodes.has(canon)) continue;
      const e = slots.find((x) => x.allowed.has(canon) && needsMore(x));
      if (e) take(e, i.code);
    }

    const plannedCodes = new Set(inYear.map((i) => canonicalCode(i.code)));
    const yearRouteId =
      y.slots.map((s) => activeRouteId(s, plannedCodes)).find((id) => id != null) ?? null;

    // 3. Locked slots + route slots: report listed / route codes in the plan for this year
    for (const e of slots) {
      if (e.s.routes?.length && e.s.ruleType === "choose_one_of") {
        const active = activeRouteId(e.s, plannedCodes);
        const route = active ? findRoute(e.s, active) : undefined;
        const counted: string[] = [];
        let units = 0;
        for (const code of route?.courses ?? []) {
          const hit = inYear.find((i) => codesMatch(i.code, code));
          if (hit) {
            counted.push(hit.code);
            units += unitsOf(hit.code, byCode, courseMeta);
          }
        }
        out.set(e.key, { counted, units });
        continue;
      }
      if (e.s.routes?.length && (e.s.ruleType === "outside_option" || e.s.ruleType === "choose_units_from_list")) {
        const route = yearRouteId ? findRoute(e.s, yearRouteId) : undefined;
        const counted = [...e.counted];
        let units = e.units;
        // Fixed courses on the dependent route (e.g. EC1B1 under MA100 Paper 4)
        for (const code of route?.courses ?? []) {
          if (counted.some((c) => codesMatch(c, code))) continue;
          const hit = inYear.find((i) => codesMatch(i.code, code));
          if (hit) {
            counted.push(hit.code);
            units += unitsOf(hit.code, byCode, courseMeta);
          }
        }
        out.set(e.key, { counted, units });
        continue;
      }
      if (!isLockedSlot(e.s)) {
        out.set(e.key, { counted: e.counted, units: e.units });
        continue;
      }
      const counted: string[] = [];
      let units = 0;
      if (e.s.ruleType === "LSE100") {
        const hit = inYear.find((i) => isLSE100Variant(i.code));
        if (hit) {
          const code = canonicalCode(hit.code);
          counted.push(code);
          units += unitsOf(code, byCode, courseMeta);
        }
      } else {
        for (const code of e.s.courses) {
          const hit = inYear.find((i) => codesMatch(i.code, code));
          if (hit) {
            counted.push(hit.code);
            units += unitsOf(hit.code, byCode, courseMeta);
          }
        }
      }
      out.set(e.key, { counted, units });
    }
  }

  // Cross-year rules (e.g. LLB outside option in Year 2 or 3): count items tagged x#order
  for (const rule of prog.crossYearRules ?? []) {
    const key = crossYearSlotKey(rule.order);
    const allowed = new Set(
      slotAllowedCodes(rule, prog, rule.appliesToYears[0] ?? 1, courseMeta).codes.map(canonicalCode),
    );
    const counted: string[] = [];
    let units = 0;
    for (const i of plan.items) {
      if (!rule.appliesToYears.includes(i.year)) continue;
      const canon = canonicalCode(i.code);
      const tagged = i.paper === key;
      const eligible = allowed.has(canon) || rule.courses.length === 0;
      if (!tagged && !(eligible && !i.paper)) continue;
      if (!eligible && !tagged) continue;
      if (tagged || (eligible && !counted.length)) {
        if (counted.some((c) => codesMatch(c, i.code))) continue;
        counted.push(i.code);
        units += unitsOf(i.code, byCode, courseMeta);
        if (rule.units != null && units >= rule.units - 1e-9) break;
      }
    }
    out.set(key, { counted, units });
  }

  return out;
}

/** @deprecated use allocateSlots */
export function allocatePapers(
  prog: Programme,
  plan: Plan,
  byCode: Map<string, IndexEntry>,
  courseMeta: Map<string, CourseMeta> = new Map(),
): Map<string, SlotProgress> {
  return allocateSlots(prog, plan, byCode, courseMeta);
}

/** Compulsory + dissertation + LSE100 codes to drop into the plan. */
export function lockedAutoFillEntries(
  prog: Programme,
  known: (code: string) => boolean,
): { code: string; year: number; paper?: string }[] {
  const years = Math.min(prog.lengthYears || Math.max(...prog.years.map((y) => y.year), 3), 4);
  const entries: { code: string; year: number; paper?: string }[] = [];
  for (const y of prog.years) {
    const year = Math.min(y.year, years);
    for (const s of y.slots) {
      if (s.ruleType === "LSE100") {
        // Always fill — LSE100 is structural Year 1, even if the catalogue map is still loading.
        entries.push({ code: "LSE100", year, paper: slotKey(y.year, s.order) });
        continue;
      }
      if (s.ruleType !== "compulsory" && s.ruleType !== "dissertation") continue;
      for (const raw of s.courses) {
        const code = canonicalCode(raw);
        if (!known(code) && !known(raw)) continue;
        entries.push({
          code: known(code) ? code : raw.toUpperCase(),
          year,
          paper: slotKey(y.year, s.order),
        });
      }
    }
  }
  return entries;
}

export function yearCountedUnits(
  prog: Programme,
  plan: Plan,
  year: number,
  byCode: Map<string, IndexEntry>,
  courseMeta: Map<string, CourseMeta>,
): number {
  const y = prog.years.find((yy) => yy.year === year);
  const inYear = plan.items.filter((i) => i.year === year);
  let units = 0;
  for (const i of inYear) {
    const canon = canonicalCode(i.code);
    // Zero-unit intensives still "count" in structure but add 0; LSE100 counts in Year 1’s 4.5u.
    units += unitsOf(canon, byCode, courseMeta);
  }
  void y;
  return Math.round(units * 100) / 100;
}

export function slotStatusLabel(
  slot: ProgrammeSlot,
  counted: string[],
  plannedYear: Map<string, number>,
  year: number,
  countedUnits = 0,
): string {
  if (slot.routes?.length && slot.ruleType === "choose_one_of") {
    const planned = new Set(
      [...plannedYear.entries()].filter(([, y]) => y === year).map(([c]) => c),
    );
    const active = activeRouteId(slot, planned);
    if (active) {
      const route = findRoute(slot, active);
      return route ? `Route · ${route.label}` : "Route chosen";
    }
    return "Choose a route";
  }
  if (isLockedSlot(slot)) {
    // LSE100 may be stored as LSE100 / LSE100A–C; prefer plan + counted over courses[].
    if (slot.ruleType === "LSE100") {
      const inYear = [...plannedYear.entries()].some(
        ([c, y]) => y === year && isLSE100Variant(c),
      );
      if (inYear || counted.some((c) => isLSE100Variant(c))) return "In plan";
      if ([...plannedYear.keys()].some((c) => isLSE100Variant(c))) return "Wrong year";
      return "Missing";
    }
    if (!slot.courses.length) return slot.issue ? "Needs checking" : "Missing";
    const allInYear = slot.courses.every((c) => plannedYear.get(canonicalCode(c)) === year);
    const allSomewhere = slot.courses.every((c) => plannedYear.has(canonicalCode(c)));
    if (allInYear) return "In plan";
    if (allSomewhere) return "Wrong year";
    return "Missing";
  }
  if (slot.units != null) {
    const need = slot.units;
    if (countedUnits <= 0 && !counted.length) return `choose ${need}u`;
    if (countedUnits + 1e-9 >= need) return `${shortUnitLabel(countedUnits)} / ${need}u`;
    return `${shortUnitLabel(countedUnits) ?? "0u"} / ${need}u`;
  }
  return counted.length ? "In plan" : "choose";
}
