"use client";

import { useEffect, useId, useRef } from "react";
import Link from "next/link";
import { X } from "lucide-react";

export function NonCreditCourseDialog({
  code,
  title,
  onClose,
  onConfirmAdd,
}: {
  code: string;
  title?: string;
  onClose: () => void;
  /** When set, shows an Add to Plan action that calls this then closes. */
  onConfirmAdd?: () => void;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-md rounded-[var(--radius)] border border-line bg-surface p-5 shadow-[0_8px_24px_rgba(27,22,64,0.07)] sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-data text-xs font-bold text-indigo">{code}</p>
            <h2 id={titleId} className="mt-1 font-display text-lg font-bold text-night">
              Non-credit course
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-muted hover:bg-lilac hover:text-night"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        {title ? <p className="mt-2 text-sm font-medium text-night">{title}</p> : null}

        <p className="mt-3 text-sm text-muted">
          LSE lists this as <span className="font-medium text-night">non-credit bearing</span> (0
          units). It does not count toward your year&apos;s 4.0 unit total or degree classification
          marks. Many are short skills courses with no summative assessment.
        </p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse sm:flex-wrap">
          {onConfirmAdd ? (
            <button type="button" className="btn-primary min-h-12 px-5" onClick={onConfirmAdd}>
              Add to Plan Anyway
            </button>
          ) : null}
          <Link
            href={`/courses/${code}`}
            className="btn-ghost inline-flex min-h-12 items-center justify-center px-5 text-sm font-semibold"
            onClick={onClose}
          >
            View Course
          </Link>
          <button
            type="button"
            className="inline-flex min-h-12 items-center justify-center rounded-[var(--radius-control)] px-5 text-sm font-medium text-muted hover:bg-lilac hover:text-night"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
