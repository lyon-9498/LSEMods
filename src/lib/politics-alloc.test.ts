import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import {
  allocateSlots,
  isInactiveOutsideSlot,
  lockedAutoFillEntries,
  slotAllowedCodes,
  slotStatusLabel,
} from "./degreeLogic";
import { canonicalCode } from "./courseAliases";
import { yearSummaries } from "./plannerLogic";
import type { Programme } from "./programmes";
import type { Plan } from "./planStore";
import type { IndexEntry } from "./types";

describe("bsc-politics", () => {
  it("does not throw allocating slots or year summaries", () => {
    const programmes = JSON.parse(readFileSync("./public/data/programmes.json", "utf8")) as Programme[];
    const index = JSON.parse(readFileSync("./public/data/index.json", "utf8")) as IndexEntry[];
    const byCode = new Map(index.map((c) => [c.code, c]));
    const prog = programmes.find((p) => p.id === "bsc-politics")!;
    expect(prog).toBeTruthy();
    const known = (c: string) => byCode.has(canonicalCode(c));
    const fill = lockedAutoFillEntries(prog, known);
    const plan: Plan = {
      years: 3,
      items: fill.map((e) => ({ code: e.code, year: e.year, paper: e.paper })),
      exemptions: [],
      programme: "bsc-politics",
    };
    expect(() => allocateSlots(prog, plan, byCode, new Map())).not.toThrow();
    expect(() => yearSummaries(plan, byCode)).not.toThrow();
    const years = yearSummaries(plan, byCode);
    expect(years[0]?.excluded).toEqual([]);
    expect(years[0]?.maxUnits).toBe(4.5);
    // Locked fill alone is under 4.5 (options remain); LSE100’s 0.5 must be in the total.
    expect(years[0]?.codes).toContain("LSE100");
    expect(years[0]?.units).toBeGreaterThanOrEqual(0.5);
    for (const y of prog.years) {
      for (const s of y.slots) {
        if (isInactiveOutsideSlot(s)) continue;
        expect(() => slotAllowedCodes(s, prog, y.year, new Map())).not.toThrow();
        expect(() => slotStatusLabel(s, [], new Map(), y.year)).not.toThrow();
      }
    }
  });
});
