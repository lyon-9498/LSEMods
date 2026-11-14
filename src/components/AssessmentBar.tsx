import { TriangleAlert } from "lucide-react";
import type { AssessmentItem } from "@/lib/types";
import { assessmentColorClass } from "@/lib/labels";
import { cn } from "@/lib/cn";

export function AssessmentBar({
  items,
  className,
  legendInline,
  needsChecking,
}: {
  items: AssessmentItem[];
  className?: string;
  legendInline?: boolean;
  /** From courses.csv assessment_ok=FALSE or slot UNVERIFIED/issue */
  needsChecking?: boolean;
}) {
  const cleaned = items.filter((i) => i && typeof i.weight === "number" && i.weight > 0);
  const total = cleaned.reduce((s, i) => s + i.weight, 0);
  const totalOk = Math.abs(total - 100) < 0.05;
  if (!cleaned.length) {
    return needsChecking ? (
      <p className="note-needs-checking inline-flex items-start gap-1.5 rounded-[var(--radius-badge)] px-2 py-1.5 text-xs">
        <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Assessment needs checking against the official course guide.
      </p>
    ) : (
      <p className="text-sm text-muted">Assessment not listed</p>
    );
  }

  const legendItems = cleaned.map((i, n) => (
    <li
      key={`${i.type}-${n}`}
      className={cn(
        "inline-flex items-center gap-1.5 tabular",
        legendInline
          ? "rounded-[var(--radius-chip)] bg-lilac-deep px-2.5 py-1 text-xs font-medium text-text-2"
          : "text-xs text-muted",
      )}
    >
      <span className={cn("size-2.5 shrink-0 rounded-full", assessmentColorClass(i.type))} aria-hidden />
      <span>
        {i.type}{" "}
        <span className={legendInline ? "font-data font-bold text-indigo" : "font-data"}>{i.weight}%</span>
      </span>
    </li>
  ));

  return (
    <div className={cn("space-y-2", className)}>
      <div
        className="flex h-3.5 gap-0.5 overflow-hidden rounded-full bg-lilac sm:h-3"
        role="img"
        aria-label={cleaned.map((i) => `${i.type} ${i.weight}%`).join(", ")}
      >
        {cleaned.map((i, n) => (
          <div
            key={`${i.type}-${n}`}
            className={cn("rounded-full", assessmentColorClass(i.type))}
            style={{ width: `${Math.min(100, (i.weight / Math.max(total, 100)) * 100)}%` }}
          />
        ))}
      </div>
      <ul
        className={cn(
          "flex flex-wrap",
          legendInline ? "gap-1.5" : "gap-x-3 gap-y-1",
        )}
      >
        {legendItems}
      </ul>
      {(needsChecking || (!totalOk && total > 0)) && (
        <p className="note-needs-checking inline-flex items-start gap-1.5 rounded-[var(--radius-badge)] px-2 py-1.5 text-xs">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {!totalOk && total > 0
            ? `Weights sum to ${Math.round(total)}% — check the official course guide before relying on this.`
            : "Assessment needs checking against the official course guide."}
        </p>
      )}
    </div>
  );
}
