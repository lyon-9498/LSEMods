#!/usr/bin/env python3
"""
Turn scraped course JSON (from scrape_lse.py) into the data the website uses.

For every course it adds:
  prereqTree / coreqTree   structured AND/OR trees parsed from the requisite text
  prereqCheck              true when the text looks unusual and a human should check the tree
  preclusions              LSE "mutually exclusive options" (LSE's version of preclusions)
  unlocks                  courses that list this course as a prerequisite ("leads to")

Usage (from the project root):
    python pipeline/build_graph.py --data data --out public/data --contact you@example.com

Inputs : data/courses/*.json
Outputs: public/data/index.json, public/data/courses/<CODE>.json, public/data/meta.json
"""
import argparse
import json
import re
import sys
from datetime import date
from pathlib import Path

from bs4 import BeautifulSoup

from scrape_lse import allowed_by_robots, fetch, make_session

ME_URL = (
    "https://www.lse.ac.uk/resources/calendar{session}/programmeRegulations/"
    "undergraduate/{year}/Mutually_exclusive_options.htm"
)

CODE = r"[A-Z]{2,3}\d[A-Z0-9]{2,4}"
TOKEN_RE = re.compile(rf"\(|\)|,|\b(?:[Aa]nd|[Oo]r)\b|\b{CODE}\b")
NEGATION_RE = re.compile(r"\b(must not|cannot|can not|may not|not have|not be|unless|except)\b", re.I)


# --------------------------------------------------------------------------
# Requisite text -> AND/OR tree
# --------------------------------------------------------------------------
def tokenize(text: str) -> list:
    toks = []
    for m in TOKEN_RE.finditer(text):
        t = m.group(0)
        if t in ("(", ")", ","):
            toks.append(t)
        elif t.lower() in ("and", "or"):
            toks.append(t.lower())
        else:
            toks.append(("code", t))
    return toks


def resolve_commas(toks: list) -> list:
    """A comma takes on the next and/or in its list: 'A, B or C' -> 'A or B or C'."""
    out = list(toks)
    for i, t in enumerate(out):
        if t == ",":
            depth, op = 0, "and"
            for u in out[i + 1:]:
                if u == "(":
                    depth += 1
                elif u == ")":
                    if depth == 0:
                        break
                    depth -= 1
                elif depth == 0 and u in ("and", "or"):
                    op = u
                    break
            out[i] = op
    return out


def mk(kind: str, parts: list):
    flat = []
    for p in parts:
        if p is None:
            continue
        if p["type"] == kind:
            flat.extend(p["children"])
        else:
            flat.append(p)
    if not flat:
        return None
    if len(flat) == 1:
        return flat[0]
    return {"type": kind, "children": flat}


class Parser:
    def __init__(self, toks):
        self.t, self.i = toks, 0
        self.ambiguous = False
        self.had_and = False

    def peek(self):
        return self.t[self.i] if self.i < len(self.t) else None

    def factor(self):
        t = self.peek()
        if isinstance(t, tuple):
            self.i += 1
            return {"type": "course", "code": t[1]}
        if t == "(":
            self.i += 1
            n = self.expr()
            if self.peek() == ")":
                self.i += 1
            return n
        return None

    def term(self):
        parts = []
        while True:
            n = self.factor()
            if n:
                parts.append(n)
            t = self.peek()
            if t == "and":
                self.i += 1
                continue
            if isinstance(t, tuple) or t == "(":
                continue  # two operands side by side: treat as AND
            break
        self.had_and = len(parts) > 1
        return mk("and", parts)

    def expr(self):
        parts, any_and = [], False
        parts.append(self.term())
        any_and |= self.had_and
        n_or = 0
        while self.peek() == "or":
            self.i += 1
            nxt = self.term()
            if nxt is not None:  # ignore a dangling 'or' ("... or in the same year")
                n_or += 1
                any_and |= self.had_and
            parts.append(nxt)
        if n_or and any_and:
            self.ambiguous = True  # 'A or B and C' without brackets
        return mk("or", parts)


def parse_requisites(text: str | None):
    """Return (tree | None, needs_check: bool).

    Sentences that look like exclusions ("must not have taken X") are skipped, because
    their course codes are not prerequisites; the course is then flagged for checking.
    """
    if not text:
        return None, False
    needs_check = False
    nodes = []
    for sentence in re.split(r"(?<=[.;])\s+", text):
        if NEGATION_RE.search(sentence):
            needs_check = True
            continue
        toks = resolve_commas(tokenize(sentence))
        if not any(isinstance(t, tuple) for t in toks):
            continue
        p = Parser(toks)
        while p.i < len(toks):
            n = p.expr()
            if n:
                nodes.append(n)
            if p.i < len(toks) and p.peek() in (")", "or", "and"):
                p.i += 1  # stray token
        needs_check |= p.ambiguous
    return mk("and", nodes), needs_check


def codes_in(tree) -> list[str]:
    if not tree:
        return []
    if tree["type"] == "course":
        return [tree["code"]]
    out = []
    for c in tree["children"]:
        out.extend(codes_in(c))
    return out


