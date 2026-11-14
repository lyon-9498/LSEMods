import type { AssessmentItem } from "./types";

/** One structured assessment component for display (from free-text or weights). */
export interface ParsedAssessmentPart {
  label: string;
  weight: number;
  /** Extra inside the weight paren, e.g. "3000 words". */
  detail: string | null;
  durationMinutes: number | null;
  readingMinutes: number | null;
  /** e.g. "January", "Spring" — from "in the X exam period". */
  examPeriod: string | null;
  /** Due / timing after the component, e.g. "May", "Spring Term Week 2". */
  due: string | null;
}

export interface ParsedAssessment {
  parts: ParsedAssessmentPart[];
  /** Leftover prose not captured as structured fields. */
  notes: string | null;
}

/** Component head: "Exam (100%)" / "Essay (80%, 3000 words)". */
const COMPONENT_RE =
  /([A-Z][A-Za-z0-9\-/ ]{0,60}?)\s*\((\d{1,3})\s*%([^)]*)\)/g;

/**
 * Meta that often trails an exam clause:
 * ", duration: 120 minutes, reading time: 15 minutes in the January exam period"
 * or coursework due: " in May" / " in Spring Term Week 2"
 */
const TRAILING_META_RE =
  /^(?:,?\s*duration:\s*(\d+)\s*minutes?)?(?:,?\s*reading time:\s*(\d+)\s*minutes?)?(?:\s+in the\s+([A-Za-z]+)\s+exam period)?(?:\s+in\s+((?:Autumn|Winter|Spring|Summer)\s+Term(?:\s+Week\s+\d+)?|[A-Z][a-z]+))?/i;

function displayLabel(raw: string): string {
  const t = raw.trim().replace(/\s+/g, " ");
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

function parenDetail(raw: string): string | null {
  const t = raw.replace(/^,\s*/, "").trim();
  return t || null;
}

function emptyPart(label: string, weight: number): ParsedAssessmentPart {
  return {
    label,
    weight,
    detail: null,
    durationMinutes: null,
    readingMinutes: null,
    examPeriod: null,
    due: null,
  };
}

/**
 * Parse duration / reading / exam period from a free-text fragment
 * (AssessmentItem.type or a clause).
 */
export function parseAssessmentMeta(fragment: string): Pick<
  ParsedAssessmentPart,
  "durationMinutes" | "readingMinutes" | "examPeriod" | "due"
> {
  const m = fragment.match(TRAILING_META_RE);
  if (!m) {
    return {
      durationMinutes: null,
      readingMinutes: null,
      examPeriod: null,
      due: null,
    };
  }
  return {
    durationMinutes: m[1] ? Number(m[1]) : null,
    readingMinutes: m[2] ? Number(m[2]) : null,
    examPeriod: m[3] ? m[3].charAt(0).toUpperCase() + m[3].slice(1).toLowerCase() : null,
    due: m[4]?.trim() || null,
  };
}

/**
 * Parse LSE Calendar assessment free-text into structured parts.
 * Display-only — does not change scraped JSON.
 */
export function parseAssessmentText(text: string | null | undefined): ParsedAssessment {
  if (!text?.trim()) return { parts: [], notes: null };

  const source = text.replace(/\s+/g, " ").trim();
  const parts: ParsedAssessmentPart[] = [];
  const consumed: Array<{ start: number; end: number }> = [];

  const matches = [...source.matchAll(COMPONENT_RE)];
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const start = match.index ?? 0;
    const endOfParen = start + match[0].length;
    const nextStart = i + 1 < matches.length ? (matches[i + 1].index ?? source.length) : source.length;
    const between = source.slice(endOfParen, nextStart);

    const metaMatch = between.match(TRAILING_META_RE);
    const metaLen = metaMatch?.[0]?.length ?? 0;
    const meta = parseAssessmentMeta(between);

    parts.push({
      label: displayLabel(match[1]),
      weight: Number(match[2]),
      detail: parenDetail(match[3] ?? ""),
      ...meta,
    });
    consumed.push({ start, end: endOfParen + metaLen });
  }

  let notes = source;
  for (let i = consumed.length - 1; i >= 0; i--) {
    const { start, end } = consumed[i];
    notes = notes.slice(0, start) + notes.slice(end);
  }
  notes = notes
    .replace(/^[.\s,;:]+/, "")
    .replace(/[.\s,;:]+$/, "")
    .replace(/\s+/g, " ")
    .trim();

  // Drop leftover that is only punctuation / tiny scraps.
  if (notes.length < 12) notes = "";

  return { parts, notes: notes || null };
}

/**
 * Prefer free-text structure; fall back to weight items (optionally enriching
 * from type strings that embed duration/reading/period).
 */
export function parseAssessmentDisplay(
  text: string | null | undefined,
  items?: AssessmentItem[],
): ParsedAssessment {
  const fromText = parseAssessmentText(text);
  if (fromText.parts.length) return fromText;

  const cleaned = (items ?? []).filter((i) => i && typeof i.weight === "number" && i.weight > 0);
  if (!cleaned.length) return { parts: [], notes: fromText.notes };

  return {
    parts: cleaned.map((i) => {
      const type = i.type ?? "";
      // If type is a run-on ("Exam (100%), duration: …"), parse it.
      const nested = parseAssessmentText(type);
      if (nested.parts.length === 1) return nested.parts[0];
      if (nested.parts.length > 1) return nested.parts[0];

      const meta = parseAssessmentMeta(type);
      const labelMatch = type.match(/^([^,(]+)/);
      const rawLabel = (labelMatch?.[1] ?? type).trim() || "Assessment";
      return {
        ...emptyPart(displayLabel(rawLabel), i.weight),
        ...meta,
      };
    }),
    notes: fromText.notes,
  };
}

export function formatMinutes(mins: number): string {
  return `${mins} min`;
}

export function formatExamPeriodLabel(period: string): string {
  return `${period} exam period`;
}

/** True when a part has any meta beyond label + weight. */
export function hasAssessmentMeta(part: ParsedAssessmentPart): boolean {
  return Boolean(
    part.detail ||
      part.durationMinutes != null ||
      part.readingMinutes != null ||
      part.examPeriod ||
      part.due,
  );
}
