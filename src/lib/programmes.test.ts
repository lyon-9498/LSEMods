import { describe, expect, it } from "vitest";
import {
  parseCrossYearSpec,
  programmeAcronym,
  programmeMatchesQuery,
} from "./programmes";

describe("parseCrossYearSpec", () => {
  it("parses ranges, lists, and or-forms", () => {
    expect(parseCrossYearSpec("2-3")).toEqual([2, 3]);
    expect(parseCrossYearSpec("1,2,4")).toEqual([1, 2, 4]);
    expect(parseCrossYearSpec("2 or 3")).toEqual([2, 3]);
  });
});

describe("programmeAcronym", () => {
  it("builds ISPP-style initials", () => {
    expect(programmeAcronym("BSc International Social and Public Policy")).toBe("ISPP");
    expect(programmeAcronym("BSc Philosophy, Politics and Economics")).toBe("PPE");
    expect(programmeAcronym("BSc Econometrics and Mathematical Economics")).toBe("EME");
  });
});

describe("programmeMatchesQuery", () => {
  const ispp = {
    id: "bsc-international-social-and-public-policy-with-politics",
    name: "BSc International Social and Public Policy with Politics",
    degree: "BSc",
    ucasCode: "LL42",
  };

  it("matches acronym, title fragment, and slug tokens", () => {
    expect(programmeMatchesQuery(ispp, "ISPP")).toBe(true);
    expect(programmeMatchesQuery(ispp, "international")).toBe(true);
    expect(programmeMatchesQuery(ispp, "public policy")).toBe(true);
    expect(programmeMatchesQuery(ispp, "politics")).toBe(true);
    expect(programmeMatchesQuery(ispp, "zzzz")).toBe(false);
  });
});
