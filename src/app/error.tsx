"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-line bg-surface p-8 text-center">
      <h1 className="font-display text-2xl text-night">Something went wrong</h1>
      <p className="mt-2 text-muted">Please try again. If it keeps happening, refresh the page.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex min-h-11 items-center rounded-[var(--radius-inner)] bg-indigo px-6 py-3 font-medium text-white"
      >
        Try Again
      </button>
    </div>
  );
}
