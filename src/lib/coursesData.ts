/** Course details for the builder — sourced from public/data/courses.csv */

import { canonicalCode, codeAliases } from "./courseAliases";

export interface CourseMeta {
  code: string;
  title: string;
  department: string | null;
  units: number | null;
  terms: string[];
  courseLevel: number | null;
  convenors: string[];
  outsideOptionStatus: string | null;
  capped: string | null;
  assessmentComponents: string | null;
  assessmentTotal: number | null;
  assessmentOk: boolean;
  sourceUrl: string | null;
}

let cache: Promise<Map<string, CourseMeta>> | null = null;

/** Minimal RFC4180-ish CSV parse (handles quotes and commas). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let i = 0;
  let inQuotes = false;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cell += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      i++;
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((c) => c.length > 0) || row.length > 1) rows.push(row);
      row = [];
      i++;
      continue;
    }
    cell += ch;
    i++;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function rowToMeta(header: string[], values: string[]): CourseMeta | null {
  const get = (key: string) => {
    const idx = header.indexOf(key);
    return idx >= 0 ? (values[idx] ?? "").trim() : "";
  };
  const code = get("code").toUpperCase();
  if (!code) return null;
  const unitsRaw = get("units");
  const levelRaw = get("course_level");
  const totalRaw = get("assessment_total");
  return {
    code,
    title: get("title"),
    department: get("department") || null,
    units: unitsRaw ? Number(unitsRaw) : null,
    terms: get("terms")
      .split(";")
      .map((t) => t.trim())
      .filter(Boolean),
    courseLevel: levelRaw ? Number(levelRaw) : null,
    convenors: get("convenors")
      .split(";")
      .map((c) => c.trim())
      .filter(Boolean),
    outsideOptionStatus: get("outside_option_status") || null,
    capped: get("capped") || null,
    assessmentComponents: get("assessment_components") || null,
    assessmentTotal: totalRaw ? Number(totalRaw) : null,
    assessmentOk: get("assessment_ok").toUpperCase() === "TRUE",
    sourceUrl: get("source_url") || null,
  };
}

export function loadCoursesMeta(): Promise<Map<string, CourseMeta>> {
  if (!cache) {
    cache = fetch("/data/courses.csv")
      .then((r) => {
        if (!r.ok) throw new Error(`courses.csv: ${r.status}`);
        return r.text();
      })
      .then((text) => {
        const rows = parseCsv(text);
        if (rows.length < 2) return new Map<string, CourseMeta>();
        const header = rows[0].map((h) => h.trim());
        const map = new Map<string, CourseMeta>();
        for (const values of rows.slice(1)) {
          const meta = rowToMeta(header, values);
          if (!meta) continue;
          map.set(meta.code, meta);
          // Also index under aliases so DS* lookups hit MY*
          for (const alias of codeAliases(meta.code)) {
            if (!map.has(alias)) map.set(alias, meta);
          }
        }
        return map;
      });
  }
  return cache;
}

export function getCourseMeta(
  map: Map<string, CourseMeta>,
  code: string,
): CourseMeta | undefined {
  return map.get(canonicalCode(code)) ?? map.get(code.toUpperCase());
}

/** Freely / permission outside options usable in a given year of study. */
export function outsideEligible(
  map: Map<string, CourseMeta>,
  year: number,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const meta of map.values()) {
    if (seen.has(meta.code)) continue;
    seen.add(meta.code);
    const status = (meta.outsideOptionStatus ?? "").toLowerCase();
    if (!status.includes("available")) continue;
    if (status.includes("not available") || status === "closed") continue;
    if (meta.courseLevel != null && meta.courseLevel > year) continue;
    out.push(meta.code);
  }
  return out.sort();
}
