# LSEmods

Unofficial LSE undergraduate course catalogue and degree planner. **Frontend-only** (Next.js + Tailwind on Vercel). No database, no auth — plans stay in the browser (`localStorage`).

Course data is adapted from [lyon-9498/LSEMods](https://github.com/lyon-9498/LSEMods).

## Develop

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

Copy `.env.example` → `.env.local`:

- `NEXT_PUBLIC_DISQUS_SHORTNAME` (default `lsemods`)
- `NEXT_PUBLIC_TELEGRAM_URL`
- `NEXT_PUBLIC_OPEN_COLLECTIVE_URL`
- `NEXT_PUBLIC_SITE_URL` (canonical, e.g. `https://lsemods.com`)

## Scripts

| Command | Purpose |
|--------|---------|
| `npm run dev` | Local app |
| `npm run build` | Production build |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright (after `npx playwright install`) |

## Annual LSE data refresh (offline)

Scrapers live in `scrapers/` and must **never** run in the browser or as public Vercel routes.

```bash
python -m pip install -r scrapers/requirements.txt
python scrapers/scrape_lse.py --contact you@example.com
python scrapers/build_graph.py --data data --out public/data --contact you@example.com
python scrapers/scrape_programmes.py --contact you@example.com
```

Rate-limit ~1 req/s; reuse HTML caches; open a PR against `staging` before merging to `main`. Tag releases like `data-2026-2027` after a successful refresh. Do **not** commit `public/data/raw` HTML into production deploys.

## Publish (Vercel + lsemods.com)

This app is Next.js App Router — deploy on **Vercel** (not GitHub Pages).

1. Accept the GitHub collaborator invite for [lyon-9498/LSEMods](https://github.com/lyon-9498/LSEMods) while signed in as `raynenngoh`.
2. Push this Next.js app to a branch (e.g. `lsemods-com`) so the existing Vite `main` stays intact until you merge.
3. In [Vercel](https://vercel.com): **Add New Project** → import `lyon-9498/LSEMods` → set **Production Branch** to `lsemods-com` (or `main` after merge).
4. Add env vars from `.env.example` (`NEXT_PUBLIC_*`).
5. Domain: Project → Settings → Domains → add `lsemods.com` (+ `www` if needed) and point DNS to Vercel.

## Release / staging

1. Feature branch → Vercel Preview  
2. Merge to `staging` → smoke test (`staging.lsemods.com` or Preview)  
3. Merge to `main` → production `lsemods.com`  
4. Bad deploy → Vercel Rollback  

## Backup

- GitHub = source of truth for code + JSON  
- Yearly data tags / Release assets  
- Vercel rollback  
- Optional Netlify cold standby from the same repo  

## Disclaimer

Not affiliated with LSE. Always verify the official Calendar before choosing courses.
