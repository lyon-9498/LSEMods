import type { AssessmentItem } from "@/lib/types";
import {
  formatExamPeriodLabel,
  formatMinutes,
  hasAssessmentMeta,
  parseAssessmentDisplay,
  type ParsedAssessmentPart,
} from "@/lib/assessmentDisplay";
import { assessmentColorClass } from "@/lib/labels";
import { cn } from "@/lib/cn";
import { AssessmentOkBar } from "./AssessmentOkBar";

function MetaChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex min-h-8 items-center rounded-[var(--radius-chip)] bg-lilac-deep px-2.5 text-xs font-medium text-text-2 tabular">
      {children}
    </span>
  );
}

function AssessmentPartRow({ part }: { part: ParsedAssessmentPart }) {
  const meta = hasAssessmentMeta(part);
  return (
    <li className="rounded-[var(--radius-inner)] border border-line bg-lilac-deep/40 px-3 py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="inline-flex min-w-0 items-center gap-2">
          <span
            className={cn("size-2.5 shrink-0 rounded-full", assessmentColorClass(part.label))}
            aria-hidden
          />
          <span className="font-medium text-night">{part.label}</span>
        </div>
        <span className="font-data text-sm font-bold tabular text-indigo">{part.weight}%</span>
      </div>
      {meta ? (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={`${part.label} details`}>
          {part.detail ? <li><MetaChip>{part.detail}</MetaChip></li> : null}
          {part.durationMinutes != null ? (
            <li>
              <MetaChip>Duration {formatMinutes(part.durationMinutes)}</MetaChip>
            </li>
          ) : null}
          {part.readingMinutes != null ? (
            <li>
              <MetaChip>Reading {formatMinutes(part.readingMinutes)}</MetaChip>
            </li>
          ) : null}
          {part.examPeriod ? (
            <li>
              <MetaChip>{formatExamPeriodLabel(part.examPeriod)}</MetaChip>
            </li>
          ) : null}
          {part.due ? (
            <li>
              <MetaChip>Due {part.due}</MetaChip>
            </li>
          ) : null}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * Structured assessment panel: weight bar + legend, then parsed rows/chips
 * from Calendar free-text (duration, reading time, exam period, due).
 */
export function AssessmentDetails({
  code,
  text,
  items,
  className,
}: {
  code: string;
  text?: string | null;
  items: AssessmentItem[];
  className?: string;
}) {
  const parsed = parseAssessmentDisplay(text, items);
  // Only expand rows when free-text yields meta (duration, reading, period, due, words).
  // Otherwise the bar legend already covers type + weight.
  const showStructured = parsed.parts.some(hasAssessmentMeta);

  return (
    <div className={cn("space-y-3", className)}>
      <AssessmentOkBar code={code} items={items} />
      {showStructured ? (
        <ul className="space-y-2">
          {parsed.parts.map((part, i) => (
            <AssessmentPartRow key={`${part.label}-${part.weight}-${i}`} part={part} />
          ))}
        </ul>
      ) : null}
      {parsed.notes ? (
        <p className="text-sm leading-relaxed text-muted">{parsed.notes}</p>
      ) : null}
    </div>
  );
}
