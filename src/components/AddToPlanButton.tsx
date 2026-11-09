"use client";

import { useEffect } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { planActions, usePlan, onPlanPersistError } from "@/lib/planStore";
import { cn } from "@/lib/cn";

export function AddToPlanButton({
  code,
  className,
  sticky,
}: {
  code: string;
  className?: string;
  sticky?: boolean;
}) {
  const plan = usePlan();
  const inPlan = plan.items.some((i) => i.code === code);
  const year = plan.items.find((i) => i.code === code)?.year;

  useEffect(() => {
    return onPlanPersistError((err) => {
      if (err) toast.warning(err);
    });
  }, []);

  return (
    <button
      type="button"
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-2 px-6 py-3 transition",
        inPlan ? "btn-ghost border-status-plan-border bg-status-plan-bg text-status-plan-text" : "btn-primary",
        sticky &&
          "fixed inset-x-4 z-30 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] shadow-lg lg:static lg:inset-auto lg:z-auto lg:shadow-none",
        className,
      )}
      onClick={() => {
        if (inPlan) {
          planActions.remove(code);
          toast.message(`Removed ${code} from plan`);
        } else {
          planActions.add(code, 1);
          toast.success(`Added ${code} to Year 1`);
        }
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
  );
}
