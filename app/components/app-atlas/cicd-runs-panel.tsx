"use client";

import { useCallback, useEffect, useState } from "react";
import { TbLoader2, TbPlayerPlay, TbRefresh } from "react-icons/tb";
import type { AtlasClient } from "@/app/services/appatlas";
import type { CanvasGithub, CicdRun } from "@/app/interfaces/appatlas";

function statusColor(s: CicdRun["status"]) {
  if (s === "passed") return "text-[#15803D] bg-[#F0FDF4]";
  if (s === "failed") return "text-[#991B1B] bg-[#FEF2F2]";
  if (s === "running" || s === "queued") return "text-[#1D4ED8] bg-[#EFF6FF]";
  return "text-[#5E6066] bg-[#F4F4F5]";
}

export function CicdRunsPanel({
  client,
  canvasId,
  github,
}: {
  client: AtlasClient;
  canvasId: string;
  github: CanvasGithub;
}) {
  const [items, setItems] = useState<CicdRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await client.listCicdRuns(canvasId);
      setItems(r.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load CI/CD runs.");
      setItems([]);
    }
  }, [client, canvasId]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 8000);
    return () => clearInterval(t);
  }, [load]);

  const runNow = async () => {
    setBusy(true);
    setError(null);
    try {
      await client.startCicdRun(canvasId, { ref: "main" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start sync.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-[12px] border border-[#ECECEC] bg-white p-4 dark:border-[#2a2a2a] dark:bg-[#101010]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-[#1F1F1F] dark:text-[#ededed]">CI/CD · OpenAPI sync</div>
          <div className="truncate text-[11.5px] text-[#7E7E7E]">
            {github.owner}/{github.repo} · {github.openapiPath}
            {github.smokeBaseUrl ? ` · smoke ${github.smokeBaseUrl}` : ""}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1 rounded-[8px] border border-[#E5E7EB] px-2.5 py-1.5 text-[12px] text-[#5E6066] dark:border-[#2a2a2a]"
          >
            <TbRefresh size={14} /> Refresh
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void runNow()}
            className="inline-flex items-center gap-1 rounded-[8px] bg-[#8664F2] px-2.5 py-1.5 text-[12px] font-medium text-white disabled:opacity-60"
          >
            {busy ? <TbLoader2 size={14} className="animate-spin" /> : <TbPlayerPlay size={14} />}
            Sync now
          </button>
        </div>
      </div>
      {error && <div className="mt-2 rounded-[8px] bg-[#FDF1F1] px-3 py-2 text-[12px] text-[#991B1B]">{error}</div>}
      <ul className="mt-3 max-h-[220px] space-y-2 overflow-y-auto">
        {items === null && (
          <li className="flex items-center gap-2 text-[12px] text-[#7E7E7E]">
            <TbLoader2 size={14} className="animate-spin" /> Loading runs…
          </li>
        )}
        {items?.length === 0 && <li className="text-[12px] text-[#7E7E7E]">No runs yet. Push a PR webhook or tap Sync now.</li>}
        {items?.map((run) => (
          <li key={run.id} className="rounded-[8px] border border-[#F0F0F0] px-3 py-2 dark:border-[#222]">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-[12.5px] font-medium text-[#1F1F1F] dark:text-[#ededed]">{run.title}</div>
                <div className="mt-0.5 text-[11px] text-[#7E7E7E]">
                  {run.event}
                  {run.branch ? ` · ${run.branch}` : ""}
                  {run.delta
                    ? ` · +${run.delta.added.length}/−${run.delta.removed.length}/~${run.delta.changed.length}`
                    : ""}
                </div>
                {(run.summary || run.error) && (
                  <div className="mt-1 text-[11.5px] leading-snug text-[#5E6066] dark:text-[#9ca3af]">
                    {run.error || run.summary}
                  </div>
                )}
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${statusColor(run.status)}`}>
                {run.status}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
