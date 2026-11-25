"use client";

import { useState } from "react";
import type { SitWorkbook } from "@/app/interfaces/appatlas";
import { liveRows, normalizeTicketKey, ticketKeyOf } from "@/app/lib/sit-scope";

export type TicketGenChoice = {
  issueKey: string;
  mode: "new" | "append" | "open" | "template";
  workbookId?: string;
  hasExisting: boolean;
  caseCount: number;
};

function ago(ts: number) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function SitV2GenerateDialog({
  choices,
  history = [],
  onCancel,
  onConfirm,
}: {
  choices: TicketGenChoice[];
  history?: SitWorkbook[];
  onCancel: () => void;
  onConfirm: (choices: TicketGenChoice[]) => void;
}) {
  const [local, setLocal] = useState<TicketGenChoice[]>(() =>
    choices.map((c) => ({
      ...c,
      mode: c.hasExisting ? "append" : "new",
    })),
  );

  const existing = local.filter((c) => c.hasExisting);
  const fresh = local.filter((c) => !c.hasExisting);

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" aria-label="Close" onClick={onCancel} />
      <div
        role="alertdialog"
        aria-labelledby="sit-gen-title"
        className="relative w-full max-w-lg rounded-[12px] border border-[#e2e6ef] bg-white p-4 shadow-2xl dark:border-[#2a2a2a] dark:bg-[#101010]"
      >
        <h2 id="sit-gen-title" className="text-[15px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">
          Some tickets already have cases
        </h2>
        <p className="mt-1 text-[12.5px] text-[#6b7280]">
          Choose what to do for each. Edited and human rows are never overwritten.
        </p>
        <ul className="mt-3 max-h-64 space-y-3 overflow-y-auto">
          {existing.map((c) => {
            const versions = history
              .filter((h) => h.sourceIssueKeys.includes(c.issueKey))
              .slice(0, 5);
            return (
              <li key={c.issueKey} className="rounded-[8px] border border-[#e2e6ef] p-3 dark:border-[#2a2a2a]">
                <div className="mb-2 text-[13px] font-medium">
                  {c.issueKey}{" "}
                  <span className="font-normal text-[#8a93a8]">
                    ({c.caseCount} cases
                    {versions.length > 1 ? ` · ${versions.length} versions` : ""})
                  </span>
                </div>
                {versions.length > 0 && (
                  <ul className="mb-2 space-y-0.5 rounded-[6px] bg-[#fafafa] px-2 py-1.5 text-[11px] text-[#6b7280] dark:bg-[#141414]">
                    {versions.map((h) => {
                      const rows = h.sheets.find((s) => s.kind === "test-cases")?.rows || [];
                      const want = normalizeTicketKey(c.issueKey);
                      const ticketCount = liveRows(rows).filter((r) => ticketKeyOf(r) === want).length;
                      return (
                      <li key={h.id}>
                        {ago(h.createdAt)} · {h.generator} ·{" "}
                        {ticketCount} cases
                      </li>
                      );
                    })}
                  </ul>
                )}
                <div className="flex flex-col gap-1.5 text-[12.5px]">
                  {(
                    [
                      ["open", "Open existing"],
                      ["new", "Generate new version (keep old)"],
                      ["append", "Add more cases to existing (append, skip duplicates)"],
                    ] as const
                  ).map(([mode, label]) => (
                    <label key={mode} className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name={`mode-${c.issueKey}`}
                        checked={c.mode === mode}
                        onChange={() =>
                          setLocal((prev) => prev.map((x) => (x.issueKey === c.issueKey ? { ...x, mode } : x)))
                        }
                        className="accent-[#8664F2]"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
        {fresh.length > 0 && (
          <p className="mt-3 text-[12px] text-[#6b7280]">
            Also generating for first time: {fresh.map((f) => f.issueKey).join(", ")}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-[8px] border border-[#e2e6ef] px-3 py-1.5 text-[12.5px] dark:border-[#2a2a2a]"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-[8px] bg-[#8664F2] px-4 py-1.5 text-[12.5px] font-medium text-white"
            onClick={() => onConfirm(local)}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
