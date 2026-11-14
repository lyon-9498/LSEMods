import { SupportContribute } from "@/components/SupportContribute";

export const metadata = { title: "Support" };

const COSTS = [
  {
    title: "Domain & hosting",
    body: "lsemods.com and static hosting so the catalogue stays free to use.",
  },
  {
    title: "Yearly data refresh",
    body: "Pulling and checking the LSE Calendar each session so assessment data stays current.",
  },
  {
    title: "Incident buffer",
    body: "A little spare cash for renewals or a short hosting failover if something breaks.",
  },
];

const FAQ = [
  {
    q: "Where does the money go?",
    a: "Every contribution and expense shows up on our Open Collective page. We don’t take a cut.",
  },
  {
    q: "Is this affiliated with LSE?",
    a: "No. LSEmods is an unofficial student project. Check modules on the official LSE Calendar.",
  },
  {
    q: "Do I get anything for donating?",
    a: "No paid unlocks. The site stays free. Donations help with the domain, hosting, and yearly course data updates.",
  },
];

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-36 lg:pb-8">
      <header className="band-grid rounded-[var(--radius)] px-5 py-10 text-white sm:px-8">
        <h1 className="font-display text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
          Help Us Help You
        </h1>
        <p className="mt-3 max-w-xl text-sm text-white/85 sm:text-base">
          Students run LSEmods with no school funding. It&apos;s free and light on ads; we need
          help covering the domain, hosting, and yearly course data updates.
        </p>
        <SupportContribute />
      </header>

      <section>
        <h2 className="font-display text-xl text-night">Where Support Goes</h2>
        <p className="mt-1 text-sm text-muted">
          Choose one-off or monthly above, then continue on Open Collective.
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
