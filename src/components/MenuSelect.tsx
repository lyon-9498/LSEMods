"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/cn";

export type MenuSelectOption<T extends string | number = string> = {
  value: T;
  label: string;
  description?: string;
};

/** Custom listbox matching DegreeSearchSelect (surface panel, lilac hover, soft shadow). */
export function MenuSelect<T extends string | number>({
  id,
  value,
  onChange,
  options,
  labelledBy,
  "aria-label": ariaLabel,
  className,
  buttonClassName,
}: {
  id?: string;
  value: T;
  onChange: (next: T) => void;
  options: readonly MenuSelectOption<T>[];
  labelledBy?: string;
  "aria-label"?: string;
  className?: string;
  buttonClassName?: string;
}) {
  const autoId = useId();
  const listId = `${autoId}-list`;
  const triggerId = id ?? `${autoId}-trigger`;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const [activeIndex, setActiveIndex] = useState(selectedIndex);

  const selected = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    setActiveIndex(selectedIndex);
  }, [open, selectedIndex]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const el = rootRef.current;
      if (!el || el.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
  }, [open]);

  const pick = (next: T) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        id={triggerId}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : ariaLabel}
        className={cn(
          "field-input inline-flex min-h-11 w-full items-center justify-between gap-2 text-left text-night",
          "transition-colors hover:border-indigo/35",
          open && "border-indigo/50",
          buttonClassName,
        )}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      >
        <span className="min-w-0 truncate font-medium">{selected?.label}</span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted" aria-hidden />
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-labelledby={labelledBy ?? triggerId}
          tabIndex={-1}
          className="absolute z-30 mt-1.5 max-h-72 min-w-full overflow-auto rounded-[var(--radius-inner)] border border-line bg-surface py-1 shadow-[0_8px_24px_rgba(27,22,64,0.07)]"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              setOpen(false);
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex((i) => Math.min(i + 1, options.length - 1));
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, 0));
              return;
            }
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              const hit = options[activeIndex];
              if (hit) pick(hit.value);
            }
          }}
        >
          {options.map((o, i) => {
            const isSelected = o.value === value;
            const isActive = i === activeIndex;
            return (
              <li key={String(o.value)} role="presentation">
                <button
                  type="button"
                  id={`${listId}-opt-${String(o.value)}`}
                  role="option"
                  aria-selected={isSelected}
                  className={cn(
                    "mx-1 flex min-h-11 w-[calc(100%-0.5rem)] items-center gap-2 rounded-[calc(var(--radius-inner)-4px)] px-3 py-2 text-left text-sm",
                    isActive ? "bg-lilac" : "hover:bg-lilac",
                    isSelected && "font-semibold text-night",
                  )}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => pick(o.value)}
                >
                  <Check
                    className={cn(
                      "size-4 shrink-0",
                      isSelected ? "text-indigo opacity-100" : "opacity-0",
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-night">{o.label}</span>
                    {o.description ? (
                      <span className="mt-0.5 block text-xs text-muted">{o.description}</span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