# --------------------------------------------------------------------------
# Mutually exclusive options page -> preclusions
# --------------------------------------------------------------------------
ENTRY_RE = re.compile(rf"^({CODE})\s+(.*?)\s*(?:\(((?:Withdrawn|Suspended)[^)]*)\))?\s*$")


def cell_entries(cell) -> list[dict]:
    for br in cell.find_all("br"):
        br.replace_with("\n")
    entries = []
    for line in cell.get_text("").split("\n"):
        line = " ".join(line.split())
        m = ENTRY_RE.match(line)
        if m:
            entries.append({"code": m.group(1), "title": m.group(2), "note": m.group(3)})
    return entries


def parse_mutually_exclusive(html: str) -> dict[str, dict[str, dict]]:
    """Return {code: {other_code: {code, title, note}}}, symmetric."""
    soup = BeautifulSoup(html, "html.parser")
    info: dict[str, dict] = {}
    rel: dict[str, set] = {}
    for tr in soup.find_all("tr"):
        cells = tr.find_all("td")
        if len(cells) < 2:
            continue
        left, right = cell_entries(cells[0]), cell_entries(cells[1])
        if not left:
            continue
        a = left[0]
        info[a["code"]] = a
        for b in right:
            info.setdefault(b["code"], b)
            if b["note"] and not info[b["code"]].get("note"):
                info[b["code"]] = b
            rel.setdefault(a["code"], set()).add(b["code"])
            rel.setdefault(b["code"], set()).add(a["code"])
    return {
        code: {o: info[o] for o in sorted(others) if o != code}
        for code, others in rel.items()
    }


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------
def snippet(text: str | None, n: int = 280) -> str | None:
    if not text:
        return None
    return text if len(text) <= n else text[:n].rsplit(" ", 1)[0] + "…"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data", help="scraper output folder")
    ap.add_argument("--out", default="public/data", help="where the website reads data from")
    ap.add_argument("--session", default="2026-2027")
    ap.add_argument("--contact", default="your-email@example.com")
    ap.add_argument("--delay", type=float, default=1.0)
    args = ap.parse_args()

    data, out = Path(args.data), Path(args.out)
    files = sorted((data / "courses").glob("*.json"))
    if not files:
        sys.exit(f"No course files in {data}/courses. Run scrape_lse.py first.")
    courses = {json.loads(f.read_text("utf-8"))["code"]: json.loads(f.read_text("utf-8")) for f in files}
    print(f"Loaded {len(courses)} courses")

    # Preclusions
    preclusions: dict[str, dict] = {}
    s = make_session(args.contact)
    url = ME_URL.format(session=args.session, year=args.session.split("-")[0])
    try:
        if not allowed_by_robots(url, s.headers["User-Agent"]):
            raise RuntimeError("robots.txt disallows this page")
        html = fetch(s, url, data / "raw" / "_mutually_exclusive.html", args.delay)
        preclusions = parse_mutually_exclusive(html)
        print(f"Parsed preclusions for {len(preclusions)} courses")
    except Exception as e:
        print(f"WARNING: could not get mutually exclusive options ({e}); continuing without them")

    # Requisite trees
    unlocks: dict[str, set] = {}
    for c in courses.values():
        c["prereqTree"], chk1 = parse_requisites(c.get("prerequisites"))
        c["coreqTree"], chk2 = parse_requisites(c.get("corequisites"))
        c["prereqCheck"] = bool(chk1 or chk2)
        for pre in set(codes_in(c["prereqTree"])):
            unlocks.setdefault(pre, set()).add(c["code"])

    for code, c in courses.items():
        c["preclusions"] = list(preclusions.get(code, {}).values())
        c["unlocks"] = sorted(unlocks.get(code, []))

    # Write
    (out / "courses").mkdir(parents=True, exist_ok=True)
    for code, c in courses.items():
        (out / "courses" / f"{code}.json").write_text(json.dumps(c, ensure_ascii=False, indent=1), "utf-8")

    index = []
    for c in sorted(courses.values(), key=lambda x: x["code"]):
        index.append({
            "code": c["code"],
            "title": c["title"],
            "department": c.get("department"),
            "prefix": re.match(r"[A-Z]+", c["code"]).group(0),
            "units": c.get("units"),
            "terms": c.get("terms", []),
            "courseLevel": c.get("courseLevel"),
            "fheqLevel": c.get("fheqLevel"),
            "convenors": c.get("convenors", []),
            "assessment": c.get("assessment", []),
            "snippet": snippet(c.get("description")),
        })
    (out / "index.json").write_text(json.dumps(index, ensure_ascii=False), "utf-8")
    (out / "meta.json").write_text(json.dumps({
        "session": args.session.replace("-", "/"),
        "generated": date.today().isoformat(),
        "courseCount": len(index),
    }), "utf-8")
    flagged = sum(1 for c in courses.values() if c["prereqCheck"])
    print(f"Wrote {len(index)} courses to {out}/  ({flagged} prerequisite trees flagged for checking)")


if __name__ == "__main__":
    main()
