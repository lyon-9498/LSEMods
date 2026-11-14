import { describe, expect, it } from "vitest";
import {
  activeRouteId,
  allocateSlots,
  courseAssessmentNeedsChecking,
  degreeReservedCodes,
  exclusiveChoiceCodes,
  fitsSlotUnits,
  isInactiveOutsideSlot,
  isLockedSlot,
  lockedAutoFillEntries,
  shortUnitLabel,
  slotAllowedCodes,
  slotNeedsChecking,
  slotKey,
  slotStatusLabel,
} from "./degreeLogic";
import type { CourseMeta } from "./coursesData";
import type { Plan } from "./planStore";
import type { Programme, ProgrammeSlot } from "./programmes";
import type { IndexEntry } from "./types";

const baseSlot = (over: Partial<ProgrammeSlot>): ProgrammeSlot => ({
  order: 1,
  ruleType: "compulsory",
  units: 1,
  courses: [],
  text: "",
  confidence: "PARTIAL",
  issue: null,
  countsInYearTotal: true,
  ...over,
});

const prog = (over: Partial<Programme> = {}): Programme => ({
  id: "bsc-test",
  name: "BSc Test",
  degree: "BSc",
  lengthYears: 3,
  department: "Economics",
  url: "https://www.lse.ac.uk/study-at-lse/undergraduate/bsc-test",
  totalUnits: 12,
  ucasCode: "L101",
  years: [],
  crossYearRules: [],
  optionPool: { compulsory: ["EC1A3"], available: ["AC102", "MA102", "ST310"] },
  lse100Themes: ["LSE100"],
  ...over,
});

const meta = (code: string, level: number): CourseMeta => ({
  code,
  title: code,
  department: null,
  units: 0.5,
  terms: ["AT"],
  courseLevel: level,
  convenors: [],
  outsideOptionStatus: "freely available",
  capped: null,
  assessmentComponents: null,
  assessmentTotal: 100,
  assessmentOk: true,
  sourceUrl: null,
});

describe("slotAllowedCodes", () => {
  it("locks choose_one_of to listed codes", () => {
    const slot = baseSlot({
      ruleType: "choose_one_of",
      courses: ["GY204", "GY206"],
    });
    const { codes, usedFallbackPool } = slotAllowedCodes(slot, prog(), 2, new Map());
    expect(codes).toEqual(["GY204", "GY206"]);
    expect(usedFallbackPool).toBe(false);
  });

  it("falls back to optionPool.available filtered by level", () => {
    const slot = baseSlot({ ruleType: "choose_units_from_list", courses: [], units: 1 });
    const map = new Map<string, CourseMeta>([
      ["AC102", meta("AC102", 1)],
      ["MA102", meta("MA102", 1)],
      ["ST310", meta("ST310", 3)],
    ]);
    const { codes, usedFallbackPool, label } = slotAllowedCodes(slot, prog(), 2, map);
    expect(usedFallbackPool).toBe(true);
    expect(label).toBeNull();
    expect(codes).toEqual(["AC102", "MA102"]);
    expect(codes).not.toContain("ST310");
  });

  it("excludes degree compulsories from outside_option pools", () => {
    const p = prog({
      years: [
        {
          year: 1,
          slots: [
            baseSlot({ order: 1, ruleType: "compulsory", courses: ["GV100", "SP100"] }),
            baseSlot({
              order: 2,
              ruleType: "outside_option",
              courses: [],
              units: 1,
              text: "Outside option",
            }),
          ],
        },
      ],
      optionPool: { compulsory: ["GV100"], available: ["AC102", "GV100", "AN100"] },
    });
    const map = new Map<string, CourseMeta>([
      ["AC102", { ...meta("AC102", 1), outsideOptionStatus: "freely available" }],
      ["GV100", { ...meta("GV100", 1), outsideOptionStatus: "freely available" }],
      ["AN100", { ...meta("AN100", 1), outsideOptionStatus: "freely available" }],
      ["SP100", { ...meta("SP100", 1), outsideOptionStatus: "not available" }],
    ]);
    const { codes } = slotAllowedCodes(p.years[0].slots[1], p, 1, map);
    expect(codes).toContain("AC102");
    expect(codes).toContain("AN100");
    expect(codes).not.toContain("GV100");
    expect(codes).not.toContain("SP100");
  });

  it("maps LSE100 to a single course chip", () => {
    const slot = baseSlot({ ruleType: "LSE100", courses: ["LSE100"], units: 0.5 });
    const { codes } = slotAllowedCodes(slot, prog(), 1, new Map());
    expect(codes).toEqual(["LSE100"]);
  });
});

