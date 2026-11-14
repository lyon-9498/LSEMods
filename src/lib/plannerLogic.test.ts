import { describe, expect, it } from "vitest";
import {
  degreeCourseCodes,
  isExcludedFromUnits,
  isLSE100Variant,
  satisfied,
  YEAR1_MAX_UNITS,
  YEAR_MAX_UNITS,
  yearSummaries,
  yearUnitCap,
} from "./plannerLogic";
import type { IndexEntry } from "./types";
import type { Programme } from "./programmes";
import type { Req } from "./types";

describe("plannerLogic", () => {
  it("counts LSE100 in Year 1 unit totals", () => {
    expect(isExcludedFromUnits("LSE100")).toBe(false);
    expect(isExcludedFromUnits("LSE100A")).toBe(false);
    expect(isExcludedFromUnits("SP100")).toBe(false);
  });

  it("treats LSE100 and legacy A/B/C as one exclusive family", () => {
    expect(isLSE100Variant("LSE100")).toBe(true);
    expect(isLSE100Variant("LSE100A")).toBe(true);
    expect(isLSE100Variant("LSE100B")).toBe(true);
    expect(isLSE100Variant("LSE100C")).toBe(true);
    expect(isLSE100Variant("SP100")).toBe(false);
  });

  it("includes LSE100 aliases in degreeCourseCodes", () => {
    const prog = {
      optionPool: { compulsory: [], available: [] },
      years: [
        {
          year: 1,
          slots: [{ ruleType: "LSE100", courses: ["LSE100"], order: 1 } as never],
        },
      ],
      lse100Themes: ["LSE100A", "LSE100B"],
    } as unknown as Programme;
    const codes = degreeCourseCodes(prog);
    expect(codes.has("LSE100")).toBe(true);
    expect(codes.has("LSE100A")).toBe(true);
    expect(codes.has("LSE100C")).toBe(true);
  });

  it("checks and/or prerequisite trees", () => {
    const tree: Req = {
      type: "and",
      children: [
        { type: "course", code: "EC2A1" },
        { type: "or", children: [{ type: "course", code: "MA100" }, { type: "course", code: "MA107" }] },
      ],
    };
    expect(satisfied(tree, new Set(["EC2A1", "MA100"]))).toBe(true);
    expect(satisfied(tree, new Set(["EC2A1"]))).toBe(false);
  });

  it("uses 4.5u for Year 1 and 4.0u thereafter", () => {
    expect(YEAR_MAX_UNITS).toBe(4);
    expect(YEAR1_MAX_UNITS).toBe(4.5);
    expect(yearUnitCap(1)).toBe(4.5);
    expect(yearUnitCap(2)).toBe(4);
    expect(yearUnitCap(3)).toBe(4);
  });

  it("does not flag a compulsory-only 4.5u Year 1 as term-unbalanced", () => {
    const entry = (code: string, units: number, terms: string[]): IndexEntry => ({
      code,
      title: code,
      department: null,
      prefix: code.slice(0, 2),
      units,
      terms,
      courseLevel: null,
      fheqLevel: null,
      convenors: [],
      assessment: [],
      snippet: null,
    });
    const full = ["AT", "WT"];
    const byCode = new Map(
      [
        entry("SP100", 1, full),
        entry("SP101", 1, full),
        entry("GV100", 1, full),
        entry("GV101", 1, full),
        entry("LSE100", 0.5, full),
        entry("GV200", 1, full),
        entry("GV201", 1, full),
        entry("GV202", 1, full),
        entry("GV203", 1, full),
        entry("GV210", 0.5, ["AT"]),
      ].map((e) => [e.code, e]),
    );
    const plan = {
      years: 3,
      exemptions: [],
      items: [
        ...["SP100", "SP101", "GV100", "GV101", "LSE100"].map((code) => ({ code, year: 1 })),
        ...["GV200", "GV201", "GV202", "GV203", "GV210"].map((code) => ({ code, year: 2 })),
      ],
    };
    const [y1, y2] = yearSummaries(plan, byCode);
    expect(y1.issues.some((i) => i.text.includes("balanced"))).toBe(false);
    // Year 2: 4.5u with an extra Autumn half unit → Autumn 2.5u is still flagged.
    expect(y2.issues.some((i) => i.text.startsWith("Autumn") && i.text.includes("balanced"))).toBe(
      true,
    );
  });
});
