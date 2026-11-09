#!/usr/bin/env python3
"""
Scrape LSE undergraduate programme regulations (one page per degree and start year) so the planner can
pre-fill compulsory courses and show the choices each degree requires.

Usage (from the project root, after scrape_lse.py and build_graph.py):
    python pipeline/scrape_programmes.py --contact you@example.com
    python pipeline/scrape_programmes.py --limit 3 --contact you@example.com     # quick test

Output:
    public/data/programmes/index.json          list of degrees (per start year)
    public/data/programmes/<id>.json           one file per degree and start year
Cache:
    data/raw/programmes/                        downloaded pages (re-runs don't re-download)

What it does with each page:
- reads the regulations table year by year and paper by paper
- "compulsory": courses listed before any choice wording, in papers without (OR)/If alternatives
- everything else becomes a choice: the paper's wording, the courses it names, and any named lists
  ("Year 1 options list", "Government List B", ...) which are read from the same page
Anything it can't read confidently is left as text for the student, never guessed.
"""
import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from scrape_lse import allowed_by_robots, fetch, make_session

INDEX_URL = "https://www.lse.ac.uk/resources/calendar{session}/programmeRegulations/undergraduate/{cohort}/Default.htm"
SKIP_PAGES = {"default.htm", "mutually_exclusive_options.htm"}

CODE = r"[A-Z]{2,3}\d[A-Z0-9]{2,4}"
COURSE_LINK = re.compile(rf"courseGuides/[A-Z]{{2,3}}/\d{{4}}_({CODE})\.htm", re.I)
TOKEN = re.compile(rf"\u27e6({CODE})\u27e7")  # ⟦CODE⟧ marks a linked course in a line

# Wording that turns a paper (from that line on) into a choice
CHOICE_RE = re.compile(
    r"one of|either|from the following|to the value of|options? list|selection list|\blist\b|"
    r"\(or\)|^or\b|\bif\b|subject to approval|\bchoose\b|\bselect\b",
    re.I,
)
# Wording that means a paper lets you take an outside option
OUTSIDE_TEXT = re.compile(r"outside options? list|outside option|taught outside the department|outside paper", re.I)

# If the first choice line of a paper starts like this, the whole paper is a set of alternatives
# ("GV390 ... / (OR) courses from ...", "If ST107 was taken under Paper 1, then ..."), so nothing in it
# can be auto-filled. An OR that comes later ("And either: X / OR one course from ...") only splits the choice.
ALTERNATIVES_START = re.compile(r"^\(?or\b\)?|^\(?if\b", re.I)


# --------------------------------------------------------------------------
# Cell -> lines with linked course codes
# --------------------------------------------------------------------------
def cell_lines(cell) -> list[dict]:
    """Split a table cell into lines; each line keeps its text and the course codes linked in it."""
    cell = BeautifulSoup(str(cell), "html.parser")  # work on a copy
    for a in cell.find_all("a"):
        href = a.get("href", "")
        m = COURSE_LINK.search(href)
        if m:
            a.replace_with(f"\u27e6{m.group(1).upper()}\u27e7")
        elif href.startswith("#"):
            a.replace_with("")  # footnote markers like "#"
    for br in cell.find_all("br"):
        br.replace_with("\n")
    for block in cell.find_all(["p", "div", "li", "tr"]):
        block.insert_before("\n")
        block.insert_after("\n")

    lines = []
    for raw in cell.get_text("").split("\n"):
        raw = " ".join(raw.split())
        if not raw:
            continue
        codes, suspended = [], []
        parts = TOKEN.split(raw)  # text, code, text, code, text ...
        for i in range(1, len(parts), 2):
            codes.append(parts[i])
            if "suspended" in parts[i + 1].lower():
                suspended.append(parts[i])
        text = TOKEN.sub(lambda m: m.group(1), raw)
        lines.append({"text": text, "codes": codes, "suspended": suspended})
    return lines


def is_footnote_letters(text: str) -> bool:
    return bool(re.fullmatch(r"([A-Z]\s*)+", text))


# --------------------------------------------------------------------------
# Page -> programme
# --------------------------------------------------------------------------
def norm(s: str) -> str:
    return " ".join(s.lower().replace("\u2019", "'").split()).rstrip(":")


