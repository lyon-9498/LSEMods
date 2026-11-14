"use client";

import { useEffect, useState } from "react";
import { getCourseMeta, loadCoursesMeta } from "@/lib/coursesData";
import type { AssessmentItem } from "@/lib/types";
import { AssessmentBar } from "./AssessmentBar";

/** Assessment bar that also reads assessment_ok from courses.csv. */
export function AssessmentOkBar({
  code,
  items,
  legendInline,
}: {
  code: string;
  items: AssessmentItem[];
  legendInline?: boolean;
}) {
  const [needsChecking, setNeedsChecking] = useState(false);

  useEffect(() => {
    let alive = true;
    loadCoursesMeta()
      .then((map) => {
        if (!alive) return;
        const meta = getCourseMeta(map, code);
        setNeedsChecking(meta ? meta.assessmentOk === false : false);
      })
      .catch(() => {
        if (alive) setNeedsChecking(false);
      });
    return () => {
      alive = false;
    };
  }, [code]);

  return <AssessmentBar items={items} legendInline={legendInline} needsChecking={needsChecking} />;
}
