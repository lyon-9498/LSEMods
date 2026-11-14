/**
 * Historical DS* methodology codes were recoded to MY* (C26).
 * Treat DS codes as aliases of the matching MY codes when matching plans/slots.
 */
const DS_TO_MY: Record<string, string> = {
  DS101: "MY101A",
  DS101A: "MY101A",
  DS101W: "MY101W",
  DS105: "MY105A",
  DS105A: "MY105A",
  DS105W: "MY105W",
  DS202: "MY202A",
  DS202A: "MY202A",
  DS202W: "MY202W",
  DS205: "MY205",
};

const LSE100_VARIANTS = new Set(["LSE100", "LSE100A", "LSE100B", "LSE100C"]);

/** Canonical catalogue code (DS → MY; LSE100A/B/C → LSE100). */
export function canonicalCode(code: string): string {
  const c = code.trim().toUpperCase();
  if (LSE100_VARIANTS.has(c)) return "LSE100";
  return DS_TO_MY[c] ?? c;
}

/** True if two codes refer to the same course after aliasing. */
export function codesMatch(a: string, b: string): boolean {
  return canonicalCode(a) === canonicalCode(b);
}

/** All spellings that should resolve to the same course. */
export function codeAliases(code: string): string[] {
  const canon = canonicalCode(code);
  const out = new Set<string>([canon, code.trim().toUpperCase()]);
  if (canon === "LSE100") {
    for (const v of LSE100_VARIANTS) out.add(v);
  }
  for (const [ds, my] of Object.entries(DS_TO_MY)) {
    if (my === canon || ds === canon) {
      out.add(ds);
      out.add(my);
    }
  }
  return [...out];
}
