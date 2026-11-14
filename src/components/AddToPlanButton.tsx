"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { NonCreditCourseDialog } from "@/components/NonCreditCourseDialog";
import { codesMatch } from "@/lib/courseAliases";
import { isNonCreditUnits } from "@/lib/labels";
import { planActions, usePlan, onPlanPersistError } from "@/lib/planStore";
import { cn } from "@/lib/cn";

export function AddToPlanButton({
  code,
  units,
  title,
  className,
  sticky,
}: {
  code: string;
  units?: number | null;
  title?: string;
  className?: string;
  sticky?: boolean;
}) {
  const plan = usePlan();
  const inPlan = plan.items.some((i) => codesMatch(i.code, code));
  const year = plan.items.find((i) => codesMatch(i.code, code))?.year;
  const [nonCreditOpen, setNonCreditOpen] = useState(false);

  useEffect(() => {
    return onPlanPersistError((err) => {
      if (err) toast.warning(err);
    });
  }, []);

  const add = () => {
    planActions.add(code, 1);
    toast.success(`Added ${code} to Year 1`);
    setNonCreditOpen(false);
  };

  return (
    <>
      <button
        type="button"
        className={cn(
          "inline-flex min-h-12 items-center justify-center gap-2 px-6 py-3 transition",
          inPlan ? "btn-ghost border-status-plan-border bg-status-plan-bg text-status-plan-text" : "btn-primary",
          sticky &&
            "fixed inset-x-4 z-30 bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] shadow-lg lg:static lg:inset-auto lg:z-auto lg:shadow-none",
          className,
        )}
        onClick={() => {
          if (inPlan) {
            planActions.remove(code);
            toast.message(`Removed ${code} from plan`);
            return;
          }
          if (isNonCreditUnits(units)) {
            setNonCreditOpen(true);
            return;
          }
          add();
        }}
      >
        {inPlan ? (
          <>
            <Check className="size-4" aria-hidden />
            In your plan{year ? ` — Year ${year}` : ""}
          </>
        ) : (
          "Add to Plan"
        )}
      </button>
      {nonCreditOpen && (
        <NonCreditCourseDialog
          code={code}
          title={title}
          onClose={() => setNonCreditOpen(false)}
          onConfirmAdd={add}
        />
      )}
    </>
  );
}
