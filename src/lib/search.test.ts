import { describe, expect, it } from "vitest";
import { prepare, searchCourses } from "./search";
import type { IndexEntry } from "./types";

const sample: IndexEntry[] = [
  {
    code: "SP100",
    title: "Understanding International Social and Public Policy",
    department: "Social Policy",
    prefix: "SP",
    units: 1,
    terms: ["AT", "WT"],
    courseLevel: 1,
    fheqLevel: 4,
    convenors: ["Dr Isabel Shutes"],
    assessment: [{ type: "Exam", weight: 85 }],
    snippet: "intro",
  },
  {
    code: "EC2A1",
    title: "Microeconomics II",
    department: "Economics",
    prefix: "EC",
    units: 1,
    terms: ["AT", "WT", "ST"],
    courseLevel: 2,
    fheqLevel: 5,
    convenors: [],
    assessment: [{ type: "Exam", weight: 70 }],
    snippet: null,
  },
  {
    code: "EC230",
    title: "Economics in Public Policy",
    department: "Economics",
    prefix: "EC",
    units: 1,
    terms: ["AT", "WT", "ST"],
    courseLevel: 2,
    fheqLevel: 5,
    convenors: [],
    assessment: [{ type: "Exam", weight: 50 }],
    snippet: null,
  },
];

describe("searchCourses", () => {
  const prepared = prepare(sample);

  it("lists code prefixes in calendar order", () => {
    const { items, fuzzy } = searchCourses(prepared, "ec2");
    expect(fuzzy).toBe(false);
    expect(items.map((c) => c.code)).toEqual(["EC230", "EC2A1"]);
  });

  it("scores exact code highly", () => {
    const { items } = searchCourses(prepared, "SP100");
    expect(items[0].code).toBe("SP100");
  });

  it("requires every token to match", () => {
    const { items } = searchCourses(prepared, "public policy");
    expect(items.some((c) => c.code === "SP100")).toBe(true);
  });
});
