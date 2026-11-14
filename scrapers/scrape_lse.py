#!/usr/bin/env python3
"""
Scrape LSE's public Calendar course guides into JSON.

Usage:
    python scrape_lse.py                      # 2026/27 undergraduate, full run
    python scrape_lse.py --limit 20           # quick test run
    python scrape_lse.py --session 2026-2027 --contact you@lse.ac.uk

Output (./data):
    courses/<CODE>.json   one file per course
    index.json            slim list for client-side search (Fuse.js etc.)
    raw/<CODE>.html       cached HTML so re-parsing never re-hits LSE

Be polite: this sleeps between requests, caches everything, checks robots.txt,
and identifies itself. Read LSE's Terms of Use before publishing the data:
https://www.lse.ac.uk/lse-information/terms-of-use
"""
import argparse
import json
import re
import sys
import time
import urllib.robotparser
from datetime import date
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

BASE = "https://www.lse.ac.uk/resources/calendar{session}/courseGuides/"
INDEX_PAGES = {"undergraduate": "undergraduate.htm"}  # graduate index can be added later

# Section labels as they appear (bold) on a course guide page.
SECTIONS = [
    "Course convenor", "Teacher responsible", "Availability", "Requisites",
    "Course content", "Teaching", "Formative assessment", "Indicative reading",
    "Assessment", "Key facts", "Course selection videos",
    "Personal development skills", "Important information",
]
TERM_MAP = {"autumn": "AT", "winter": "WT", "spring": "ST", "summer": "SM"}


# --------------------------------------------------------------------------
# Parsing
# --------------------------------------------------------------------------
def page_to_lines(html: str) -> list[str]:
    soup = BeautifulSoup(html, "html.parser")
    for t in soup(["script", "style", "nav", "footer"]):
        t.decompose()
    main = soup.body or soup
    text = main.get_text("\n")
    lines = [re.sub(r"[ \t\u00a0]+", " ", l).strip() for l in text.splitlines()]
    return [l for l in lines if l]


def split_sections(lines: list[str]) -> dict[str, list[str]]:
    out, cur = {}, None
    for line in lines:
        label = next((s for s in SECTIONS if line.rstrip(":").lower() == s.lower()), None)
        if label:
            cur = label
            out.setdefault(cur, [])
        elif cur:
            out[cur].append(line)
    return out


# One assessment component: a capitalised name, then "(NN%" / "(NN.N%" and anything up to ")".
# e.g. "Exam (50%)", "Essay (65%, 2500 words)", "Presentation (7.5%)".
ASSESSMENT_RE = re.compile(r"([A-Z][A-Za-z0-9\-/ ]{1,60}?)\s*\((\d{1,3}(?:\.\d+)?)\s*%[^)]*\)")

_BAD_ASSESSMENT_NAME = re.compile(
    r"^(the |student |one |the other|other |these |this |autumn|winter|spring|wt |at |st |"
    r"summatively|programming project with|multi-media|digi-|group project|"
    r"research essay paper|data analysis assessment|quizzes|"
    r"participation grade|the participation|the continuous|the project|the group|"
    r"the course is|classroom|in person|assessed )",
    re.I,
)


def _assessment_name_quality(name: str) -> int:
    """Lower is better. Penalise narrative restatements the Calendar appends after the real list."""
    tl = name.lower().strip()
    score = 0
    if len(name) > 28:
        score += 3
    if _BAD_ASSESSMENT_NAME.search(tl):
        score += 8
    if " term" in tl or "week" in tl:
        score += 4
    return score


def _weight_value(raw):
    w = float(raw)
    return int(w) if abs(w - int(w)) < 1e-9 else w


def parse_assessment(lines):
    """Extract weights from Assessment text.

    LSE guides often list components once, then restate them in prose (sums to 200%).
    Prefer the earliest contiguous window whose weights sum to 100%.
    """
    text = " ".join(lines)
    items = []
    for m in ASSESSMENT_RE.finditer(text):
        name = m.group(1).strip()
        items.append(
            {
                "type": name[0].upper() + name[1:].lower(),
                "weight": _weight_value(m.group(2)),
            }
        )
    if not items:
        return []

    windows = []
    n = len(items)
    for i in range(n):
        total = 0.0
        for j in range(i, n):
            total += float(items[j]["weight"])
            if abs(total - 100) < 0.05:
                windows.append((i, items[i : j + 1]))
            if total > 100.05:
                break
    if not windows:
        return items

    def sort_key(w):
        start, part = w
        quality = sum(_assessment_name_quality(x["type"]) for x in part)
        # Prefer clean names, then the earliest listing, then the shortest window.
        return (quality, start, len(part))

    # Calendar pages often print "Exam (100%)" then restate the real split
    # ("essay 20% + exam 80%"). Prefer a multi-component 100% window when present.
    multi = [w for w in windows if len(w[1]) >= 2]
    lone100 = [
        w
        for w in windows
        if len(w[1]) == 1 and abs(float(w[1][0]["weight"]) - 100) < 0.05
    ]
    chosen = sorted(multi if multi and lone100 else windows, key=sort_key)[0][1]
    return [_tidy_assessment_item(x) for x in chosen]


