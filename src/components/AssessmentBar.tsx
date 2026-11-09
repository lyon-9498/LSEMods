import { TriangleAlert } from "lucide-react";
import type { AssessmentItem } from "@/lib/types";
import { assessmentColorClass } from "@/lib/labels";
import { cn } from "@/lib/cn";

export function AssessmentBar({
  items,
  className,
  legendInline,
}: {
  items: AssessmentItem[];
  className?: string;
  legendInline?: boolean;
}) {
  const cleaned = items.filter((i) => i && typeof i.weight === "number" && i.weight > 0);
  const total = cleaned.reduce((s, i) => s + i.weight, 0);
  if (!cleaned.length) return <p className="text-sm text-muted">Assessment not listed</p>;

  const legend = cleaned.map((i) => `${i.type} ${i.weight}%`).join(" · ");

  return (
    <div className={cn("space-y-2", className)}>
      <div
        className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-lilac sm:h-2.5"
        aria-hidden
      >
        {cleaned.map((i, n) => (
          <div
            key={`${i.type}-${n}`}
            className={cn("rounded-full", assessmentColorClass(i.type))}
            style={{ width: `${Math.min(100, (i.weight / Math.max(total, 100)) * 100)}%` }}
          />
        ))}
      </div>
      {legendInline ? (
        <p className="text-xs text-muted tabular">{legend}</p>
      ) : (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
          {cleaned.map((i, n) => (
            <li key={`${i.type}-${n}`} className="inline-flex items-center gap-1.5 tabular">
              <span className={cn("size-2.5 shrink-0 rounded-full", assessmentColorClass(i.type))} aria-hidden />
              {i.type} {i.weight}%
            </li>
          ))}
        </ul>
      )}
      {total !== 100 && total > 0 && (
        <p className="note-needs-checking inline-flex items-start gap-1.5 rounded-[var(--radius-badge)] px-2 py-1.5 text-xs">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Weights sum to {Math.round(total)}% — check the official course guide before relying on this.
        </p>
      )}
    </div>
  );
}
