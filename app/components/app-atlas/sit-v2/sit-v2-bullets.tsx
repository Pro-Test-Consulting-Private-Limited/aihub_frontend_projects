"use client";

import type { ReactNode } from "react";
import { sanitizeUserText } from "@/app/lib/sit-sanitize-text";

function normKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function jaccard(a: string, b: string): number {
  const ta = new Set(normKey(a).split(" ").filter(Boolean));
  const tb = new Set(normKey(b).split(" ").filter(Boolean));
  if (!ta.size && !tb.size) return 1;
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

/**
 * Round 4 B5 + Round 5 A4/A5: normalize bullets for display/export without rewriting DB.
 * Dedupes exact and near-duplicate lines (sim ≥ 0.85). Scrubs em/en dashes and arrows.
 */
export function normalizeBulletText(raw: string): string {
  const cleaned = (raw || "")
    .split(/\n/)
    .map((line) => {
      let s = sanitizeUserText(line.trim());
      s = s.replace(/^[-*•]+\s*/, "");
      s = s.replace(/^\d+[.)]\s*/, "");
      s = s.replace(/^[-*•]+\s*/, "");
      s = s.replace(/\s{2,}/g, " ").trim();
      return s;
    })
    .filter(Boolean);

  const kept: string[] = [];
  for (const line of cleaned) {
    const dup = kept.some((k) => normKey(k) === normKey(line) || jaccard(k, line) >= 0.85);
    if (!dup) kept.push(line);
  }
  return kept.join("\n");
}

export function bulletLines(raw: string): string[] {
  return normalizeBulletText(raw)
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Round 5 A5: {{placeholders}} as styled test-data tokens (never raw braces in running text). */
function renderLineWithTokens(line: string): ReactNode {
  const parts = line.split(/(\{\{\s*[a-zA-Z0-9_]+\s*\}\})/g);
  return parts.map((part, i) => {
    const m = part.match(/^\{\{\s*([a-zA-Z0-9_]+)\s*\}\}$/);
    if (m) {
      return (
        <span
          key={i}
          className="mx-0.5 inline-flex items-center rounded border border-[#c4b5fd] bg-[#f5f3ff] px-1 py-px font-mono text-[10.5px] font-medium text-[#5b21b6]"
          title="Filled from Test data"
          data-testid="sit-test-data-token"
        >
          {m[1]}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function renderBulletLines(raw: string, opts?: { max?: number }): ReactNode {
  const lines = bulletLines(raw);
  if (!lines.length) return null;
  const max = opts?.max;
  const show = max && lines.length > max ? lines.slice(0, max) : lines;
  return (
    <ul className="m-0 list-disc space-y-0.5 pl-4 text-[12px] leading-snug [list-style-position:outside]">
      {show.map((l, i) => (
        <li key={i} className="pl-0.5">
          {renderLineWithTokens(l)}
        </li>
      ))}
    </ul>
  );
}
