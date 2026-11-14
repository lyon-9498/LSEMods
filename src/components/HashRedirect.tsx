"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isValidCourseCode } from "@/lib/async";

const ALLOWED_HASH_TARGETS = new Set(["/builder", "/courses"]);

/** Map legacy Vite hash routes (#/courses/CODE, #/planner) to App Router paths. */
export function HashRedirect() {
  const router = useRouter();
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash || hash === "/") return;
    // Open-redirect hardening: never honour external/absolute URLs in the hash.
    if (/^[a-z][a-z0-9+.-]*:/i.test(hash) || hash.startsWith("//")) return;

    if (hash.startsWith("/courses/")) {
      const code = (hash.slice("/courses/".length).split(/[/?#]/)[0] ?? "").trim();
      if (isValidCourseCode(code)) {
        router.replace(`/courses/${code.toUpperCase()}`);
      }
      return;
    }
    if (hash === "/planner" || hash.startsWith("/planner")) {
      router.replace("/builder");
      return;
    }
    if (hash === "/courses" || hash.startsWith("/courses?")) {
      router.replace("/courses");
      return;
    }
    // Ignore any other hash path (no open redirect / open navigation).
    if (!ALLOWED_HASH_TARGETS.has(hash.split(/[?#]/)[0] ?? "")) return;
  }, [router]);
  return null;
}
