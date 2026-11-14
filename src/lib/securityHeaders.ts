/**
 * Shared security header values for Next (Vercel/Docker) and static `_headers`.
 * Keep in sync with `public/_headers` for production.
 *
 * Local Docker serves plain HTTP. HSTS + upgrade-insecure-requests force the
 * browser onto https://localhost, CSS/JS fail, and the page looks unstyled.
 */

const disqus = "*.disqus.com *.disquscdn.com";

/** True for the local Docker image (`DOCKER=1` in Dockerfile builder/runner). */
const isLocalDocker = process.env.DOCKER === "1";

const cspParts = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${disqus}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${disqus}`,
  "font-src 'self' data:",
  `frame-src 'self' ${disqus}`,
  `connect-src 'self' ${disqus}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
];
if (!isLocalDocker) cspParts.push("upgrade-insecure-requests");

export const CONTENT_SECURITY_POLICY = cspParts.join("; ");

export const SECURITY_HEADERS: { key: string; value: string }[] = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  ...(isLocalDocker
    ? []
    : [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]),
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Cross-Origin-Resource-Policy", value: "same-site" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
];
