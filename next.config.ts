import type { NextConfig } from "next";

const disqus = "*.disqus.com *.disquscdn.com";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${disqus}`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: ${disqus}`,
  `font-src 'self' data:`,
  `frame-src 'self' ${disqus}`,
  `connect-src 'self' ${disqus}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/planner",
        destination: "/builder",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
