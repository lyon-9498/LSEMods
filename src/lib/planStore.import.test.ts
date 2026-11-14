import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * importPlanJson must reject malformed JSON instead of wiping a saved plan.
 * Uses a fresh module instance + stubbed localStorage per test.
 */
describe("importPlanJson", () => {
  beforeEach(() => {
    vi.resetModules();
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
        removeItem: (k: string) => {
          store.delete(k);
        },
      },
      addEventListener: () => {},
    });
    vi.stubGlobal("localStorage", (window as unknown as { localStorage: Storage }).localStorage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects payloads without a valid items array and leaves the in-memory plan unchanged", async () => {
    const { importPlanJson, planActions, exportPlanJson } = await import("./planStore");
    planActions.add("SP100", 1);
    const before = exportPlanJson();
    expect(importPlanJson('{"items":"nope"}')).toBe(false);
    expect(importPlanJson('{"foo":1}')).toBe(false);
    expect(importPlanJson("not-json")).toBe(false);
    expect(exportPlanJson()).toBe(before);
  });

  it("accepts an intentional empty plan and a populated plan", async () => {
    const { importPlanJson, exportPlanJson, planActions } = await import("./planStore");
    expect(importPlanJson(JSON.stringify({ years: 3, items: [], exemptions: [] }))).toBe(true);
    planActions.add("EC100", 1);
    const raw = exportPlanJson();
    expect(importPlanJson(raw)).toBe(true);
    expect(exportPlanJson()).toContain("EC100");
  });

  it("collapses legacy LSE100A/B/C to a single LSE100 on import", async () => {
    const { importPlanJson, exportPlanJson } = await import("./planStore");
    expect(
      importPlanJson(
        JSON.stringify({
          years: 3,
          items: [
            { code: "LSE100A", year: 1 },
            { code: "LSE100B", year: 1 },
            { code: "SP100", year: 1 },
          ],
          exemptions: [],
        }),
      ),
    ).toBe(true);
    const parsed = JSON.parse(exportPlanJson()) as { items: { code: string }[] };
    expect(parsed.items.map((i) => i.code).sort()).toEqual(["LSE100", "SP100"]);
  });

  it("stores LSE100 when adding a legacy theme code", async () => {
    const { planActions, exportPlanJson, importPlanJson } = await import("./planStore");
    expect(importPlanJson(JSON.stringify({ years: 3, items: [], exemptions: [] }))).toBe(true);
    planActions.add("LSE100C", 1);
    planActions.add("LSE100A", 1);
    const parsed = JSON.parse(exportPlanJson()) as { items: { code: string }[] };
    expect(parsed.items).toEqual([{ code: "LSE100", year: 1 }]);
  });

  it("rewrites localStorage when hydrate finds legacy LSE100 themes", async () => {
    localStorage.setItem(
      "lsemods-plan-v1",
      JSON.stringify({
        years: 3,
        items: [{ code: "LSE100A", year: 1 }],
        exemptions: [],
      }),
    );
    const { planActions, exportPlanJson, PLAN_KEY } = await import("./planStore");
    planActions.setYears(3);
    expect(JSON.parse(localStorage.getItem(PLAN_KEY)!).items[0].code).toBe("LSE100");
    expect(exportPlanJson()).toContain('"LSE100"');
    expect(exportPlanJson()).not.toContain("LSE100A");
  });
});
