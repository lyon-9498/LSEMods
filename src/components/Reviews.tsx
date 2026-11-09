"use client";

import { useEffect, useRef, useState } from "react";
import { DISQUS_SHORTNAME, SITE_URL } from "@/lib/config";
import { debounce } from "@/lib/async";

type DisqusPage = { page: { url?: string; identifier?: string; title?: string } };
type DisqusConfig = (this: DisqusPage) => void;

declare global {
  interface Window {
    DISQUS?: { reset: (opts: { reload: boolean; config: DisqusConfig }) => void };
    disqus_config?: DisqusConfig;
  }
}

function makeConfig(code: string, title: string): DisqusConfig {
  return function (this: DisqusPage) {
    this.page.url = `${SITE_URL}/courses/${code}`;
    this.page.identifier = code;
    this.page.title = `${code} ${title}`;
  };
}

const resetDebounced = debounce((code: string, title: string) => {
  try {
    if (!window.DISQUS) return;
    window.DISQUS.reset({ reload: true, config: makeConfig(code, title) });
  } catch {
    /* Disqus may throw if the embed is mid-load */
  }
}, 300);

export function Reviews({ code, title }: { code: string; title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [load, setLoad] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!load || !DISQUS_SHORTNAME) return;
    try {
      const config = makeConfig(code, title);
      if (window.DISQUS) {
        resetDebounced(code, title);
      } else {
        window.disqus_config = config;
        if (!document.getElementById("dsq-embed-scr")) {
          const s = document.createElement("script");
          s.id = "dsq-embed-scr";
          s.src = `https://${DISQUS_SHORTNAME}.disqus.com/embed.js`;
          s.async = true;
          s.onerror = () => setFailed(true);
          document.body.appendChild(s);
        }
      }
    } catch {
      setFailed(true);
    }
  }, [load, code, title]);

  if (!DISQUS_SHORTNAME) return null;

  return (
    <section
      id="reviews"
      ref={ref}
      className="rounded-[var(--radius)] border border-dashed border-line-strong bg-surface p-5"
    >
      <h2 className="font-display text-xl text-night">Reviews and Discussion</h2>
      <p className="mt-1 text-sm text-muted">
        Comments are hosted by Disqus. Loading them sets cookies and may show ads.
      </p>
      {failed && (
        <p className="mt-3 text-sm text-status-check-text" role="alert">
          Comments couldn’t load. Try refreshing the page.
        </p>
      )}
      {!load && !failed && (
        <button
          type="button"
          className="btn-dark mt-4 inline-flex items-center px-5 text-sm"
          onClick={() => setLoad(true)}
        >
          Load Comments
        </button>
      )}
      {load && !failed && <div id="disqus_thread" className="mt-4" />}
    </section>
  );
}
