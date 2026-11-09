import { describe, expect, it } from "vitest";
import { isExcludedFromUnits, satisfied, YEAR_MAX_UNITS } from "./plannerLogic";
import type { Req } from "./types";

describe("plannerLogic", () => {
  it("excludes LSE100 from unit totals", () => {
    expect(isExcludedFromUnits("LSE100A")).toBe(true);
    expect(isExcludedFromUnits("SP100")).toBe(false);
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

  it("keeps year unit cap at 4", () => {
    expect(YEAR_MAX_UNITS).toBe(4);
  });
});
