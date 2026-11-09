# Offline LSE scrapers

Polite, offline-only tooling to refresh `public/data` each academic year.

- Identify yourself with `--contact you@example.com`
- Aim for ~1 request/second; backoff on 429/5xx
- Cache HTML locally so re-runs don’t re-download
- Ship **parsed JSON** only to the site — keep raw HTML out of production

Never expose these as Vercel API routes.
