"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { codesMatch } from "@/lib/courseAliases";
import type { IndexEntry } from "@/lib/types";
import { termChipClass, termLabel, unitLabel } from "@/lib/labels";
import { usePlan } from "@/lib/planStore";
import { AssessmentOkBar } from "./AssessmentOkBar";

export function CourseCard({ course }: { course: IndexEntry }) {
  const plan = usePlan();
  const inPlan = plan.items.some((i) => codesMatch(i.code, course.code));

  return (
    <Link
      href={`/courses/${course.code}`}
      className="card-hover block rounded-[var(--radius)] border border-line bg-surface p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="chip-code px-2 py-0.5 text-xs tabular">{course.code}</span>
        <span className="chip-unit px-2.5 py-0.5 text-xs font-medium">{unitLabel(course.units)}</span>
        {course.terms.map((t) => (
          <span key={t} className={`px-2.5 py-0.5 text-xs font-medium ${termChipClass(t)}`}>
            {termLabel(t)}
          </span>
        ))}
        {inPlan && (
          <span className="chip-in-plan ml-auto inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold">
            <Check className="size-3" aria-hidden />
            In your plan
          </span>
        )}
      </div>
      <h2 className="mt-3 font-display text-lg font-bold tracking-tight text-night sm:text-xl">
        {course.title}
      </h2>
      <p className="mt-1 text-sm text-muted">
        {course.department ?? "Department unknown"}
        {course.convenors?.[0] ? ` · ${course.convenors[0]}` : ""}
      </p>
      <div className="mt-4">
        <AssessmentOkBar code={course.code} items={course.assessment} legendInline />
      </div>
    </Link>
  );
}
