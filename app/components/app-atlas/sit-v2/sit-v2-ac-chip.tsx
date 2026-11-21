"use client";

import { useMemo, useState } from "react";
import type { SitSheetRow } from "@/app/interfaces/appatlas";

export type AcCoverage = {
  total: number;
  covered: number;
  uncovered: { id: string; text: string }[];
};

export function computeAcCoverage(acs: string[], rows: SitSheetRow[]): AcCoverage {
  const live = rows.filter((r) => r.cells.deleted !== "1");
  const coveredIds = new Set<string>();
  for (const r of live) {
    for (const id of (r.cells.acIds || "").split(/[,\s]+/).filter(Boolean)) coveredIds.add(id.toUpperCase());
    for (const m of (r.cells.ac || "").matchAll(/\bAC\d+\b/gi)) coveredIds.add(m[0]!.toUpperCase());
  }
  const uncovered: { id: string; text: string }[] = [];
  acs.forEach((text, i) => {
    const id = `AC${i + 1}`;
    if (!coveredIds.has(id)) {
      // lexical fallback
      const hit = live.some((r) => {
        const blob = `${r.cells.scenario}\n${r.cells.steps}\n${r.cells.expected}`;
        return text.length > 20 && blob.includes(text.slice(0, 40));
      });
      if (!hit) uncovered.push({ id, text });
      else coveredIds.add(id);
    }
  });
  return { total: acs.length, covered: acs.length - uncovered.length, uncovered };
}

export function SitV2AcChip({
  acs,
  rows,
  onGenerateMissing,
}: {
  acs: string[];
  rows: SitSheetRow[];
  onGenerateMissing?: (uncovered: { id: string; text: string }[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const cov = useMemo(() => computeAcCoverage(acs, rows), [acs, rows]);
  if (!acs.length) return null;
  const ok = cov.covered === cov.total;
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
          ok
            ? "border-[#bbf7d0] bg-[#ecfdf5] text-[#065f46]"
            : "border-[#fde68a] bg-[#fffbeb] text-[#92400e]"
        }`}
        title="Acceptance criteria coverage"
      >
        AC {cov.covered}/{cov.total} covered
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-1 w-80 rounded-[10px] border border-[#e2e6ef] bg-white p-3 shadow-lg dark:border-[#2a2a2a] dark:bg-[#141414]">
          <div className="mb-2 text-[12px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">
            AC coverage
          </div>
          {cov.uncovered.length === 0 ? (
            <p className="text-[12px] text-[#5b647a]">All acceptance criteria have at least one case.</p>
          ) : (
            <>
              <ul className="mb-2 max-h-40 space-y-1 overflow-auto text-[11.5px] text-[#374151]">
                {cov.uncovered.map((u) => (
                  <li key={u.id} className="rounded bg-[#fff7ed] px-2 py-1">
                    <span className="font-mono font-semibold text-[#9a3412]">{u.id}</span>{" "}
                    <span className="text-[#5b647a]">{u.text.slice(0, 120)}</span>
                  </li>
                ))}
              </ul>
              {onGenerateMissing && (
                <button
                  type="button"
                  className="rounded-[8px] bg-[#8664F2] px-2.5 py-1 text-[11.5px] font-medium text-white"
                  onClick={() => {
                    setOpen(false);
                    onGenerateMissing(cov.uncovered);
                  }}
                >
                  Generate for missing
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
