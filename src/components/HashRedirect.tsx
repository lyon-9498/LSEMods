"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isValidCourseCode } from "@/lib/async";

/** Map legacy Vite hash routes (#/courses/CODE, #/planner) to App Router paths. */
export function HashRedirect() {
  const router = useRouter();
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash || hash === "/") return;
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
    }
  }, [router]);
  return null;
}
