/**
 * Site settings. Only non-secret NEXT_PUBLIC_* values.
 * Env overrides are allowlisted so a bad deploy env cannot inject scripts/links.
 */

const DISQUS_RE = /^[a-z0-9][a-z0-9_-]{0,62}$/i;

function isPrivateLanHost(host: string): boolean {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)
  );
}

function allowPublicUrl(
  raw: string | undefined,
  fallback: string,
  ok: (u: URL) => boolean,
): string {
  const candidate = (raw?.trim() || fallback).trim();
  try {
    const u = new URL(candidate);
    const host = u.hostname.toLowerCase();
    const localHttp = u.protocol === "http:" && isPrivateLanHost(host);
    if (u.protocol !== "https:" && !localHttp) return fallback;
    if (!ok(u)) return fallback;
    // Drop a lone trailing slash on the origin; keep path segments.
    return u.toString().replace(/\/$/, "") || fallback;
  } catch {
    return fallback;
  }
}

const DEFAULT_SITE = "https://lsemods.com";
const DEFAULT_TELEGRAM = "https://t.me/+PkvV4S3Of4sxMmZl";
const DEFAULT_OC = "https://opencollective.com/lsemods";
const DEFAULT_DISQUS = "lsemods";

export const DISQUS_SHORTNAME = (() => {
  const raw = process.env.NEXT_PUBLIC_DISQUS_SHORTNAME?.trim() || DEFAULT_DISQUS;
  return DISQUS_RE.test(raw) ? raw.toLowerCase() : DEFAULT_DISQUS;
})();

export const TELEGRAM_URL = allowPublicUrl(
  process.env.NEXT_PUBLIC_TELEGRAM_URL,
  DEFAULT_TELEGRAM,
  (u) =>
    u.hostname === "t.me" ||
    u.hostname === "telegram.me" ||
    u.hostname === "www.telegram.me",
);

export const OPEN_COLLECTIVE_URL = allowPublicUrl(
  process.env.NEXT_PUBLIC_OPEN_COLLECTIVE_URL,
  DEFAULT_OC,
  (u) => u.hostname === "opencollective.com" || u.hostname.endsWith(".opencollective.com"),
);

export const SITE_URL = allowPublicUrl(
  process.env.NEXT_PUBLIC_SITE_URL,
  DEFAULT_SITE,
  (u) => {
    const host = u.hostname.toLowerCase();
    return (
      host === "lsemods.com" ||
      host.endsWith(".lsemods.com") ||
      isPrivateLanHost(host)
    );
  },
);
