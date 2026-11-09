import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("importGradesJson", () => {
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

  it("rejects malformed payloads without wiping marks", async () => {
    const { importGradesJson, gradeActions, exportGradesJson } = await import("./gradeStore");
    gradeActions.set("SP100", 71);
    const before = exportGradesJson();
    expect(importGradesJson('{"marks":"nope"}')).toBe(false);
    expect(importGradesJson('{"foo":"bar"}')).toBe(false);
    expect(importGradesJson("not-json")).toBe(false);
    expect(exportGradesJson()).toBe(before);
  });

  it("accepts wrapped marks and plain code maps", async () => {
    const { importGradesJson, exportGradesJson } = await import("./gradeStore");
    expect(importGradesJson(JSON.stringify({ version: 1, marks: { SP100: 70 } }))).toBe(true);
    expect(exportGradesJson()).toContain("SP100");
    expect(importGradesJson(JSON.stringify({ EC100: 65 }))).toBe(true);
    expect(exportGradesJson()).toContain("EC100");
    expect(importGradesJson(JSON.stringify({ version: 1, marks: {} }))).toBe(true);
    expect(JSON.parse(exportGradesJson()).marks).toEqual({});
  });
});
