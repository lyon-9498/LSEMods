import Link from "next/link";

export const metadata = { title: "About" };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-4">
      <header>
        <h1 className="font-display text-3xl text-night">About LSEmods</h1>
        <p className="mt-3 leading-relaxed text-night">
          LSEmods is an <strong>unofficial</strong> student project. It isn&apos;t affiliated with,
          endorsed by, or connected to the London School of Economics and Political Science.
        </p>
      </header>

      <p className="leading-relaxed text-muted">
        We pull course and programme data offline from the public LSE Calendar and ship it as
        static JSON. Check the{" "}
        <a
          href="https://www.lse.ac.uk/resources/calendar"
          className="text-violet underline underline-offset-2 hover:text-indigo"
          target="_blank"
          rel="noreferrer"
        >
          official Calendar
        </a>{" "}
        before you pick modules.
      </p>

      <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted">
        <li>No accounts, no database, nothing personal stored on a server.</li>
        <li>
          Your degree plan and marks stay in this browser. Use Export in Course Builder if you want
          a backup.
        </li>
        <li>Course comments run on Disqus and load only after you opt in.</li>
        <li>
          Upstream catalogue work:{" "}
          <a
            href="https://github.com/lyon-9498/LSEMods"
            className="text-violet underline underline-offset-2 hover:text-indigo"
            target="_blank"
            rel="noreferrer"
          >
            lyon-9498/LSEMods
          </a>
          .
        </li>
      </ul>

      <div className="flex flex-wrap gap-3 pt-2">
        <Link href="/courses" className="btn-primary inline-flex items-center px-6">
          Browse Courses
        </Link>
        <Link href="/support" className="btn-ghost inline-flex items-center px-6">
          Support Us
        </Link>
      </div>
    </div>
  );
}
