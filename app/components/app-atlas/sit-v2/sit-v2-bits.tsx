"use client";

import { useState } from "react";
import { TbCheck, TbCopy, TbSparkles, TbTemplate, TbUser } from "react-icons/tb";

export function OriginBadge({ origin, edited }: { origin?: string; edited?: boolean }) {
  if (origin === "human") {
    return (
      <span
        className="inline-flex items-center gap-0.5 rounded border border-[#bfdbfe] bg-[#eff6ff] px-1 text-[9px] font-semibold text-[#1d4ed8]"
        title="Human"
      >
        <TbUser size={10} /> Human
      </span>
    );
  }
  if (origin === "template") {
    return (
      <span
        className="inline-flex items-center gap-0.5 rounded border border-[#e5e7eb] bg-[#f9fafb] px-1 text-[9px] font-semibold text-[#6b7280]"
        title="Template"
      >
        <TbTemplate size={10} /> Template
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded border border-[#ddd6fe] bg-[#f5f3ff] px-1 text-[9px] font-semibold text-[#5b21b6]"
      title="AI"
    >
      <TbSparkles size={10} /> AI
      {edited ? <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-[#d97706]" title="Edited" /> : null}
    </span>
  );
}

export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-1 text-[11px]">
      <span className="w-20 shrink-0 text-[#6b7280]">{label}</span>
      <code className="min-w-0 flex-1 truncate rounded bg-[#f3f4f6] px-1.5 py-0.5 font-mono dark:bg-[#1a1a1a]">
        {value || "—"}
      </code>
      <button
        type="button"
        className="inline-flex items-center gap-0.5 rounded border border-[#e2e6ef] px-1 py-0.5 text-[#5b647a] hover:bg-[#fafafa] dark:border-[#2a2a2a]"
        title="Copy"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value || "");
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          } catch {
            /* ignore */
          }
        }}
      >
        {copied ? (
          <>
            <TbCheck size={12} className="text-[#16a34a]" />
            <span className="text-[10px] text-[#16a34a]">Copied</span>
          </>
        ) : (
          <TbCopy size={12} />
        )}
      </button>
    </div>
  );
}
