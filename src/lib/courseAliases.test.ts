import { describe, expect, it } from "vitest";
import { canonicalCode, codesMatch } from "./courseAliases";

describe("courseAliases", () => {
  it("maps DS codes to MY", () => {
    expect(canonicalCode("DS202A")).toBe("MY202A");
    expect(canonicalCode("ds105w")).toBe("MY105W");
    expect(canonicalCode("DS205")).toBe("MY205");
  });

  it("matches aliases", () => {
    expect(codesMatch("DS202A", "MY202A")).toBe(true);
    expect(codesMatch("EC1A3", "EC1A3")).toBe(true);
    expect(codesMatch("DS202A", "EC1A3")).toBe(false);
  });

  it("collapses LSE100 themes to LSE100", () => {
    expect(canonicalCode("LSE100A")).toBe("LSE100");
    expect(canonicalCode("lse100b")).toBe("LSE100");
    expect(canonicalCode("LSE100")).toBe("LSE100");
    expect(codesMatch("LSE100C", "LSE100")).toBe(true);
  });
});
