"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

const TEMPLATE = `Device / browser:
Page (URL or course code):
What I expected:
What happened:
Anything else:`;

export function CopyFeedbackTemplate() {
  const [copied, setCopied] = useState(false);

  return (
    <div className="rounded-[var(--radius)] border border-line bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg text-night">Feedback template</h3>
          <p className="mt-1 text-sm text-muted">
            Copy this into Telegram so we get the details we need.
          </p>
        </div>
        <button
          type="button"
          className="btn-ghost inline-flex items-center gap-2 px-4 text-sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(TEMPLATE);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2000);
            } catch {
              /* clipboard may be blocked */
            }
          }}
        >
          {copied ? (
            <>
              <Check className="size-4" aria-hidden />
              Copied
            </>
          ) : (
            <>
              <Copy className="size-4" aria-hidden />
              Copy Template
            </>
          )}
        </button>
      </div>
      <pre className="mt-4 overflow-x-auto rounded-[var(--radius-inner)] bg-lilac-deep p-3 font-data text-xs leading-relaxed text-text-2 whitespace-pre-wrap">
        {TEMPLATE}
      </pre>
    </div>
  );
}
