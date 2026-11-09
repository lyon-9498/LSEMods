import Fuse from "fuse.js";
import type { IndexEntry } from "./types";

export interface Prepared {
  c: IndexEntry;
  code: string;
  title: string;
  titleWords: string[];
  dept: string;
  people: string;
  snippet: string;
}

export function prepare(index: IndexEntry[]): Prepared[] {
  return index.map((c) => ({
    c,
    code: c.code.toLowerCase(),
    title: c.title.toLowerCase(),
    titleWords: c.title.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean),
    dept: (c.department ?? "").toLowerCase(),
    people: c.convenors.join(" ").toLowerCase(),
    snippet: (c.snippet ?? "").toLowerCase(),
  }));
}

/** How well one typed word matches a course. 0 means no match at all. */
function scoreToken(p: Prepared, t: string): number {
  let s = 0;
  if (p.code === t) s = 200;
  else if (p.code.startsWith(t)) s = 120;
  else if (p.code.includes(t)) s = 60;

  if (p.titleWords.includes(t)) s = Math.max(s, 90);
  else if (p.titleWords.some((w) => w.startsWith(t))) s = Math.max(s, 70);
  else if (p.title.includes(t)) s = Math.max(s, 40);

  if (p.dept.includes(t)) s = Math.max(s, 20);
  if (p.people.includes(t)) s = Math.max(s, 20);
  if (p.snippet.includes(t)) s = Math.max(s, 5);
  return s;
}

/** Plain code order (EC1A1, EC230, EC2A0, EC302, ...), the same order LSE lists its course guides in. */
const byCodeAsc = (a: IndexEntry, b: IndexEntry) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0);

export interface SearchResult {
  items: IndexEntry[];
  /** true when nothing matched exactly and we fell back to typo-tolerant matching */
  fuzzy: boolean;
}

export function searchCourses(prepared: Prepared[], query: string): SearchResult {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { items: prepared.map((p) => p.c), fuzzy: false };

  // One code-like word ("ec", "ec2", "ma"): list every course whose code starts with it,
  // in code order, and nothing else. Falls through if no code starts with it ("econ", "game").
  if (tokens.length === 1 && /^[a-z]{1,3}\d?[a-z0-9]*$/.test(tokens[0])) {
    const t = tokens[0];
    const byCode = prepared
      .filter((p) => p.code.startsWith(t))
      .map((p) => p.c)
      .sort(byCodeAsc);
    if (byCode.length > 0) return { items: byCode, fuzzy: false };
  }

  const scored: { c: IndexEntry; score: number }[] = [];
  for (const p of prepared) {
    let total = 0;
    let ok = true;
    for (const t of tokens) {
      const s = scoreToken(p, t);
      if (s === 0) {
        ok = false; // every word must match something
        break;
      }
      total += s;
    }
    if (ok) scored.push({ c: p.c, score: total });
  }

  if (scored.length > 0) {
    scored.sort((a, b) => b.score - a.score || byCodeAsc(a.c, b.c));
    return { items: scored.map((s) => s.c), fuzzy: false };
  }

  // Nothing matched exactly: tolerate typos, but only on code and title.
  if (query.trim().length >= 3) {
    const fuse = new Fuse(prepared.map((p) => p.c), {
      keys: ["code", "title"],
      threshold: 0.3,
      ignoreLocation: true,
    });
    return { items: fuse.search(query.trim()).map((r) => r.item), fuzzy: true };
  }
  return { items: [], fuzzy: false };
}
