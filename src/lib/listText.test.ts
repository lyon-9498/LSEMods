import { describe, expect, it } from "vitest";
import { isMeaningfulListText } from "./listText";

describe("isMeaningfulListText", () => {
  it("rejects scraper punctuation leftovers", () => {
    for (const junk of ["", " ", ";", ".", ",", "|", ":", "(", ")", ").", "&", ");", "…", "—"]) {
      expect(isMeaningfulListText(junk)).toBe(false);
    }
  });

  it("rejects nullish and whitespace-only", () => {
    expect(isMeaningfulListText(null)).toBe(false);
    expect(isMeaningfulListText(undefined)).toBe(false);
    expect(isMeaningfulListText("\t\n")).toBe(false);
  });

  it("keeps real reading / skill text", () => {
    expect(isMeaningfulListText("Smith, J. (2020) Title.")).toBe(true);
    expect(isMeaningfulListText("Critical thinking")).toBe(true);
    expect(isMeaningfulListText("SP100")).toBe(true);
  });
});
