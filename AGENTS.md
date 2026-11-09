# LSEMods — agent memory (from planning, 2026-11-09)

Persistent guidance for future work on this repo. Also mirrored in the user’s personal agent store as `lsemods-and-frontend-prefs.md`.

## Architecture

- **Frontend-only**: no DB, auth, or server writes. Plans in `localStorage` only.
- **Stack**: Next.js App Router + React + TypeScript + Tailwind; **Vercel** + domain **lsemods.com**.
- **Data**: port [lyon-9498/LSEMods](https://github.com/lyon-9498/LSEMods). Ship JSON in `public/data` only — never deploy `raw/` HTML; never scrape LSE from the browser.
- **Yearly refresh**: offline scrapers → commit JSON → redeploy; ~1 req/s rate limit.
- **Reuse** pure logic: `search`, `plannerLogic`, `degreeLogic`, `lsemods-plan-v1` plan store.
- **LSE100** is **0.5 units** (half unit → 1 classification mark). Taken on top of the four papers — excluded from year unit totals (`isExcludedFromUnits`). Variants in data: `LSE100A` / `B` / `C`.
- **Grade calculator** follows official BA/BSc schemes (from 2018/19): 3-year = 18 marks (FYA×2 + 16); 4-year = 26 marks (FYA×2 + 24). Use `schemeForYears` + `analyse` in `gradeLogic.ts`; UI shows target First/2:1/2:2 and remaining marks/units needed.
- **Disqus**: shortname `lsemods`; stable `identifier = CODE`; path URLs; lazy-load; failure must not crash the page.
- **Release**: preview → `staging` → protected `main` → production. Backup: GitHub + data tags + Vercel rollback + Netlify standby.
- **Out of scope**: Supabase/RLS, JWT/service keys, payment backends.

## UI / mobile

- Top nav on laptop (`≥lg`); bottom nav on phone/tablet. No left sidebar. `/` → `/courses`. Dark mode deferred.
- Builder primary = year × AT/WS + DegreePanel; weekly sketch = unofficial placeholders only.
- No share link in v1 — Export/Import plan JSON. Card menu required (no drag-only).
- QA viewports: 360, 390, 768, 1024, 1280. ≥44px targets; filter sheet on mobile; years stack on phone.
- CTAs above bottom nav + safe-area. WCAG 2.2 AA; allow zoom; respect reduced motion.
- Navy + one accent (60/30/10). Title Case buttons. Nested radius `inner ≈ outer − padding`. Button pad ~`py-Y px-2Y`.
- Visible labels; faint placeholders; high-contrast inputs. “(Optional)” not `*`. Text tabs not dots.
- Debounce search 250–300ms; max 4–6 concurrent course fetches; debounce localStorage plan writes.
- Unslop: no filler badges, glow, emoji chrome; cards only when interactive.

## Process prefs

- Plan thoroughly; fold UI/UX, security, and test findings into the plan before coding.
- Wait for explicit “go ahead / implement” before building.
- Telegram / Open Collective = outbound links; Disqus = third-party comments.