def _tidy_assessment_item(item):
    """Normalise noisy restatement labels ("Exam in Spring term" → "Exam")."""
    t = item["type"].strip()
    tl = t.lower()
    if "essay" in tl:
        t = "Essay"
    elif re.match(r"^(e-)?exam\b", tl) or tl.startswith("exam "):
        t = "Exam"
    elif "presentation" in tl:
        t = "Presentation"
    elif "participation" in tl:
        t = "Course participation"
    elif tl.startswith("project") or " project" in tl:
        t = "Project"
    return {"type": t, "weight": item["weight"]}


def parse_key_facts(lines: list[str]) -> dict:
    facts = {}
    for l in lines:
        if ":" in l and not l.startswith("["):
            k, v = l.split(":", 1)
            facts[k.strip().lower()] = v.strip()
    return facts


def parse_terms(study_period: str) -> list[str]:
    s = (study_period or "").lower()
    return [code for word, code in TERM_MAP.items() if word in s]


def to_int(v):
    m = re.search(r"\d+", v or "")
    return int(m.group()) if m else None


def parse_course(html: str, url: str, session: str) -> dict | None:
    lines = page_to_lines(html)
    secs = split_sections(lines)

    # Heading looks like: "EC319 One Unit Games and Economic Behaviour".
    # Its pieces may be split across tags, so search heading tags with spaces
    # joined, then fall back to the whole page text.
    expected = re.search(r"_([A-Z0-9]+)\.htm$", url)
    expected = expected.group(1) if expected else r"[A-Z]{2,3}\d\w{2,4}"
    pat = re.compile(rf"(?:^|\s)({expected})\s+(?:(One|Half|Quarter)\s+Unit\s+)?(.+)$")
    soup_h = BeautifulSoup(html, "html.parser")
    candidates = [" ".join(h.get_text(" ").split()) for h in soup_h.find_all(["h1", "h2", "h3"])]
    candidates += [" ".join(l.split()) for l in lines]
    candidates.append(" ".join(" ".join(lines).split()))
    code = title = unit_word = None
    status = "running"
    for c in candidates:
        m = pat.search(c)
        if m and not re.fullmatch(r"(One|Half|Quarter)\s+Unit", m.group(3).strip()):
            code, unit_word, title = m.group(1), m.group(2), m.group(3).strip()
            status_m = re.search(r"(Suspended|Not available) in [\d/]+", c[: m.start(1)])
            status = status_m.group(1).lower().replace("not available", "unavailable") if status_m else "running"
            break
    if not code:
        seen = [c[:90] for c in candidates[:4]]
        raise ValueError(f"no heading starting with {expected}; saw: {seen}")
    if not code:
        return None

    facts = parse_key_facts(secs.get("Key facts", []))
    units = {"one": 1.0, "half": 0.5, "quarter": 0.25}.get((unit_word or "").lower())
    uv = (facts.get("unit value") or facts.get("value") or "").lower()
    if "non-credit" in uv or "zero" in uv or uv.strip() in ("0", "0.0"):
        units = 0.0  # skills courses such as GY101 ("Non-credit bearing")
    else:
        units = {"one unit": 1.0, "half unit": 0.5, "quarter unit": 0.25}.get(uv, units)

    requisites = "\n".join(secs.get("Requisites", []))
    prereq = None
    m = re.search(r"Pre-requisites?:\s*(.*?)(?:Co-requisites?:|Additional requisites?:|$)", requisites, re.S | re.I)
    if m:
        prereq = " ".join(m.group(1).split()) or None
    coreq = None
    m = re.search(r"Co-requisites?:\s*(.*?)(?:Additional requisites?:|$)", requisites, re.S | re.I)
    if m:
        coreq = " ".join(m.group(1).split()) or None
    additional = None
    m = re.search(r"Additional requisites?:\s*(.*)$", requisites, re.S | re.I)
    if m:
        additional = " ".join(m.group(1).split()) or None

    convenors = secs.get("Course convenor") or secs.get("Teacher responsible") or []
    availability = " ".join(secs.get("Availability", []))

    level_raw = facts.get("fheq level", "")
    level = to_int(level_raw)

    return {
        "code": code,
        "title": title,
        "status": status,
        "session": session.replace("-", "/"),
        "department": facts.get("department"),
        "units": units,
        "studyPeriod": facts.get("course study period"),
        "terms": parse_terms(facts.get("course study period", "")),
        "fheqLevel": level,
        "courseLevel": int(re.search(r"\d", code[2:]).group()) if re.search(r"\d", code[2:]) else None,
        "convenors": convenors,
        "prerequisites": prereq,
        "corequisites": coreq,
        "additionalRequisites": additional,
        "availability": availability or None,
        "description": " ".join(secs.get("Course content", [])) or None,
        "teaching": " ".join(secs.get("Teaching", [])) or None,
        "formativeAssessment": " ".join(secs.get("Formative assessment", [])) or None,
        "indicativeReading": secs.get("Indicative reading", []),
        "assessmentText": " ".join(secs.get("Assessment", [])) or None,
        "assessment": parse_assessment(secs.get("Assessment", [])),
        "skills": [l.lstrip("-•* ").strip() for l in secs.get("Personal development skills", []) if l.strip("-•* ")],
        "stats": {
            "totalStudentsPrevYear": to_int(next((v for k, v in facts.items() if k.startswith("total students")), None)),
            "avgClassSizePrevYear": to_int(next((v for k, v in facts.items() if k.startswith("average class size")), None)),
            "capped": next((v for k, v in facts.items() if k.startswith("capped")), None),
        },
        "sourceUrl": url,
        "lastScraped": date.today().isoformat(),
    }