def parse_lists(soup) -> dict[str, list[str]]:
    """Named course lists under headings further down the page (e.g. 'Year 1 options list')."""
    lists: dict[str, list[str]] = {}
    for h in soup.find_all(["h2", "h3", "h4"]):
        name = " ".join(h.get_text(" ").split())
        if not name or norm(name).startswith("footnote"):
            continue
        codes = []
        for sib in h.find_next_siblings():
            if sib.name in ("h2", "h3", "h4"):
                break
            for a in sib.find_all("a", href=True) if hasattr(sib, "find_all") else []:
                m = COURSE_LINK.search(a["href"])
                if not m:
                    continue
                row = a.find_parent(["tr", "li", "p"]) or a.parent
                if "suspended" in row.get_text(" ").lower():
                    continue
                code = m.group(1).upper()
                if code not in codes:
                    codes.append(code)
        if codes:
            lists[name] = codes
    return lists


def find_main_table(soup):
    for table in soup.find_all("table"):
        for tr in table.find_all("tr"):
            cells = tr.find_all(["td", "th"])
            if cells and re.match(r"^\s*Year\s+\d", cells[0].get_text(" ")):
                return table
    return None


def parse_programme(html: str) -> dict | None:
    soup = BeautifulSoup(html, "html.parser")
    table = find_main_table(soup)
    if table is None:
        return None

    title_el = soup.find("h2") or soup.find("h1")
    name = " ".join(title_el.get_text(" ").split()) if title_el else ""
    page_text = soup.get_text(" ")
    code_m = re.search(r"Programme Code:\s*([A-Z0-9]+)", page_text)
    dept_m = re.search(r"Department:\s*([^\n]+?)\s{2,}|Department:\s*(.+?)\s+For students", page_text)
    department = None
    if dept_m:
        department = (dept_m.group(1) or dept_m.group(2) or "").strip() or None

    lists = parse_lists(soup)
    list_names = {norm(n): n for n in lists}

    # Walk the table: "Year N" rows start a year; a label in the first cell starts a paper;
    # rows with an empty first cell continue the current paper.
    years: dict[int, list[dict]] = {}
    year = None
    paper = None
    for tr in table.find_all("tr"):
        cells = tr.find_all(["td", "th"])
        if not cells:
            continue
        label = " ".join(cells[0].get_text(" ").split())
        ym = re.match(r"^Year\s+(\d)", label)
        if ym:
            year = int(ym.group(1))
            years.setdefault(year, [])
            paper = None
            continue
        if year is None:
            continue
        if label:
            paper = {"label": label, "lines": []}
            years[year].append(paper)
        if paper is None:
            continue
        for cell in cells[1:]:
            paper["lines"].extend(cell_lines(cell))

    out_years = []
    warnings = []
    for y in sorted(years):
        papers = []
        for p in years[y]:
            done = summarise_paper(p, list_names, lists)
            if done:
                papers.append(done)
        out_years.append({"year": y, "papers": papers})

    if not any(y["papers"] for y in out_years):
        warnings.append("No papers could be read from the regulations table.")

    referenced = {n for y in out_years for p in y["papers"] for n in p["lists"]}
    return {
        "name": name,
        "code": code_m.group(1) if code_m else None,
        "department": department,
        "years": out_years,
        "lists": {n: c for n, c in lists.items() if n in referenced},
        "warnings": warnings,
    }


