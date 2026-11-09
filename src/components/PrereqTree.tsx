import type { Req } from "@/lib/types";
import Link from "next/link";

export function PrereqTree({ tree }: { tree: Req }) {
  if (tree.type === "course") {
    return (
      <Link href={`/courses/${tree.code}`} className="font-medium text-night underline-offset-2 hover:underline">
        {tree.code}
      </Link>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className="text-muted">{tree.type === "and" ? "(" : "one of ("}</span>
      {tree.children.map((c, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          {i > 0 && <span className="text-muted">{tree.type}</span>}
          <PrereqTree tree={c} />
        </span>
      ))}
      <span className="text-muted">)</span>
    </span>
  );
}
