"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import {
  DAY_LABELS,
  formatTime,
  useWeekPlan,
  weekActions,
  blocksClash,
  type WeekBlock,
  type WeekDay,
} from "@/lib/weekStore";
import { colorForCode } from "@/lib/labels";
import { usePlan } from "@/lib/planStore";

const TIMES = Array.from({ length: 13 }, (_, i) => (9 + i) * 60); // 09:00–21:00

export function WeeklySketch() {
  const week = useWeekPlan();
  const plan = usePlan();
  const [day, setDay] = useState<WeekDay | "all">("all");
  const [editing, setEditing] = useState<string | null>(null);

  const clashes = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < week.blocks.length; i++) {
      for (let j = i + 1; j < week.blocks.length; j++) {
        if (blocksClash(week.blocks[i], week.blocks[j])) {
          set.add(week.blocks[i].id);
          set.add(week.blocks[j].id);
        }
      }
    }
    return set;
  }, [week.blocks]);

  const placed = useMemo(() => new Set(week.blocks.map((b) => b.code)), [week.blocks]);
  const days: WeekDay[] = [1, 2, 3, 4, 5];
  const showDays = day === "all" ? days : [day];

  return (
    <div className="space-y-4">
      <div className="rounded-[var(--radius)] border border-danger/30 bg-danger-bg p-3 text-sm text-danger">
        Unofficial placeholders — LSE does not publish public class times here. Edit blocks yourself; this is not your
        official timetable.
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`min-h-11 rounded-[var(--radius-control)] px-3 text-sm font-medium ${day === "all" ? "bg-indigo text-white" : "border border-line-strong bg-surface text-night"}`}
          aria-pressed={day === "all"}
          onClick={() => setDay("all")}
        >
          Full Week
        </button>
        {days.map((d) => (
          <button
            key={d}
            type="button"
            className={`min-h-11 rounded-[var(--radius-control)] px-3 text-sm font-medium lg:hidden ${day === d ? "bg-indigo text-white" : "border border-line-strong bg-surface text-night"}`}
            aria-pressed={day === d}
            onClick={() => setDay(d)}
          >
            {DAY_LABELS[d]}
          </button>
        ))}
        {plan.items.map((i) => (
          <button
            key={i.code}
            type="button"
            className="min-h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-sm text-night disabled:opacity-50"
            disabled={placed.has(i.code)}
            onClick={() => {
              if (placed.has(i.code)) {
                toast.message(`${i.code} already has placeholders`);
                return;
              }
              weekActions.addForCourse(i.code);
              toast.success(`Placed ${i.code}`);
            }}
          >
            {placed.has(i.code) ? `${i.code} placed` : `+ Placeholders for ${i.code}`}
          </button>
        ))}
        {week.blocks.length > 0 && (
          <button
            type="button"
            className="min-h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-sm text-danger"
            onClick={() => {
              if (confirm("Clear all timetable blocks?")) weekActions.clear();
            }}
          >
            Clear Week
          </button>
        )}
      </div>

      <div className={`grid gap-3 ${day === "all" ? "lg:grid-cols-5" : "grid-cols-1"}`}>
        {showDays.map((d) => (
          <div key={d} className="rounded-[var(--radius)] border border-line bg-surface p-3">
            <h3 className="text-sm font-semibold text-night">{DAY_LABELS[d]}</h3>
            <ul className="mt-2 space-y-2">
              {week.blocks
                .filter((b) => b.day === d)
                .sort((a, b) => a.startMin - b.startMin)
                .map((b) => (
                  <li key={b.id}>
                    {editing === b.id ? (
                      <BlockEditor
                        block={b}
                        onSave={(next) => {
                          weekActions.update(next);
                          setEditing(null);
                        }}
                        onCancel={() => setEditing(null)}
                      />
                    ) : (
                      <div
                        className={`rounded-[var(--radius-inner)] p-2 text-xs text-white ${
                          clashes.has(b.id) ? "ring-2 ring-danger" : ""
                        }`}
                        style={{ background: colorForCode(b.code) }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold tabular">{b.code}</p>
                            <p>{b.label}</p>
                            <p className="tabular opacity-90">
                              {formatTime(b.startMin)}–{formatTime(b.endMin)}
                            </p>
                          </div>
                          <div className="flex flex-col gap-1">
                            <button
                              type="button"
                              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md bg-black/25 px-2 text-xs font-semibold"
                              aria-label={`Edit ${b.code} block`}
                              onClick={() => setEditing(b.id)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md bg-black/25"
                              aria-label={`Remove ${b.code} block`}
                              onClick={() => weekActions.remove(b.id)}
                            >
                              <X className="size-4" aria-hidden />
                            </button>
                          </div>
                        </div>
                        {clashes.has(b.id) && <p className="mt-1 font-medium">Clash</p>}
                      </div>
                    )}
                  </li>
                ))}
              {week.blocks.filter((b) => b.day === d).length === 0 && (
                <li className="text-xs text-muted">No blocks</li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function BlockEditor({
  block,
  onSave,
  onCancel,
}: {
  block: WeekBlock;
  onSave: (b: WeekBlock) => void;
  onCancel: () => void;
}) {
  const [day, setDay] = useState<WeekDay>(block.day);
  const [startMin, setStartMin] = useState(block.startMin);
  const [endMin, setEndMin] = useState(block.endMin);
  const [label, setLabel] = useState(block.label);

  return (
    <form
      className="space-y-2 rounded-[var(--radius-inner)] border border-line bg-surface p-2 text-xs"
      onSubmit={(e) => {
        e.preventDefault();
        if (endMin <= startMin) {
          toast.error("End must be after start");
          return;
        }
        onSave({ ...block, day, startMin, endMin, label: label.trim() || block.label });
      }}
    >
      <p className="font-semibold text-night">{block.code}</p>
      <label className="block">
        Day
        <select
          className="field-input mt-1"
          value={day}
          onChange={(e) => setDay(Number(e.target.value) as WeekDay)}
        >
          {([1, 2, 3, 4, 5] as WeekDay[]).map((d) => (
            <option key={d} value={d}>
              {DAY_LABELS[d]}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          Start
          <select
            className="field-input mt-1"
            value={startMin}
            onChange={(e) => setStartMin(Number(e.target.value))}
          >
            {TIMES.map((t) => (
              <option key={t} value={t}>
                {formatTime(t)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          End
          <select
            className="field-input mt-1"
            value={endMin}
            onChange={(e) => setEndMin(Number(e.target.value))}
          >
            {TIMES.map((t) => (
              <option key={t} value={t}>
                {formatTime(t)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        Label
        <input
          className="field-input mt-1"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={40}
        />
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          className="min-h-11 flex-1 rounded-md bg-indigo px-2 text-sm font-medium text-white"
        >
          Save
        </button>
        <button
          type="button"
          className="min-h-11 flex-1 rounded-md border border-line-strong px-2 text-sm"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
