import Link from "next/link";

export default function NotFound() {
  return (
    <div className="rounded-[var(--radius)] border border-line bg-surface p-8 text-center">
      <h1 className="font-display text-2xl text-night">Page not found</h1>
      <p className="mt-2 text-muted">That course or page isn’t here.</p>
      <Link
        href="/courses"
        className="btn-primary mt-6 inline-flex items-center px-6"
      >
        Browse Courses
      </Link>
    </div>
  );
}
