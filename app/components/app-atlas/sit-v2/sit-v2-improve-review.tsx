"use client";

import { useState } from "react";

const FIELDS = ["scenario", "testType", "preconditions", "steps", "expected"] as const;

export function SitV2ImproveReview({
  before,
  after,
  fixed,
  remaining,
  onApply,
  onDiscard,
}: {
  before: Record<string, string>;
  after: Record<string, string>;
  fixed: string[];
  remaining: string[];
  onApply: (fields: string[]) => void;
  onDiscard: () => void;
}) {
  const changed = FIELDS.filter((f) => (before[f] || "") !== (after[f] || ""));
  const [selected, setSelected] = useState<Set<string>>(() => new Set(changed));

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4"
      data-testid="sit-improve-review"
    >
      <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-[12px] border border-[#e2e6ef] bg-white p-4 shadow-xl">
        <h2 className="text-[16px] font-semibold">Review changes</h2>
        <p className="mt-1 text-[13px] text-[#5b647a]">
          Fixes: {fixed.join(", ") || "none"}. Still open: {remaining.join(", ") || "none"}.
        </p>
        <ul className="mt-3 space-y-3">
          {changed.map((f) => (
            <li key={f} className="rounded-[8px] border border-[#eef0f5] p-2 text-[13px]">
              <label className="flex items-center gap-2 font-semibold capitalize">
                <input
                  type="checkbox"
                  checked={selected.has(f)}
                  onChange={() => {
                    setSelected((prev) => {
                      const n = new Set(prev);
                      if (n.has(f)) n.delete(f);
                      else n.add(f);
                      return n;
                    });
                  }}
                />
                {f}
              </label>
              <div className="mt-1 grid gap-2 md:grid-cols-2">
                <pre className="whitespace-pre-wrap rounded bg-[#fef2f2] p-2 text-[12px] text-[#991b1b]">
                  - {before[f] || "(empty)"}
                </pre>
                <pre className="whitespace-pre-wrap rounded bg-[#ecfdf5] p-2 text-[12px] text-[#166534]">
                  + {after[f] || "(empty)"}
                </pre>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="rounded-[8px] bg-[#8664F2] px-3 py-1.5 text-[13px] font-medium text-white"
            data-testid="sit-improve-apply"
            onClick={() => onApply([...selected])}
          >
            Apply selected
          </button>
          <button
            type="button"
            className="rounded-[8px] border border-[#e2e6ef] px-3 py-1.5 text-[13px]"
            data-testid="sit-improve-discard"
            onClick={onDiscard}
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}