def summarise_paper(p: dict, list_names: dict[str, str], lists: dict[str, list[str]]) -> dict | None:
    lines = [l for l in p["lines"] if not is_footnote_letters(l["text"])]
    if not lines:
        return None

    first_choice = next((i for i, l in enumerate(lines) if CHOICE_RE.search(l["text"]) and norm(l["text"]) not in list_names), None)
    alternatives = first_choice is not None and bool(ALTERNATIVES_START.search(lines[first_choice]["text"]))

    compulsory: list[str] = []
    options: list[str] = []
    referenced: list[str] = []
    for i, l in enumerate(lines):
        if norm(l["text"]) in list_names:
            name = list_names[norm(l["text"])]
            if name not in referenced:
                referenced.append(name)
            continue
        if i == first_choice:
            # codes on the instruction line itself are notes ("FM210 cannot be combined with FM214")
            continue
        usable = [c for c in l["codes"] if c not in l["suspended"]]
        if not alternatives and (first_choice is None or i < first_choice):
            compulsory += [c for c in usable if c not in compulsory]
        else:
            options += [c for c in usable if c not in options and c not in compulsory]

    # Named lists can also be mentioned inside an instruction ("one 0.5 unit course from the Year 1 options list")
    for l in lines:
        t = norm(l["text"])
        for key, name in list_names.items():
            if key in t and name not in referenced:
                referenced.append(name)

    values = set()
    for l in lines:
        for m in re.finditer(r"value of\s*([\d.]+)\s*unit", l["text"], re.I):
            values.add(float(m.group(1)))
        for m in re.finditer(r"\bone\s+([\d.]+)\s*unit", l["text"], re.I):
            values.add(float(m.group(1)))
    units_needed = values.pop() if len(values) == 1 and not alternatives else None
    pick_one = units_needed is None and not alternatives and any(
        re.search(r"one of|either", l["text"], re.I) for l in lines
    )

    # Does this paper let you take an outside option, and is that normal or only "in exceptional circumstances"?
    mentions_outside = any(OUTSIDE_TEXT.search(n) for n in referenced) or any(OUTSIDE_TEXT.search(l["text"]) for l in lines)
    outside = None
    if mentions_outside:
        outside = "exceptional" if any(re.search(r"exceptional", l["text"], re.I) for l in lines) else "allowed"

    is_choice = bool(options or referenced or alternatives or first_choice is not None)
    if not compulsory and not is_choice:
        return None  # notes-only rows

    return {
        "label": p["label"],
        "lines": [l["text"] for l in lines],
        "compulsory": compulsory,
        "choice": is_choice,
        "options": options,
        "lists": referenced,
        "unitsNeeded": units_needed,
        "pickOne": pick_one,
        "alternatives": alternatives,
        "outside": outside,
    }


# --------------------------------------------------------------------------
# Crawl
# --------------------------------------------------------------------------
def programme_links(index_html: str, index_url: str, cohort: int) -> list[str]:
    soup = BeautifulSoup(index_html, "html.parser")
    out = []
    folder = f"/programmeRegulations/undergraduate/{cohort}/"
    for a in soup.find_all("a", href=True):
        url = urljoin(index_url, a["href"]).split("#")[0].split("?")[0]
        if folder not in url or not url.endswith(".htm"):
            continue
        page = url.rsplit("/", 1)[-1]
        if page.lower() in SKIP_PAGES or url in out:
            continue
        out.append(url)
    return out


OUTSIDE_Y1 = re.compile(r"outside options list \(year 1\)", re.I)
OUTSIDE_Y23 = re.compile(r"outside options list \(years? 2", re.I)


def shared_lists(progs: list[dict]) -> dict:
    """
    Compare every degree's copy of each named list, per start year.

    - The two outside options lists are always kept (union of all copies, so nothing approved anywhere is
      missed); any differences between copies are reported.
    - Other lists (e.g. "Economics Selection List", "Government List B", "Language Courses") are shared
      when at least two degrees use them and every copy is identical. Lists that differ between degrees
      ("Year 1 options list", "Paper 10 options list") are programme-specific and stay in each degree's file.
    """
    by_cohort = defaultdict(list)
    for p in progs:
        by_cohort[p["cohort"]].append(p)

    out = {}
    for cohort, ps in sorted(by_cohort.items()):
        copies = defaultdict(list)  # name -> [(codes, programme id)]
        for p in ps:
            for name, codes in p["lists"].items():
                copies[name].append((tuple(sorted(codes)), p["id"]))

        outside1: list[str] = []
        outside23: list[str] = []
        lists, mismatches = {}, []
        for name, cs in sorted(copies.items()):
            versions = Counter(c for c, _ in cs)
            common = versions.most_common(1)[0][0]
            is_outside = bool(OUTSIDE_Y1.search(name) or OUTSIDE_Y23.search(name))
            if len(versions) > 1:
                mismatches.append({
                    "name": name, "versions": len(versions), "programmes": len(cs),
                    "differing": sorted(pid for c, pid in cs if c != common),
                })
            if is_outside:
                union = sorted({code for v in versions for code in v})
                if OUTSIDE_Y1.search(name):
                    outside1 = sorted(set(outside1) | set(union))
                else:
                    outside23 = sorted(set(outside23) | set(union))
            elif len(cs) >= 2 and len(versions) == 1:
                lists[name] = {"codes": list(common), "usedBy": sorted(pid for _, pid in cs)}
        out[str(cohort)] = {
            "outsideYear1": outside1, "outsideYears23": outside23, "lists": lists, "mismatches": mismatches,
        }
    return out


