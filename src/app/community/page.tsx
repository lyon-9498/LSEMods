import { CopyFeedbackTemplate } from "@/components/CopyFeedbackTemplate";
import { TELEGRAM_URL } from "@/lib/config";

export const metadata = { title: "Community" };

const SEND_IDEAS = [
  "A screenshot of something confusing on your phone",
  "A course with wrong assessment data or missing weights",
  "Builder ideas: programme rules, export formats, grades",
];

export default function CommunityPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-36 lg:pb-8">
      <header className="band-grid rounded-[var(--radius)] px-5 py-10 text-white sm:px-8">
        <h1 className="font-display text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
          Help Shape LSEmods
        </h1>
        <p className="mt-3 max-w-xl text-sm text-white/80 sm:text-base">
          If you have thoughts on the site, come say so on Telegram: what works, what confuses
          you, what you want next.
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
            {/* Plain img: QR must stay crisp and high-contrast (next/image softens it). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/telegram-qr.png"
              alt="QR code to join the LSEmods Telegram group"
              width={200}
              height={200}
              className="aspect-square size-[200px] rounded-[var(--radius-inner)] bg-white object-contain p-3"
              decoding="async"
            />
            <figcaption className="text-xs text-white/70">Scan to join on mobile</figcaption>
          </figure>
        </div>
      </header>

      <section>
        <h2 className="font-display text-xl text-night">What to Send</h2>
        <p className="mt-1 text-sm text-muted">
          Short notes help most. One issue per message if you can.
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
          <li>
            Be kind. LSEmods is run by student volunteers; this isn&apos;t official LSE support.
          </li>
          <li>
            Stick to open, public information. Don&apos;t post personal data, exam papers, grade
            breakdowns, or anything confidential. The site is on the public internet.
          </li>
          <li>
            For official course facts, use the Calendar. We update when we can.
          </li>
        </ul>
      </section>
    </div>
  );
}
