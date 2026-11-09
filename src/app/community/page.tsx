import Image from "next/image";
import { CopyFeedbackTemplate } from "@/components/CopyFeedbackTemplate";
import { TELEGRAM_URL } from "@/lib/config";

export const metadata = { title: "Community" };

const SEND_IDEAS = [
  "A screenshot of something confusing on your phone",
  "A course with wrong assessment data or missing weights",
  "Builder ideas — programme rules, export formats, grades",
];

export default function CommunityPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-4">
      <header className="band-grid rounded-[var(--radius)] px-5 py-10 text-white sm:px-8">
        <h1 className="font-display text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
          Help Shape LSEmods
        </h1>
        <p className="mt-3 max-w-xl text-sm text-white/80 sm:text-base">
          Got thoughts on the site? Jump into Telegram and tell us what works, what&apos;s
          confusing, or what you&apos;d want next.
        </p>
        <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <a
            href={TELEGRAM_URL}
            target="_blank"
            rel="noreferrer"
            className="btn-primary inline-flex w-full items-center justify-center px-6 sm:w-auto"
          >
            Join Telegram
          </a>
          <figure className="mx-auto flex flex-col items-center gap-2 sm:mx-0">
            <Image
              src="/lsemods-telegram.png"
              alt="QR code to join the LSEmods Telegram group"
              width={128}
              height={128}
              className="rounded-[var(--radius-inner)] bg-white p-2"
            />
            <figcaption className="text-xs text-white/70">Scan to join on mobile</figcaption>
          </figure>
        </div>
      </header>

      <section>
        <h2 className="font-display text-xl text-night">What to Send</h2>
        <p className="mt-1 text-sm text-muted">
          Short notes help most — one issue per message if you can.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {SEND_IDEAS.map((t) => (
            <li
              key={t}
              className="rounded-[var(--radius)] border border-line bg-surface p-4 text-sm leading-relaxed text-night"
            >
              {t}
            </li>
          ))}
        </ul>
      </section>

      <CopyFeedbackTemplate />

      <section className="space-y-3">
        <h2 className="font-display text-xl text-night">Posting Rules</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted">
          <li>Be kind — this is a student-run project, not LSE support.</li>
          <li>No personal data, exam papers, or content that should stay private.</li>
          <li>Course facts belong on the official Calendar; we&apos;ll fix scrapes when we can.</li>
        </ul>
      </section>
    </div>
  );
}
