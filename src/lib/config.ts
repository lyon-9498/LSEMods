/**
 * Site settings. Only non-secret NEXT_PUBLIC_* values.
 */
export const DISQUS_SHORTNAME =
  process.env.NEXT_PUBLIC_DISQUS_SHORTNAME?.trim() || "lsemods";

export const TELEGRAM_URL =
  process.env.NEXT_PUBLIC_TELEGRAM_URL?.trim() ||
  "https://t.me/+lsemods-feedback-placeholder";

export const OPEN_COLLECTIVE_URL =
  process.env.NEXT_PUBLIC_OPEN_COLLECTIVE_URL?.trim() ||
  "https://opencollective.com/lsemods";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://lsemods.com";
