const ALLOWED_HOSTS = new Set([
  "www.lse.ac.uk",
  "lse.ac.uk",
  "info.lse.ac.uk",
  "www.lsesu.com",
  "lsesu.com",
]);

/** Only allow safe https links from known scraped hosts. */
export function safeHttpsUrl(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase();
    if (
      !ALLOWED_HOSTS.has(host) &&
      !host.endsWith(".lse.ac.uk") &&
      !host.endsWith(".lsesu.com")
    ) {
      return null;
    }
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Programme ids are kebab slugs from programmes.json (e.g. bsc-finance),
 * or legacy scraped ids like 2026-BScEconomics.
 */
export const PROGRAMME_ID_RE =
  /^(?:\d{4}-[A-Za-z][A-Za-z0-9-]{0,120}|[a-z][a-z0-9-]{2,120})$/;

export function isValidProgrammeId(id: string): boolean {
  return PROGRAMME_ID_RE.test(id) && !id.includes("..") && !id.includes("/") && !id.includes("\\");
}
