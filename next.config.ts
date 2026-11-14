import type { NextConfig } from "next";
import { SECURITY_HEADERS } from "./src/lib/securityHeaders";

const nextConfig: NextConfig = {
  // Used by the Docker image (see Dockerfile). Vercel builds ignore this env.
  ...(process.env.DOCKER === "1" ? { output: "standalone" as const } : {}),
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  // minimatch/eslint ESM mismatch must not fail production image builds
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
      // Never cache HTML shell with stale CSP; keep static assets cacheable via Next defaults.
      {
        source: "/data/:path*",
        headers: [
          ...SECURITY_HEADERS,
          { key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" },
          { key: "X-Content-Type-Options", value: "nosniff" },
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
      {
        source: "/courses/LSE100A",
        destination: "/courses/LSE100",
        permanent: true,
      },
      {
        source: "/courses/LSE100B",
        destination: "/courses/LSE100",
        permanent: true,
      },
      {
        source: "/courses/LSE100C",
        destination: "/courses/LSE100",
        permanent: true,
      },
      {
        source: "/courses/lse100a",
        destination: "/courses/LSE100",
        permanent: true,
      },
      {
        source: "/courses/lse100b",
        destination: "/courses/LSE100",
        permanent: true,
      },
      {
        source: "/courses/lse100c",
        destination: "/courses/LSE100",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
