"use client";

import type { ReactNode } from "react";

/**
 * Round 4 B5: normalize stored bullet/step text for display/export without rewriting DB.
 * Strips leading "- ", leaked numbering like "- 2." / "- 3.", and collapses spaces.
 */
export function normalizeBulletText(raw: string): string {
  return (raw || "")
    .split(/\n/)
    .map((line) => {
      let s = line.trim();
      // Strip repeated leading markers / leaked numbers: "- 2. foo", "* 3) bar", "2. baz"
      s = s.replace(/^[-*•]+\s*/, "");
      s = s.replace(/^\d+[.)]\s*/, "");
      s = s.replace(/^[-*•]+\s*/, "");
      s = s.replace(/\s{2,}/g, " ").trim();
      return s;
    })
    .filter(Boolean)
    .join("\n");
}

export function bulletLines(raw: string): string[] {
  return normalizeBulletText(raw)
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export function renderBulletLines(raw: string): ReactNode {
  const lines = bulletLines(raw);
  if (!lines.length) return null;
  return (
    <ul className="m-0 list-disc space-y-0.5 pl-4 text-[12px] leading-snug [list-style-position:outside]">
      {lines.map((l, i) => (
        <li key={i} className="pl-0.5">
          {l}
        </li>
      ))}
    </ul>
  );
}
