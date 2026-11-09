import { describe, expect, it } from "vitest";
import {
  THREE_YEAR,
  FOUR_YEAR,
  analyse,
  classify,
  firstYearAverage,
  marksFor,
  parseMarkInput,
  schemeForYears,
  type GradeCourse,
} from "./gradeLogic";

const course = (
  code: string,
  year: number,
  units: number,
  mark: number | null,
): GradeCourse => ({ code, year, units, mark });

describe("marksFor / FYA", () => {
  it("maps full unit to 2 marks and half to 1", () => {
    expect(marksFor(1)).toBe(2);
    expect(marksFor(0.5)).toBe(1);
    expect(marksFor(null)).toBe(0);
  });

  it("averages best six of nine", () => {
    expect(firstYearAverage([70, 70, 70, 70, 70, 70, 40, 40, 40])).toBe(70);
    expect(firstYearAverage([71, 70, 69, 68, 67, 66, 50, 40, 30])).toBe(69);
  });
});

describe("classify three-year", () => {
  it("awards First with 10 firsts", () => {
    const marks = Array(10).fill(70).concat(Array(8).fill(60));
    expect(classify(THREE_YEAR, marks, 0).cls).toBe("First");
  });

  it("awards First with 8 firsts and aggregate ≥ 1180", () => {
    const marks = [...Array(8).fill(70), ...Array(10).fill(62)];
    // 8*70 + 10*62 = 560 + 620 = 1180
    expect(marks.reduce((s, m) => s + m, 0)).toBe(1180);
    expect(classify(THREE_YEAR, marks, 0).cls).toBe("First");
  });

  it("awards 2:1 with 10 marks ≥ 60", () => {
    const marks = Array(10).fill(60).concat(Array(8).fill(50));
    expect(classify(THREE_YEAR, marks, 0).cls).toBe("2:1");
  });

  it("drops one class for >1 failed unit", () => {
    const marks = Array(10).fill(70).concat(Array(8).fill(60));
    expect(classify(THREE_YEAR, marks, 1.5).cls).toBe("2:1");
  });

  it("caps at Pass for ≥3 failed units", () => {
    const marks = Array(10).fill(70).concat(Array(8).fill(60));
    expect(classify(THREE_YEAR, marks, 3).cls).toBe("Pass");
  });
});

describe("classify four-year", () => {
  it("awards First with 14 firsts", () => {
    const marks = Array(14).fill(70).concat(Array(12).fill(60));
    expect(classify(FOUR_YEAR, marks, 0).cls).toBe("First");
  });

  it("uses four-year aggregate threshold 1700", () => {
    const marks = [...Array(12).fill(70), ...Array(14).fill(62)];
    // 12*70 + 14*62 = 840 + 868 = 1708
    expect(classify(FOUR_YEAR, marks, 0).cls).toBe("First");
  });
});

describe("analyse targets", () => {
  it("reports remaining and First route when empty later years", () => {
    const courses: GradeCourse[] = [
      course("SP100", 1, 1, 65),
      course("SP101", 1, 1, 65),
      course("SP102", 1, 1, 65),
      course("SP103", 1, 1, 65),
      course("LSE100A", 1, 0.5, 70),
    ];
    const a = analyse(THREE_YEAR, courses);
    expect(a.fya).toBe(66);
    expect(a.remaining).toBe(16);
    const first = a.targets.find((t) => t.cls === "First")!;
    expect(first.status).toBe("possible");
    expect(first.routeMarks).toBe(10);
    const third = a.targets.find((t) => t.cls === "Third")!;
    expect(third.status).toBe("possible");
    expect(third.routeMarks).toBe(14); // 2 FYA marks already ≥40; need 16 total
    expect(a.targets.find((t) => t.cls === "Pass")?.status).toBe("possible");
    expect(a.targets.find((t) => t.cls === "Fail")?.note).toMatch(/not eligible/i);
  });

  it("marks First secured when enough later firsts + FYA", () => {
    const y1: GradeCourse[] = [
      course("A1", 1, 1, 70),
      course("A2", 1, 1, 70),
      course("A3", 1, 1, 70),
      course("A4", 1, 1, 70),
      course("LSE100A", 1, 0.5, 70),
    ];
    const later: GradeCourse[] = [];
    for (let i = 0; i < 8; i++) {
      later.push(course(`Y2${i}`, 2 + (i >= 4 ? 1 : 0), 1, 70));
    }
    const a = analyse(THREE_YEAR, [...y1, ...later]);
    expect(a.final?.cls).toBe("First");
    expect(a.targets.find((t) => t.cls === "First")?.status).toBe("secured");
    expect(a.targets.find((t) => t.cls === "Third")?.status).toBe("secured");
    expect(a.targets.find((t) => t.cls === "Pass")?.status).toBe("out_of_reach");
    expect(a.targets.find((t) => t.cls === "Fail")?.status).toBe("out_of_reach");
  });
});

describe("schemeForYears / parseMarkInput", () => {
  it("picks schemes by plan length", () => {
    expect(schemeForYears(3)).toBe(THREE_YEAR);
    expect(schemeForYears(4)).toBe(FOUR_YEAR);
  });

  it("parses marks", () => {
    expect(parseMarkInput("")).toBeNull();
    expect(parseMarkInput("71.5")).toBe(71.5);
    expect(parseMarkInput("101")).toBeNull();
  });
});
