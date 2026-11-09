import { describe, expect, it } from "vitest";
import { isValidCourseCode } from "./async";

describe("isValidCourseCode", () => {
  it("accepts normal LSE codes", () => {
    expect(isValidCourseCode("SP100")).toBe(true);
    expect(isValidCourseCode("EC2A1")).toBe(true);
    expect(isValidCourseCode("lse100a")).toBe(true);
  });

  it("rejects path traversal", () => {
    expect(isValidCourseCode("../etc/passwd")).toBe(false);
    expect(isValidCourseCode("SP100.json")).toBe(false);
  });
});
