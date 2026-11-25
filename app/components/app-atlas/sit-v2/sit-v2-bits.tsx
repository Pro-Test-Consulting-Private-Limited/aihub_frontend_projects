"use client";

import { useState } from "react";
import { TbCheck, TbCopy, TbSparkles, TbTemplate, TbUser } from "react-icons/tb";
import { getCaseProvenance } from "@/app/lib/sit-case-provenance";

function fmtWhen(ms?: string | number) {
  if (!ms) return "";
  const n = typeof ms === "number" ? ms : Number(ms);
  if (!Number.isFinite(n) || n <= 0) return "";
  try {
    return new Date(n).toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function provenanceTooltip(cells: Record<string, string>): string {
  const p = getCaseProvenance(cells);
  const parts: string[] = [];
  if (p.origin === "human") {
    parts.push(`Human: added by a person${cells.editedBy ? ` (${cells.editedBy})` : ""}${fmtWhen(cells.editedAt) ? ` ${fmtWhen(cells.editedAt)}` : ""}`);
  } else if (p.legacyTemplate) {
    parts.push(`Legacy: old template row${fmtWhen(cells.editedAt) ? ` ${fmtWhen(cells.editedAt)}` : ""}`);
  } else {
    parts.push(`AI: generated${fmtWhen(cells.generatedAt) ? ` ${fmtWhen(cells.generatedAt)}` : ""}`);
  }
  if (p.edited) {
    parts.push(
      `Edited: changed by a person after creation${cells.editedBy ? ` (${cells.editedBy})` : ""}${fmtWhen(cells.editedAt) ? ` ${fmtWhen(cells.editedAt)}` : ""}`,
    );
    if (cells.aiOriginal) parts.push("original available");
  }
  return parts.join(". ");
}

/** Compact provenance icon for the ID cell (no Origin column). */
export function OriginGlyph({
  origin,
  edited,
  title,
}: {
  origin?: string;
  edited?: boolean;
  title?: string;
}) {
  const p = getCaseProvenance({ origin, edited: edited ? "1" : "0" });
  const tip =
    title ||
    (p.origin === "human" ? "Human: added by a person" : "AI: generated");
  if (p.origin === "human") {
    return (
      <span className="inline-flex items-center gap-0.5 text-[#1d4ed8]" title={tip} aria-label="Human">
        <TbUser size={12} />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-[#8664F2]" title={tip} aria-label="AI">
      <TbSparkles size={12} />
      {p.edited ? (
        <span
          className="h-1.5 w-1.5 rounded-full bg-[#d97706]"
          data-testid="sit-edited-dot"
          title="Edited: changed by a person after creation. Does not include status, results or notes."
        />
      ) : null}
    </span>
  );
}

/** Legacy labelled badge (drawer / legend). */
export function OriginBadge({ origin, edited }: { origin?: string; edited?: boolean }) {
  const p = getCaseProvenance({ origin, edited: edited ? "1" : "0" });
  if (p.origin === "human") {
    return (
      <span
        className="inline-flex items-center gap-0.5 rounded border border-[#bfdbfe] bg-[#eff6ff] px-1 text-[12px] font-semibold text-[#1d4ed8]"
        title="Human: added by a person"
      >
        <TbUser size={10} /> Human
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded border border-[#ddd6fe] bg-[#f5f3ff] px-1 text-[12px] font-semibold text-[#5b21b6]"
      title="AI: generated"
    >
      <TbSparkles size={10} /> AI
      {p.edited ? (
        <span
          className="ml-0.5 rounded border border-[#f59e0b] bg-[#fffbeb] px-1 text-[11px] font-semibold text-[#b45309]"
          title="Edited: changed by a person after creation"
        >
          Edited
        </span>
      ) : null}
    </span>
  );
}

/** Row left border tint removed in Round 3 (U10) ,  keep helper returning empty for callers. */
export function originRowTint(_origin?: string, _edited?: boolean): string {
  return "";
}

export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-1 text-[11px]">
      <span className="w-20 shrink-0 text-[#6b7280]">{label}</span>
      <code className="min-w-0 flex-1 truncate rounded bg-[#f3f4f6] px-1.5 py-0.5 font-mono dark:bg-[#1a1a1a]">
        {value || ", "}
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
