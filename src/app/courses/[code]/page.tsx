import Link from "next/link";
import { notFound } from "next/navigation";
import { readFile } from "fs/promises";
import path from "path";
import { AssessmentBar } from "@/components/AssessmentBar";
import { AddToPlanButton } from "@/components/AddToPlanButton";
import { PrereqTree } from "@/components/PrereqTree";
import { Reviews } from "@/components/Reviews";
import { isValidCourseCode } from "@/lib/async";
import { getCourseCodes } from "@/lib/data";
import { termChipClass, termLabel, unitLabel } from "@/lib/labels";
import { isMeaningfulListText } from "@/lib/listText";
import type { Course } from "@/lib/types";
import { safeHttpsUrl } from "@/lib/urls";

export async function generateStaticParams() {
  const codes = await getCourseCodes();
  return codes.map((code) => ({ code }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return { title: code.toUpperCase() };
}

async function loadCourseFile(code: string): Promise<Course | null> {
  if (!isValidCourseCode(code)) return null;
  try {
    const raw = await readFile(
      path.join(process.cwd(), "public", "data", "courses", `${code.toUpperCase()}.json`),
      "utf8",
    );
    return JSON.parse(raw) as Course;
  } catch {
    return null;
  }
}

export default async function CoursePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: raw } = await params;
  const code = raw.toUpperCase();
  const course = await loadCourseFile(code);
  if (!course) notFound();
  const sourceHref = safeHttpsUrl(course.sourceUrl);

  const skills = (course.skills || []).filter(
    (s) =>
      isMeaningfulListText(s) &&
      !/copyright|freedom of information|terms of use|social media|report a page/i.test(s),
  );
  const reading = (course.indicativeReading || []).filter(isMeaningfulListText);
  const unlocks = [
    ...new Set(
      (course.unlocks || [])
        .filter((u) => isMeaningfulListText(u) && isValidCourseCode(u))
        .map((u) => u.trim().toUpperCase()),
    ),
  ];

  return (
    <article className="pb-24 lg:pb-8">
      <Link
        href="/courses"
        className="inline-flex min-h-11 items-center text-sm font-medium text-violet underline-offset-2 hover:text-indigo hover:underline"
      >
        ← All courses
      </Link>

      <header className="band-grid mt-4 rounded-[var(--radius)] px-5 py-6 text-white sm:px-8">
        <div className="flex flex-wrap gap-2">
          <span className="chip-code px-2 py-0.5 text-xs tabular">{course.code}</span>
          <span className="chip-unit bg-white/15 px-2.5 py-0.5 text-xs font-medium text-white">
            {unitLabel(course.units)}
          </span>
          {course.terms.map((t) => (
            <span key={t} className={`px-2.5 py-0.5 text-xs font-medium ${termChipClass(t)}`}>
              {termLabel(t)}
            </span>
          ))}
          {course.fheqLevel != null && (
            <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium text-white">
              FHEQ Level {course.fheqLevel}
            </span>
          )}
          {course.stats?.capped && (
            <span className="chip-capped px-2.5 py-0.5 text-xs font-medium">
              Capped · {course.stats.capped}
            </span>
          )}
        </div>
        <h1 className="mt-3 font-display text-3xl font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-4xl">
          {course.title}
        </h1>
        <p className="mt-2 text-sm text-white/80">
          {course.convenors?.[0] ? `${course.convenors[0]} · ` : ""}
          {course.department ?? "Department unknown"}
        </p>
        <div className="mt-5 hidden flex-wrap gap-3 lg:flex">
          <AddToPlanButton code={course.code} />
          {sourceHref && (
            <a
              href={sourceHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-12 items-center justify-center rounded-[var(--radius-control)] border border-white/36 px-6 py-3 text-sm font-semibold text-white"
            >
              Official Guide
            </a>
          )}
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {course.description && (
            <section className="space-y-2">
              <h2 className="font-display text-xl text-night">Overview</h2>
              <p className="text-justify leading-relaxed text-night/90">{course.description}</p>
            </section>
          )}

          {course.teaching && (
            <section className="space-y-2">
              <h2 className="font-display text-xl text-night">Teaching</h2>
              <p className="text-justify leading-relaxed text-night/90">{course.teaching}</p>
            </section>
          )}

          {(course.prerequisites || course.prereqTree) && (
            <section className="space-y-2">
              <h2 className="font-display text-xl text-night">Prerequisites</h2>
              {course.prerequisites && (
                <p className="text-justify leading-relaxed text-night/90">{course.prerequisites}</p>
              )}
              {course.prereqTree && (
                <div className="rounded-[var(--radius-inner)] border border-line bg-surface p-3 text-sm">
                  <p className="mb-2 text-muted">Parsed tree — if this differs from the text, trust the text.</p>
                  <PrereqTree tree={course.prereqTree} />
                </div>
              )}
            </section>
          )}

          {unlocks.length > 0 && (
            <section className="space-y-2">
              <h2 className="font-display text-xl text-night">Leads to</h2>
              <ul className="flex flex-wrap gap-2">
                {unlocks.map((u) => (
                  <li key={u}>
                    <Link
                      href={`/courses/${u}`}
                      className="chip-code inline-flex min-h-11 items-center px-2.5 text-sm underline-offset-2 hover:underline"
                    >
                      {u}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {course.availability && (
            <section className="space-y-2">
              <h2 className="font-display text-xl text-night">Availability</h2>
              <p className="text-justify leading-relaxed text-night/90">{course.availability}</p>
            </section>
          )}

          {reading.length > 0 && (
            <details className="rounded-[var(--radius)] border border-line bg-surface p-4">
              <summary className="flex min-h-11 cursor-pointer list-none items-center font-display text-lg text-night [&::-webkit-details-marker]:hidden">
                Indicative reading
                <span className="ml-2 text-sm font-sans font-normal text-muted tabular">
                  ({reading.length})
                </span>
              </summary>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-night/90">
                {reading.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </details>
          )}

          {skills.length > 0 && (
            <section className="space-y-2">
              <h2 className="font-display text-xl text-night">Skills</h2>
              <ul className="flex flex-wrap gap-2">
                {skills.map((s, i) => (
                  <li
                    key={i}
                    className="rounded-[var(--radius-badge)] bg-lilac px-2.5 py-1.5 text-sm text-text-2"
                  >
                    {s}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Reviews code={course.code} title={course.title} />

          <p className="text-xs text-muted">
            Source:{" "}
            {sourceHref ? (
              <a href={sourceHref} className="underline underline-offset-2" target="_blank" rel="noreferrer">
                LSE Calendar
              </a>
            ) : (
              "LSE Calendar"
            )}
            {course.lastScraped ? ` · scraped ${course.lastScraped}` : ""}. Unofficial — verify on the Calendar before
            choosing courses.
          </p>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-[var(--radius)] border border-line bg-surface p-4">
            <h2 className="font-display text-lg text-night">Assessment</h2>
            {course.assessmentText && (
              <p className="mt-2 text-justify text-sm text-night/90">{course.assessmentText}</p>
            )}
            <div className="mt-3">
              <AssessmentBar items={course.assessment} />
            </div>
          </div>
          {(course.stats?.totalStudentsPrevYear || course.stats?.capped) && (
            <div className="rounded-[var(--radius)] border border-line bg-surface p-4 text-sm">
              <h2 className="font-display text-lg text-night">Last year</h2>
              <ul className="mt-2 space-y-1 text-muted">
                {course.stats.totalStudentsPrevYear != null && (
                  <li className="tabular">Students: {course.stats.totalStudentsPrevYear}</li>
                )}
                {course.stats.avgClassSizePrevYear != null && (
                  <li className="tabular">Avg class: {course.stats.avgClassSizePrevYear}</li>
                )}
                {course.stats.capped && <li>Capped: {course.stats.capped}</li>}
              </ul>
            </div>
          )}
          <div className="hidden lg:block">
            <AddToPlanButton code={course.code} className="w-full" />
          </div>
        </aside>
      </div>

      <AddToPlanButton code={course.code} sticky className="w-[calc(100%-2rem)] lg:hidden" />
    </article>
  );
}
