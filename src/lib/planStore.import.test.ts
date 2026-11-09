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
});
