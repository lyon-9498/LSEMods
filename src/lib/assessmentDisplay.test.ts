import { describe, expect, it } from "vitest";
import {
  hasAssessmentMeta,
  parseAssessmentDisplay,
  parseAssessmentMeta,
  parseAssessmentText,
} from "./assessmentDisplay";

describe("parseAssessmentText", () => {
  it("splits exam duration, reading time, and period into fields", () => {
    const parsed = parseAssessmentText(
      "Exam (100%), duration: 120 minutes, reading time: 15 minutes in the January exam period.",
    );
    expect(parsed.parts).toHaveLength(1);
    expect(parsed.parts[0]).toMatchObject({
      label: "Exam",
      weight: 100,
      durationMinutes: 120,
      readingMinutes: 15,
      examPeriod: "January",
      detail: null,
      due: null,
    });
    expect(parsed.notes).toBeNull();
  });

  it("handles mixed exam + coursework with due timing", () => {
    const parsed = parseAssessmentText(
      "Exam (70%), duration: 130 minutes, reading time: 10 minutes in the January exam period. Project (30%). Students will work on the project during the last few weeks of AT and submit after the end of term.",
    );
    expect(parsed.parts).toEqual([
      expect.objectContaining({
        label: "Exam",
        weight: 70,
        durationMinutes: 130,
        readingMinutes: 10,
        examPeriod: "January",
      }),
      expect.objectContaining({
        label: "Project",
        weight: 30,
        durationMinutes: null,
        readingMinutes: null,
        examPeriod: null,
      }),
    ]);
    expect(parsed.notes).toMatch(/Students will work on the project/i);
  });

  it("keeps word-count detail and due month", () => {
    const parsed = parseAssessmentText("Essay (80%, 3000 words) in May.");
    expect(parsed.parts[0]).toMatchObject({
      label: "Essay",
      weight: 80,
      detail: "3000 words",
      due: "May",
    });
  });

  it("parses term-week due timing", () => {
    const parsed = parseAssessmentText(
      "Problem sets (10%) in Winter Term Week 11. Exam (90%), duration: 180 minutes in the January exam period.",
    );
    expect(parsed.parts[0]).toMatchObject({
      label: "Problem sets",
      weight: 10,
      due: "Winter Term Week 11",
    });
    expect(parsed.parts[1]).toMatchObject({
      label: "Exam",
      weight: 90,
      durationMinutes: 180,
      examPeriod: "January",
      readingMinutes: null,
    });
  });

  it("returns empty parts for blank input", () => {
    expect(parseAssessmentText(null)).toEqual({ parts: [], notes: null });
    expect(parseAssessmentText("   ")).toEqual({ parts: [], notes: null });
  });
});

describe("parseAssessmentMeta", () => {
  it("reads duration and period from a fragment", () => {
    expect(
      parseAssessmentMeta(", duration: 180 Minutes in the Spring exam period"),
    ).toEqual({
      durationMinutes: 180,
      readingMinutes: null,
      examPeriod: "Spring",
      due: null,
    });
  });
});

describe("parseAssessmentDisplay", () => {
  it("falls back to weight items when free-text is missing", () => {
    const parsed = parseAssessmentDisplay(null, [
      { type: "Exam", weight: 70 },
      { type: "Essay", weight: 30 },
    ]);
    expect(parsed.parts).toEqual([
      expect.objectContaining({ label: "Exam", weight: 70 }),
      expect.objectContaining({ label: "Essay", weight: 30 }),
    ]);
  });

  it("enriches from a run-on type string on an item", () => {
    const parsed = parseAssessmentDisplay(null, [
      {
        type: "Exam (100%), duration: 120 minutes, reading time: 15 minutes in the January exam period",
        weight: 100,
      },
    ]);
    expect(parsed.parts[0]).toMatchObject({
      label: "Exam",
      weight: 100,
      durationMinutes: 120,
      readingMinutes: 15,
      examPeriod: "January",
    });
    expect(hasAssessmentMeta(parsed.parts[0])).toBe(true);
  });
});