# --------------------------------------------------------------------------
# Crawling
# --------------------------------------------------------------------------
def make_session(contact: str) -> requests.Session:
    s = requests.Session()
    s.headers["User-Agent"] = f"lse-course-catalogue-student-project (contact: {contact})"
    return s


def allowed_by_robots(url: str, ua: str) -> bool:
    rp = urllib.robotparser.RobotFileParser()
    rp.set_url("https://www.lse.ac.uk/robots.txt")
    try:
        rp.read()
        return rp.can_fetch(ua, url)
    except Exception:
        return True  # robots.txt unreachable; proceed cautiously


def fetch(s: requests.Session, url: str, cache: Path, delay: float) -> str:
    if cache.exists():
        return cache.read_text(encoding="utf-8")
    time.sleep(delay)
    r = s.get(url, timeout=30)
    r.raise_for_status()
    r.encoding = r.apparent_encoding or "utf-8"
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(r.text, encoding="utf-8")
    return r.text


def course_links(index_html: str, index_url: str) -> list[tuple[str, str]]:
    soup = BeautifulSoup(index_html, "html.parser")
    seen, out = set(), []
    for a in soup.find_all("a", href=True):
        if re.search(r"(?:^|/)[A-Z]{2}/\d{4}_[A-Z0-9]+\.htm$", a["href"]):
            url = urljoin(index_url, a["href"])
            if url not in seen:
                seen.add(url)
                out.append((url, a.get_text(" ", strip=True)))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--session", default="2026-2027")
    ap.add_argument("--level", default="undergraduate", choices=INDEX_PAGES)
    ap.add_argument("--out", default="data")
    ap.add_argument("--delay", type=float, default=1.0, help="seconds between requests")
    ap.add_argument("--limit", type=int, default=0, help="only scrape first N courses")
    ap.add_argument("--contact", default="your-email@example.com")
    args = ap.parse_args()

    out = Path(args.out)
    (out / "courses").mkdir(parents=True, exist_ok=True)
    s = make_session(args.contact)
    base = BASE.format(session=args.session)
    index_url = base + INDEX_PAGES[args.level]

    if not allowed_by_robots(base, s.headers["User-Agent"]):
        sys.exit("robots.txt disallows this path; stopping.")

    index_html = fetch(s, index_url, out / "raw" / f"_index_{args.level}.html", args.delay)
    links = course_links(index_html, index_url)
    if args.limit:
        links = links[: args.limit]
    print(f"Found {len(links)} course links")

    courses, failures, skipped = [], [], []
    for i, (url, label) in enumerate(links, 1):
        code_guess = label.split()[0] if label else url.rsplit("_", 1)[-1][:-4]
        try:
            html = fetch(s, url, out / "raw" / f"{code_guess}.html", args.delay)
            course = parse_course(html, url, args.session)
            if not course:
                raise ValueError("could not parse heading")
            if course["status"] != "running":
                skipped.append(course["code"])
                print(f"[{i}/{len(links)}] {course['code']} skipped ({course['status']})")
                continue
            (out / "courses" / f"{course['code']}.json").write_text(
                json.dumps(course, indent=2, ensure_ascii=False), encoding="utf-8")
            courses.append(course)
            print(f"[{i}/{len(links)}] {course['code']} ok")
        except Exception as e:
            failures.append({"url": url, "error": str(e)})
            print(f"[{i}/{len(links)}] {code_guess} FAILED: {e}")

    slim = [
        {k: c[k] for k in ("code", "title", "department", "units", "terms", "fheqLevel", "courseLevel")}
        | {"assessment": c["assessment"]}
        for c in courses
    ]
    (out / "index.json").write_text(json.dumps(slim, ensure_ascii=False), encoding="utf-8")
    (out / "failures.json").write_text(json.dumps(failures, indent=2), encoding="utf-8")
    print(f"Done: {len(courses)} parsed, {len(skipped)} skipped (suspended), {len(failures)} failed -> {out}/")


if __name__ == "__main__":
    main()
