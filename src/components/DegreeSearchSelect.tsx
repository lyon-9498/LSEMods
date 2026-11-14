"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronsUpDown, X } from "lucide-react";
import { programmeMatchesQuery, type ProgrammeSummary } from "@/lib/programmes";
import { cn } from "@/lib/cn";

export function DegreeSearchSelect({
  options,
  value,
  onChange,
  labelledBy,
}: {
  options: ProgrammeSummary[];
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  /** Prefer the nearby section heading — avoids a redundant Degree label. */
  labelledBy?: string;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const selected = useMemo(
    () => (value ? options.find((p) => p.id === value) : undefined),
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = open ? query : "";
    return options.filter((p) => programmeMatchesQuery(p, q));
  }, [options, open, query]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(0);
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const el = rootRef.current;
      if (!el || el.contains(e.target as Node)) return;
      setOpen(false);
      setQuery("");
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
  }, [open]);

  const pick = (id: string | undefined) => {
    onChange(id);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  };

  const displayValue = open ? query : (selected?.name ?? "");
  const inputId = `${listId}-input`;

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <input
          id={inputId}
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-labelledby={labelledBy}
          aria-label={labelledBy ? undefined : "Search or pick a degree"}
          aria-activedescendant={
            open && filtered[activeIndex] ? `${listId}-opt-${filtered[activeIndex]!.id}` : undefined
          }
          autoComplete="off"
          spellCheck={false}
          placeholder="Search name or code…"
          title={selected && !open ? selected.name : undefined}
          className={cn(
            // Leave room for the clear (44px) + chevron (44px) buttons so long names don't run under them.
            "field-input w-full text-ellipsis text-night placeholder:text-muted",
            selected ? "pr-[5.75rem]" : "pr-12",
            "transition-colors hover:border-indigo/35",
            selected && !open && "font-medium",
          )}
          value={displayValue}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              setOpen(false);
              setQuery("");
              inputRef.current?.blur();
              return;
            }
            if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
              setOpen(true);
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, 0));
              return;
            }
            if (e.key === "Enter" && open) {
              e.preventDefault();
              const hit = filtered[activeIndex];
              if (hit) pick(hit.id);
            }
          }}
        />
        <div className="pointer-events-none absolute inset-y-0 right-1 flex items-center gap-0.5">
          {selected && (
            <button
              type="button"
              tabIndex={-1}
              aria-label="Clear degree"
              className="pointer-events-auto inline-flex size-11 items-center justify-center rounded-[var(--radius-control)] text-muted hover:bg-lilac hover:text-night"
              onClick={(e) => {
                e.preventDefault();
                pick(undefined);
              }}
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            aria-label={open ? "Close degree list" : "Open degree list"}
            className="pointer-events-auto inline-flex size-11 items-center justify-center rounded-[var(--radius-control)] text-muted hover:bg-lilac hover:text-night"
            onClick={() => {
              if (open) {
                setOpen(false);
                setQuery("");
              } else {
                setOpen(true);
                setQuery("");
                inputRef.current?.focus();
              }
            }}
          >
            <ChevronsUpDown className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Degrees"
          className="absolute z-30 mt-1.5 max-h-72 w-full overflow-auto rounded-[var(--radius-inner)] border border-line bg-surface py-1 shadow-[0_8px_24px_rgba(27,22,64,0.07)]"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-3 text-sm text-muted">No degrees match “{query.trim()}”.</li>
          ) : (
            filtered.map((p, i) => {
              const isActive = i === activeIndex;
              const isSelected = p.id === value;
              return (
                <li key={p.id} role="presentation">
                  <button
                    type="button"
                    id={`${listId}-opt-${p.id}`}
                    role="option"
                    aria-selected={isSelected}
                    className={cn(
                      "mx-1 flex min-h-11 w-[calc(100%-0.5rem)] flex-col items-start justify-center gap-0.5 rounded-[calc(var(--radius-inner)-4px)] px-3 py-2 text-left text-sm",
                      isActive ? "bg-lilac" : "hover:bg-lilac",
                      isSelected && "font-semibold text-night",
                    )}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => pick(p.id)}
                  >
                    <span className="text-night">{p.name}</span>
                    <span className="text-xs text-muted">
                      {p.degree}
                      {p.years ? ` · ${p.years} years` : ""}
                      {p.ucasCode ? ` · ${p.ucasCode}` : ""}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
