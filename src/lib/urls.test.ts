import { describe, expect, it } from "vitest";
import { isValidProgrammeId, safeHttpsUrl } from "./urls";

describe("safeHttpsUrl", () => {
  it("allows https LSE hosts", () => {
    expect(safeHttpsUrl("https://www.lse.ac.uk/resources/calendar")).toContain("lse.ac.uk");
    expect(safeHttpsUrl("https://info.lse.ac.uk/staff/divisions")).toContain("info.lse.ac.uk");
  });

  it("rejects non-https, unknown hosts, and junk", () => {
    expect(safeHttpsUrl("http://www.lse.ac.uk/x")).toBeNull();
    expect(safeHttpsUrl("https://evil.example/phish")).toBeNull();
    expect(safeHttpsUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpsUrl(null)).toBeNull();
    expect(safeHttpsUrl("")).toBeNull();
  });
});

describe("isValidProgrammeId", () => {
  it("accepts catalogue-style ids", () => {
    expect(isValidProgrammeId("2026-BScEconomics")).toBe(true);
  });

  it("rejects path traversal and junk", () => {
    expect(isValidProgrammeId("../etc")).toBe(false);
    expect(isValidProgrammeId("2026-BSc/Economics")).toBe(false);
    expect(isValidProgrammeId("short")).toBe(false);
  });
});