def report_lists(shared: dict) -> None:
    for cohort, d in shared.items():
        print(f"\n[{cohort}] outside options: Year 1 = {len(d['outsideYear1'])} courses, "
              f"Years 2 & 3 = {len(d['outsideYears23'])} courses")
        outside_diffs = [m for m in d["mismatches"] if OUTSIDE_Y1.search(m["name"]) or OUTSIDE_Y23.search(m["name"])]
        if outside_diffs:
            for m in outside_diffs:
                print(f"  ! '{m['name']}' differs between degrees: {m['versions']} versions across "
                      f"{m['programmes']} degrees (odd ones out: {', '.join(m['differing'][:6])}"
                      f"{'…' if len(m['differing']) > 6 else ''})")
        else:
            print("  every degree's copy of the outside options lists is identical")
        print(f"  shared subject lists: {', '.join(d['lists']) or 'none'}")


def slug(s: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "", s)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--session", default="2026-2027")
    ap.add_argument("--cohorts", type=int, nargs="*", help="start years to fetch (default: the last three)")
    ap.add_argument("--out", default="public/data/programmes")
    ap.add_argument("--cache", default="data/raw/programmes")
    ap.add_argument("--delay", type=float, default=1.0)
    ap.add_argument("--limit", type=int, default=0, help="only fetch the first N degrees per start year")
    ap.add_argument("--contact", default="your-email@example.com")
    args = ap.parse_args()

    first = int(args.session.split("-")[0])
    cohorts = args.cohorts or [first, first - 1, first - 2]
    out, cache = Path(args.out), Path(args.cache)
    out.mkdir(parents=True, exist_ok=True)
    s = make_session(args.contact)

    summary, problems, progs = [], [], []
    for cohort in cohorts:
        index_url = INDEX_URL.format(session=args.session, cohort=cohort)
        if not allowed_by_robots(index_url, s.headers["User-Agent"]):
            sys.exit("robots.txt disallows the regulations pages; stopping.")
        try:
            index_html = fetch(s, index_url, cache / f"_index_{cohort}.html", args.delay)
        except Exception as e:
            print(f"[{cohort}] could not read the list of degrees: {e}")
            continue
        links = programme_links(index_html, index_url, cohort)
        if args.limit:
            links = links[: args.limit]
        print(f"[{cohort}] {len(links)} programme pages")

        for i, url in enumerate(links, 1):
            stem = url.rsplit("/", 1)[-1][:-4]
            pid = f"{cohort}-{slug(stem)}"
            try:
                html = fetch(s, url, cache / f"{pid}.html", args.delay)
                prog = parse_programme(html)
            except Exception as e:
                problems.append({"url": url, "error": str(e)})
                print(f"  [{i}/{len(links)}] {stem} FAILED: {e}")
                continue
            if prog is None:
                print(f"  [{i}/{len(links)}] {stem} skipped (no regulations table)")
                continue
            prog.update({"id": pid, "cohort": cohort, "url": url})
            progs.append(prog)
            (out / f"{pid}.json").write_text(json.dumps(prog, ensure_ascii=False, indent=1), "utf-8")
            n_comp = sum(len(p["compulsory"]) for y in prog["years"] for p in y["papers"])
            n_choice = sum(1 for y in prog["years"] for p in y["papers"] if p["choice"])
            summary.append({
                "id": pid, "cohort": cohort, "name": prog["name"] or stem, "code": prog["code"],
                "department": prog["department"], "url": url,
                "years": len(prog["years"]), "compulsory": n_comp, "choices": n_choice,
            })
            note = f" ({'; '.join(prog['warnings'])})" if prog["warnings"] else ""
            print(f"  [{i}/{len(links)}] {prog['name'] or stem}: {n_comp} compulsory, {n_choice} choices{note}")

    summary.sort(key=lambda p: (-p["cohort"], p["name"]))
    (out / "index.json").write_text(json.dumps(summary, ensure_ascii=False), "utf-8")
    (out / "_failures.json").write_text(json.dumps(problems, indent=1), "utf-8")
    shared = shared_lists(progs)
    (out / "lists.json").write_text(json.dumps(shared, ensure_ascii=False), "utf-8")
    report_lists(shared)
    print(f"\nDone: {len(summary)} degrees written to {out}/ ({len(problems)} failed), shared lists in {out}/lists.json")


if __name__ == "__main__":
    main()
