"use client";

import { useState } from "react";
import { TbLoader2, TbX } from "react-icons/tb";
import type { SitJob } from "@/app/interfaces/appatlas";

function stageLabel(job: SitJob) {
  const st = job.progress?.stage || "queued";
  if (job.status === "cancelled") return "Cancelled";
  if (st === "queued" && job.progress?.queuePosition) {
    return `Queued #${job.progress.queuePosition}`;
  }
  if (st === "generating") return "Generating cases";
  if (st === "saving") return "Saving workbook";
  if (st === "assessing") return job.kind === "reassess" ? "Re-assessing" : "Assessing risk";
  if (job.status === "done") return "Done";
  return st;
}

function shortFailMessage(error: string | null) {
  const raw = (error || "Failed").trim();
  if (/model is off|model inactive|scaled to zero|paused/i.test(raw)) {
    return "Model is off. Start the endpoint and retry.";
  }
  const first = raw.split(/[\n.]/)[0]?.trim() || raw;
  return first.length > 120 ? `${first.slice(0, 117)}…` : first;
}

export function SitJobsChip({
  jobs,
  onCancel,
  onDismiss,
  onDismissAll,
}: {
  jobs: SitJob[];
  onCancel: (id: string) => void;
  onDismiss?: (id: string) => void;
  onDismissAll?: () => void;
}) {
  const [openDetails, setOpenDetails] = useState<Record<string, boolean>>({});
  const active = jobs.filter((j) => j.status === "queued" || j.status === "running");
  const failed = jobs.filter((j) => j.status === "failed").slice(0, 8);
  if (!active.length && !failed.length) return null;

  return (
    <div className="pointer-events-auto fixed bottom-4 right-4 z-[70] w-[min(360px,calc(100vw-2rem))] rounded-[10px] border border-[#e2e6ef] bg-white p-3 shadow-xl dark:border-[#2a2a2a] dark:bg-[#151515]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
          SIT jobs ({active.length}
          {failed.length ? ` · ${failed.length} failed` : ""})
        </div>
        {failed.length && onDismissAll ? (
          <button
            type="button"
            className="text-[11px] font-medium text-[#6b7280] hover:text-[#b42318]"
            onClick={() => onDismissAll()}
          >
            Dismiss all
          </button>
        ) : null}
      </div>
      <ul className="max-h-48 space-y-2 overflow-auto text-[12px]">
        {failed.map((j) => {
          const short = shortFailMessage(j.error);
          const full = (j.error || "").trim();
          const showToggle = full.length > 0 && full !== short;
          const open = !!openDetails[j.id];
          return (
            <li
              key={`fail-${j.id}`}
              className="rounded border border-[#fecaca] bg-[#fef2f2] px-2 py-1.5 dark:border-[#7f1d1d] dark:bg-[#1a0a0a]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 font-medium text-[#991B1B] dark:text-[#fca5a5]">
                  {j.issueKey || j.kind}
                </div>
                {onDismiss ? (
                  <button
                    type="button"
                    className="shrink-0 text-[#991B1B] hover:text-[#7f1d1d]"
                    aria-label="Dismiss failed job"
                    title="Dismiss"
                    onClick={() => onDismiss(j.id)}
                  >
                    <TbX size={14} />
                  </button>
                ) : null}
              </div>
              <div className="text-[11px] text-[#b42318]">{short}</div>
              {showToggle ? (
                <button
                  type="button"
                  className="mt-0.5 text-[10px] font-medium text-[#8664F2]"
                  onClick={() => setOpenDetails((m) => ({ ...m, [j.id]: !open }))}
                >
                  {open ? "Hide details" : "Details"}
                </button>
              ) : null}
              {open ? (
                <div className="mt-1 whitespace-pre-wrap break-words text-[10px] text-[#7f1d1d]">{full}</div>
              ) : null}
            </li>
          );
        })}
        {active.slice(0, 8).map((j) => (
          <li
            key={j.id}
            className="flex items-start justify-between gap-2 rounded border border-[#eef0f5] px-2 py-1.5 dark:border-[#2a2a2a]"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 font-medium text-[#1F1F1F] dark:text-[#ededed]">
                <TbLoader2 className="shrink-0 animate-spin text-[#8664F2]" size={14} />
                <span className="truncate">{j.issueKey || j.kind}</span>
              </div>
              <div className="truncate text-[11px] text-[#6b7280]">{stageLabel(j)}</div>
            </div>
            {j.status === "queued" || j.status === "running" ? (
              <button
                type="button"
                className="shrink-0 text-[#6b7280] hover:text-[#b42318]"
                aria-label="Cancel job"
                onClick={() => onCancel(j.id)}
              >
                <TbX size={16} />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