describe("LSE100 as Year 1 compulsory", () => {
  it("auto-fills LSE100 even when the catalogue known() check fails", () => {
    const slot = baseSlot({ ruleType: "LSE100", courses: ["LSE100"], units: 0.5, order: 7 });
    const p = prog({
      years: [{ year: 1, slots: [slot] }],
    });
    expect(lockedAutoFillEntries(p, () => false)).toEqual([
      { code: "LSE100", year: 1, paper: "1#7" },
    ]);
    expect(slotStatusLabel(slot, [], new Map(), 1)).toBe("Missing");
    expect(slotStatusLabel(slot, ["LSE100"], new Map([["LSE100", 1]]), 1)).toBe("In plan");
  });
});

describe("slotNeedsChecking", () => {
  it("flags UNVERIFIED, issue, and bad assessment", () => {
    expect(slotNeedsChecking(baseSlot({ confidence: "UNVERIFIED" }))).toBe(true);
    expect(slotNeedsChecking(baseSlot({ issue: "Missing list" }))).toBe(true);
    expect(
      slotNeedsChecking(baseSlot({}), { ...meta("AC102", 1), assessmentOk: false }),
    ).toBe(true);
    expect(slotNeedsChecking(baseSlot({}), meta("AC102", 1))).toBe(false);
  });

  it("does not flag empty assessment on non-credit courses", () => {
    expect(
      slotNeedsChecking(baseSlot({}), {
        ...meta("IR102", 1),
        units: 0,
        assessmentOk: false,
        assessmentTotal: 0,
      }),
    ).toBe(false);
  });
});

describe("courseAssessmentNeedsChecking", () => {
  it("ignores non-credit empty assessment and flags credit courses", () => {
    expect(
      courseAssessmentNeedsChecking({
        ...meta("IR102", 1),
        units: 0,
        assessmentOk: false,
      }),
    ).toBe(false);
    expect(
      courseAssessmentNeedsChecking({ ...meta("AC102", 1), assessmentOk: false }),
    ).toBe(true);
    expect(courseAssessmentNeedsChecking(meta("AC102", 1))).toBe(false);
  });
});

describe("isLockedSlot", () => {
  it("locks compulsory, dissertation, LSE100", () => {
    expect(isLockedSlot(baseSlot({ ruleType: "compulsory" }))).toBe(true);
    expect(isLockedSlot(baseSlot({ ruleType: "dissertation" }))).toBe(true);
    expect(isLockedSlot(baseSlot({ ruleType: "LSE100" }))).toBe(true);
    expect(isLockedSlot(baseSlot({ ruleType: "choose_one_of" }))).toBe(false);
  });
});

describe("isInactiveOutsideSlot", () => {
  it("hides none / zero-unit / all-compulsory outside slots", () => {
    expect(
      isInactiveOutsideSlot(
        baseSlot({
          ruleType: "outside_option",
          units: 0,
          text: "None: all four Year 1 courses are compulsory",
        }),
      ),
    ).toBe(true);
    expect(
      isInactiveOutsideSlot(
        baseSlot({ ruleType: "outside_option", units: 0, text: "No Year 1 option slot" }),
      ),
    ).toBe(true);
    expect(
      isInactiveOutsideSlot(
        baseSlot({
          ruleType: "outside_option",
          units: 1,
          text: "Approved outside option",
          courses: [],
        }),
      ),
    ).toBe(false);
  });
});

