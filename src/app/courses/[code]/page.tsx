import Link from "next/link";
import { notFound } from "next/navigation";
import { readFile } from "fs/promises";
import path from "path";
import { AssessmentDetails } from "@/components/AssessmentDetails";
import { AddToPlanButton } from "@/components/AddToPlanButton";
import { PrereqTree } from "@/components/PrereqTree";
import { Reviews } from "@/components/Reviews";
import { isValidCourseCode } from "@/lib/async";
import { canonicalCode } from "@/lib/courseAliases";
import { getCourseCodes } from "@/lib/data";
import { isNonCreditUnits, termChipClass, termLabel, unitLabel } from "@/lib/labels";
import { isMeaningfulListText } from "@/lib/listText";
import { isLSE100Variant } from "@/lib/plannerLogic";
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
  return { title: canonicalCode(code) };
}

async function loadCourseFile(code: string): Promise<Course | null> {
  const normalized = canonicalCode(code);
  if (!isValidCourseCode(normalized)) return null;
  try {
    const raw = await readFile(
      path.join(process.cwd(), "public", "data", "courses", `${normalized}.json`),
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
  const code = canonicalCode(raw);
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
    <article className="pb-36 lg:pb-8">
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
          {course.stats?.capped &&
            !/^no$/i.test(String(course.stats.capped).trim()) && (
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
        <div className="mt-5 flex flex-wrap gap-3">
          <AddToPlanButton
            code={course.code}
            units={course.units}
            title={course.title}
            className="hidden lg:inline-flex"
          />
          {sourceHref && (
            <a
              href={sourceHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-[var(--radius-control)] border border-white/36 px-6 py-3 text-sm font-semibold text-white sm:flex-none"
            >
              Official Guide
            </a>
          )}
        </div>
      </header>

      {isNonCreditUnits(course.units) && (
        <p className="note-needs-checking mt-4 inline-flex w-full items-start gap-2 rounded-[var(--radius)] px-4 py-3 text-sm">
          <span>
            <span className="font-semibold">Non-credit bearing.</span> LSE lists this course as 0
            units — it does not count toward your year&apos;s 4.0 unit total or classification
            marks. Often a short skills course with no summative assessment.
          </span>
        </p>
      )}

      {isLSE100Variant(course.code) && (
        <p className="mt-4 rounded-[var(--radius)] border border-line bg-lilac-deep/50 px-4 py-3 text-sm text-night">
          <span className="font-semibold">Taken with your four papers.</span> LSE100 is a half
          unit for all first years. Year 1 is 4.5 units in total (four papers plus LSE100), and
          LSE100 also counts toward classification.
        </p>
      )}

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
            {course.lastScraped ? ` · scraped ${course.lastScraped}` : ""}.
          </p>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-[var(--radius)] border border-line bg-surface p-4">
            <h2 className="font-display text-lg text-night">Assessment</h2>
            <div className="mt-3">
              <AssessmentDetails
                code={course.code}
                text={course.assessmentText}
                items={course.assessment}
              />
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
            <AddToPlanButton
              code={course.code}
              units={course.units}
              title={course.title}
              className="w-full"
            />
          </div>
        </aside>
      </div>

      <AddToPlanButton
        code={course.code}
        units={course.units}
        title={course.title}
        sticky
        className="w-[calc(100%-2rem)] lg:hidden"
      />
    </article>
  );
}
