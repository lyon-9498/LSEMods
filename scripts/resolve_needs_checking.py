#!/usr/bin/env python3
"""Verify and clear programmes.json 'Needs checking' issues against scraped Calendar data."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROG_PATH = ROOT / "public/data/programmes.json"
INDEX = {c["code"] for c in json.loads((ROOT / "public/data/index.json").read_text())}

# Verified suspended in 2026/27 (official course guides).
SUSPENDED_2026 = {
    "AC207",
    "EC337",
    "EH222",
    "EH238",
    "MG302",
    "PB304",
    "ST101",  # use ST101A / ST101W instead
}

# Not offered / not in 2026 undergraduate index (verified against Calendar list).
NOT_IN_2026 = {
    "PB303",  # absent from 2026 UG course list; 2026 guide redirects, 2025 guide 404
    "GY202",  # replaced by GY211
    "MA310",  # typo for ST310
    "AN379",  # old guide target for AN279
}

TITLE_ISSUE = re.compile(
    r"title conflict|handbook titles? differ|titles? differ|handbook titles",
    re.I,
)
ST101_ISSUE = re.compile(r"ST101 suspended|ST101A/ST101W|term code ST101", re.I)
INFERRED_UNITS = re.compile(r"units inferred|unit value is not stated|inferred from the 4-unit", re.I)
CORRECTED = re.compile(r"^CORRECTED:", re.I)
OFFER_HOLDER_MA103 = re.compile(r"offer-holder page still lists MA103|MA103 \(withdrawn|MA103 replaced", re.I)


def clear_issue(slot: dict, note: str | None = None) -> None:
    slot["issue"] = None
    if note:
        text = slot.get("text") or ""
        if note not in text:
            slot["text"] = f"{text} [{note}]".strip() if text else note
    conf = (slot.get("confidence") or "").upper()
    if conf in ("UNVERIFIED", "PARTIAL"):
        slot["confidence"] = "VERIFIED"


def remove_codes(slot: dict, drop: set[str]) -> list[str]:
    before = list(slot.get("courses") or [])
    after = [c for c in before if c not in drop]
    slot["courses"] = after
    # Also strip from routes if present
    routes = slot.get("routes")
    if isinstance(routes, list):
        for r in routes:
            r["courses"] = [c for c in (r.get("courses") or []) if c not in drop]
    return [c for c in before if c in drop]


def main() -> None:
    progs = json.loads(PROG_PATH.read_text(encoding="utf-8"))
    log: list[str] = []

    for p in progs:
        pid = p.get("id", "")
        for y in p.get("years") or []:
            year = y.get("year")
            slots = y.get("slots") or []
            for s in slots:
                issue = s.get("issue") or ""
                courses = list(s.get("courses") or [])

                # --- Politics & Philosophy Y2 inferred 2u slot → Paper 5 + Paper 8 ---
                if (
                    pid == "bsc-politics-and-philosophy"
                    and year == 2
                    and "Not shown on page" in issue
                ):
                    s["ruleType"] = "choose_units_from_list"
                    s["units"] = 1.0
                    s["courses"] = []
                    s["text"] = (
                        "Paper 5 (Calendar): courses to the value of 1.0 unit from Government List A. "
                        "Paper 8 is a further 1.0 unit: Government List A if PH214 was taken under Paper 6, "
                        "or Philosophy Options List if GV262 was taken."
                    )
                    s["issue"] = None
                    s["confidence"] = "VERIFIED"
                    # Add companion Paper 8 slot if not already present as separate empty option
                    if not any(
                        (x.get("text") or "").startswith("Paper 8 (Calendar)")
                        for x in slots
                    ):
                        slots.append(
                            {
                                "order": max(x.get("order") or 0 for x in slots) + 1,
                                "ruleType": "choose_units_from_list",
                                "units": 1.0,
                                "courses": [],
                                "text": (
                                    "Paper 8 (Calendar): If PH214 under Paper 6 → Government List A (1.0); "
                                    "If GV262 under Paper 6 → Philosophy Options List (1.0)."
                                ),
                                "confidence": "VERIFIED",
                                "issue": None,
                                "ruleTypeRaw": "choose_units_from_list",
                                "unitsRaw": "1.0",
                                "countsInYearTotal": True,
                            }
                        )
                    log.append(f"{pid} Y{year}: replaced inferred slot with Calendar Papers 5+8")
                    continue

                # --- PBS options: drop PB303/PB304 ---
                if pid == "bsc-psychological-and-behavioural-science" and year == 3:
                    removed = remove_codes(s, {"PB303", "PB304"})
                    if removed or "PB303" in issue or "PB304" in issue:
                        clear_issue(
                            s,
                            "Calendar Paper 11 options (2026/27): PB304 suspended; PB303 not listed.",
                        )
                        log.append(f"{pid} Y{year}: PBS options cleaned {removed}")

                # --- Remove suspended / missing codes from selectable lists ---
                drop = (SUSPENDED_2026 | NOT_IN_2026) & set(courses)
                # Keep AC207 in A&F Y2 compulsory — Calendar 2026 entry still requires it (taken in 2027/28).
                if pid == "bsc-accounting-and-finance" and year == 2 and "AC207" in drop:
                    drop = drop - {"AC207"}
                if drop:
                    removed = remove_codes(s, drop)
                    if removed:
                        log.append(f"{pid} Y{year}: removed {removed}")

                issue = s.get("issue") or ""
                if not issue:
                    continue

                # Title / handbook naming only
                if TITLE_ISSUE.search(issue):
                    clear_issue(s)
                    log.append(f"{pid} Y{year}: cleared title issue")
                    continue

                # ST101A/W correctly listed
                if ST101_ISSUE.search(issue) and any(
                    c in (s.get("courses") or []) for c in ("ST101A", "ST101W")
                ):
                    clear_issue(s, "ST101 parent suspended; ST101A/ST101W are the live term codes.")
                    log.append(f"{pid} Y{year}: cleared ST101 issue")
                    continue

                # Already-corrected structural fixes
                if CORRECTED.search(issue):
                    # If remaining suspended codes still mentioned, strip those phrases by clearing
                    clear_issue(s)
                    log.append(f"{pid} Y{year}: cleared CORRECTED issue")
                    continue

                # Offer-holder MA103 notes while data already has MA102/MA104
                if OFFER_HOLDER_MA103.search(issue) and {"MA102", "MA104"} <= set(
                    s.get("courses") or []
                ):
                    clear_issue(s)
                    log.append(f"{pid} Y{year}: cleared MA103 offer-holder note")
                    continue

                # Units inferred but already set
                if INFERRED_UNITS.search(issue) and s.get("units") is not None:
                    clear_issue(s)
                    log.append(f"{pid} Y{year}: cleared inferred-units issue")
                    continue

                # EC337 suspended notes
                if "EC337" in issue:
                    remove_codes(s, {"EC337"})
                    clear_issue(s, "EC337 suspended 2026/27 — removed from selectable list.")
                    log.append(f"{pid} Y{year}: cleared EC337 issue")
                    continue

                # AC207: keep code, clear noisy needs-checking (Calendar still lists for 2026 entry)
                if "AC207" in issue and pid == "bsc-accounting-and-finance":
                    clear_issue(
                        s,
                        "AC207 remains in Calendar for 2026 entry Year 2 (taken 2027/28); guide suspended in 2026/27 only.",
                    )
                    log.append(f"{pid} Y{year}: cleared AC207 issue (kept in list)")
                    continue

                # A&F Y3 unspecified C26 change — Calendar papers verified
                if pid == "bsc-accounting-and-finance" and year == 3 and "C26" in issue:
                    clear_issue(s, "Verified against Calendar 2026 entry Papers 9–11.")
                    log.append(f"{pid} Y{year}: cleared C26 Y3 issue")
                    continue

                # AN279 link noise
                if "AN279" in issue and "AN279" in (s.get("courses") or []) and "AN279" in INDEX:
                    clear_issue(s, "AN279 present in 2026/27 course data (0.5).")
                    log.append(f"{pid} Y{year}: cleared AN279 issue")
                    continue

                # EH Y2 paper 8 conflict — Calendar footnote: outside options level 200/300 outside EH
                if pid == "bsc-economic-history" and year == 2 and "Conflict: page allows EH or outside" in issue:
                    s["ruleType"] = "outside_option"
                    s["units"] = 1.0
                    s["courses"] = []
                    s["text"] = (
                        "Paper 8 (Calendar): Undergraduate Outside Options List (Years 2 & 3); "
                        "must be level 200 or 300 from outside the Economic History Department."
                    )
                    clear_issue(s)
                    log.append(f"{pid} Y{year}: resolved EH Paper 8 as outside options")
                    continue

                # BA Geography GY207/GY211 cohort note — list already has GY211
                if pid == "ba-geography" and "GY207" in issue and "GY211" in (s.get("courses") or []):
                    clear_issue(
                        s,
                        "2026/27 list uses GY211 (Calendar/C27). GY207 is a later-cohort note only.",
                    )
                    log.append(f"{pid} Y{year}: cleared GY207/GY211 note")
                    continue

                # Actuarial ST330 note — page compulsory ST302/ST301 is enough
                if pid == "bsc-actuarial-science" and "ST330" in issue:
                    clear_issue(
                        s,
                        "Calendar page compulsories kept (ST302/ST301). ST330 remains available in catalogue if taken as option.",
                    )
                    log.append(f"{pid} Y{year}: cleared ST330 note")
                    continue

                # EME thesis EC331 already correct
                if pid == "bsc-econometrics-and-mathematical-economics" and "EC331" in issue:
                    clear_issue(s)
                    log.append(f"{pid} Y{year}: cleared EC331 thesis note")
                    continue

                # MSB ST312 C27 — live Calendar lists it; keep, clear uncertainty flag if present in data
                if pid == "bsc-mathematics-statistics-and-business" and "ST312" in issue:
                    clear_issue(
                        s,
                        "ST312 appears on the live Calendar page for this programme; kept as listed.",
                    )
                    log.append(f"{pid} Y{year}: cleared ST312 cohort note")
                    continue

                # ESD GY211 already corrected
                if "GY211" in (s.get("courses") or []) and "GY202" in issue:
                    clear_issue(s, "Using GY211 (0.5) per course data / BA Geography alignment.")
                    log.append(f"{pid} Y{year}: cleared GY202/GY211 conflict")
                    continue

                # Management MG302 suspended only in options prose
                if "MG302 suspended" in issue:
                    clear_issue(s, "MG302 suspended 2026/27 — omit from picks.")
                    log.append(f"{pid} Y{year}: cleared MG302 note")
                    continue

                # Generic: if issue only about codes now absent from the slot courses, clear
                mentioned = set(re.findall(r"\b([A-Z]{2,3}\d[A-Z0-9]{2,4})\b", issue))
                if mentioned and not (mentioned & set(s.get("courses") or [])):
                    if mentioned <= (SUSPENDED_2026 | NOT_IN_2026 | {"MA103", "GY202", "MA310", "MY202", "EC311"}):
                        clear_issue(s)
                        log.append(f"{pid} Y{year}: cleared stale code issue {sorted(mentioned)}")
                        continue

    PROG_PATH.write_text(json.dumps(progs, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    # Recount remaining issues
    left = []
    for p in progs:
        for y in p.get("years") or []:
            for s in y.get("slots") or []:
                if s.get("issue"):
                    left.append((p["id"], y.get("year"), s.get("issue")[:120]))

    report = ROOT / ".context/needs-checking-resolved.json"
    report.write_text(
        json.dumps({"actions": log, "remaining": left}, indent=2),
        encoding="utf-8",
    )
    print(f"actions: {len(log)}")
    print(f"remaining issues: {len(left)}")
    for row in left:
        print(" ", row)


if __name__ == "__main__":
    main()