describe("degreeReservedCodes", () => {
  it("collects compulsory codes across years", () => {
    const p = prog({
      years: [
        {
          year: 1,
          slots: [baseSlot({ ruleType: "compulsory", courses: ["SP100", "GV100"] })],
        },
      ],
      optionPool: { compulsory: ["SP101"], available: [] },
    });
    const reserved = degreeReservedCodes(p);
    expect(reserved.has("SP100")).toBe(true);
    expect(reserved.has("GV100")).toBe(true);
    expect(reserved.has("SP101")).toBe(true);
  });

  it("reserves LSE100 and legacy theme spellings", () => {
    const p = prog({
      years: [
        {
          year: 1,
          slots: [baseSlot({ ruleType: "LSE100", courses: ["LSE100"], units: 0.5 })],
        },
      ],
    });
    const reserved = degreeReservedCodes(p);
    expect(reserved.has("LSE100")).toBe(true);
    expect(reserved.has("LSE100A")).toBe(true);
    expect(reserved.has("LSE100B")).toBe(true);
    expect(reserved.has("LSE100C")).toBe(true);
  });
});

describe("allocateSlots LSE100", () => {
  it("counts a legacy theme code as canonical LSE100", () => {
    const p = prog({
      years: [
        {
          year: 1,
          slots: [baseSlot({ ruleType: "LSE100", courses: ["LSE100"], units: 0.5, order: 1 })],
        },
      ],
    });
    const plan: Plan = {
      years: 3,
      items: [{ code: "LSE100A", year: 1 }],
      exemptions: [],
    };
    const byCode = new Map<string, IndexEntry>([
      [
        "LSE100",
        {
          code: "LSE100",
          title: "The LSE Course",
          department: "LSE",
          prefix: "LSE",
          units: 0.5,
          terms: ["AT", "WT"],
          courseLevel: 1,
          fheqLevel: 4,
          convenors: [],
          assessment: [],
          snippet: "",
        },
      ],
    ]);
    const progress = allocateSlots(p, plan, byCode, new Map());
    expect(progress.get(slotKey(1, 1))?.counted).toEqual(["LSE100"]);
  });
});

describe("activeRouteId", () => {
  it("picks the MA108 or MA100 route from planned codes", () => {
    const slot = baseSlot({
      ruleType: "choose_one_of",
      courses: ["MA108", "EC1B1", "MA100"],
      routes: [
        { id: "ma108", label: "MA108 + EC1B1", courses: ["MA108", "EC1B1"] },
        { id: "ma100", label: "MA100", courses: ["MA100"] },
      ],
    });
    expect(activeRouteId(slot, new Set(["MA108", "EC1B1"]))).toBe("ma108");
    expect(activeRouteId(slot, new Set(["MA100"]))).toBe("ma100");
    expect(activeRouteId(slot, new Set(["EC1P1"]))).toBeNull();
  });
});

describe("shortUnitLabel", () => {
  it("formats half, full, and non-credit units", () => {
    expect(shortUnitLabel(0.5)).toBe("0.5u");
    expect(shortUnitLabel(1)).toBe("1u");
    expect(shortUnitLabel(0)).toBe("non-credit");
    expect(shortUnitLabel(null)).toBeNull();
  });
});

describe("exclusiveChoiceCodes", () => {
  it("lists mutually exclusive codes for flat choose_one_of", () => {
    const slot = baseSlot({
      ruleType: "choose_one_of",
      courses: ["MA100", "MA108"],
    });
    expect(exclusiveChoiceCodes(slot).sort()).toEqual(["MA100", "MA108"]);
  });
});

describe("fitsSlotUnits", () => {
  it("blocks adds that would go past the slot total", () => {
    expect(fitsSlotUnits(1, 0.5, 1)).toBe(false);
    expect(fitsSlotUnits(1, 0.5, 0.5)).toBe(true);
    expect(fitsSlotUnits(1, 0, 1)).toBe(true);
    expect(fitsSlotUnits(1, 1, 0)).toBe(true);
    expect(fitsSlotUnits(null, 2, 1)).toBe(true);
  });
});
