import { OPEN_COLLECTIVE_URL } from "@/lib/config";

export const metadata = { title: "Support" };

const COSTS = [
  {
    title: "Domain & hosting",
    body: "lsemods.com and static hosting so the catalogue stays fast and free to use.",
  },
  {
    title: "Yearly data refresh",
    body: "Scraping and checking the LSE Calendar each session so assessment data stays usable.",
  },
  {
    title: "Incident buffer",
    body: "A small float for unexpected renewals or a temporary hosting failover.",
  },
];

const FAQ = [
  {
    q: "Where does the money go?",
    a: "Every contribution and expense is listed on our Open Collective page — we don’t take a cut for ourselves.",
  },
  {
    q: "Is this affiliated with LSE?",
    a: "No. LSEmods is an unofficial student project. Always verify modules on the official LSE Calendar.",
  },
  {
    q: "Do I get anything for donating?",
    a: "The site stays free for everyone. Supporting us just keeps the lights on and the data updated.",
  },
];

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-4">
      <header className="band-grid rounded-[var(--radius)] px-5 py-10 text-white sm:px-8">
        <h1 className="font-display text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
          Help Us Help You
        </h1>
        <p className="mt-3 max-w-xl text-sm text-white/85 sm:text-base">
          LSEmods is run entirely by students. There&apos;s no school funding and no paid product
          behind this — just a free, ad-light site that needs a bit of help with domain, hosting,
          and updating course data each year.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <a
            href={OPEN_COLLECTIVE_URL}
            target="_blank"
            rel="noreferrer"
            className="btn-primary inline-flex w-full items-center justify-center px-6 sm:w-auto"
          >
            Contribute on Open Collective
          </a>
          <a
            href={`${OPEN_COLLECTIVE_URL}#section-budget`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-[var(--radius-control)] border border-white/36 px-6 text-sm font-semibold text-white sm:w-auto"
          >
            View Public Ledger
          </a>
        </div>
      </header>

      <section>
        <h2 className="font-display text-xl text-night">Where Support Goes</h2>
        <p className="mt-1 text-sm text-muted">
          One-off or monthly — both help. Pick either on Open Collective.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {COSTS.map((c) => (
            <li
              key={c.title}
              className="rounded-[var(--radius)] border border-line bg-surface p-4"
            >
              <h3 className="font-display text-base text-night">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{c.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-display text-xl text-night">FAQ</h2>
        <dl className="mt-4 space-y-4">
          {FAQ.map((item) => (
            <div
              key={item.q}
              className="rounded-[var(--radius)] border border-line bg-surface p-4"
            >
              <dt className="font-semibold text-night">{item.q}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-muted">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
