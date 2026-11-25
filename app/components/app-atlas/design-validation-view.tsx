"use client";

import { useCallback, useEffect, useState } from "react";
import { SiFigma } from "react-icons/si";
import { TbRefresh } from "react-icons/tb";
import type { AtlasClient } from "@/app/services/appatlas";
import type { Canvas, FigmaAudit, FigmaFinding } from "@/app/interfaces/appatlas";
import type { CanvasFigma } from "@/app/lib/canvas-figma";

export function DesignValidationView({
  client,
  canvas,
  figma,
  onConnectApps,
}: {
  client: AtlasClient;
  canvas: Canvas | null;
  figma: CanvasFigma | null;
  onConnectApps?: () => void;
}) {
  const [audits, setAudits] = useState<FigmaAudit[]>([]);
  const [selected, setSelected] = useState<FigmaAudit | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dryRun, setDryRun] = useState<{ summary: string; description: string; labels: string[] } | null>(null);

  const refresh = useCallback(async () => {
    if (!canvas?.id) return;
    setLoading(true);
    setError("");
    try {
      const res = await client.listFigmaAudits(canvas.id);
      setAudits(res.items || []);
      setSelected((prev) => {
        if (!prev) return res.items?.[0] ?? null;
        return res.items?.find((a) => a.id === prev.id) ?? res.items?.[0] ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load audits");
    } finally {
      setLoading(false);
    }
  }, [canvas?.id, client]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runDryRun = async (finding: FigmaFinding) => {
    if (!canvas?.id || !selected) return;
    setDryRun(null);
    try {
      const res = await client.dryRunFigmaFindingJira(canvas.id, selected.id, finding.id);
      setDryRun(res.issue);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dry-run failed");
    }
  };

  if (!canvas) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-[13px] text-[#7E7E7E]">
        Select a canvas to review Design Validation audits.
      </div>
    );
  }

  if (!figma && !canvas.figma) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <SiFigma size={28} color="#F24E1E" />
        <div className="text-[15px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">No Figma file linked</div>
        <p className="max-w-md text-[13px] text-[#7E7E7E]">
          Connect Figma on Integrations, then link a file on this canvas via Connect apps.
        </p>
        {onConnectApps ? (
          <button
            type="button"
            onClick={onConnectApps}
            className="rounded-[8px] bg-[#8664f2] px-4 py-2 text-[13px] font-medium text-white"
          >
            Connect apps
          </button>
        ) : null}
      </div>
    );
  }

  const linked = figma || canvas.figma;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-[15px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">
            <SiFigma size={18} color="#F24E1E" />
            Design Validation
          </div>
          <div className="mt-0.5 text-[12px] text-[#7E7E7E]">
            {linked?.fileName || linked?.fileKey} · audits from the AppAtlas Figma plugin
          </div>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void refresh()}
          className="inline-flex items-center gap-1 rounded-[8px] border border-[rgba(94,96,102,0.3)] px-3 py-1.5 text-[12.5px] dark:border-[#2a2a2a]"
        >
          <TbRefresh size={14} />
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error ? <div className="text-[12px] text-[#D97706]">{error}</div> : null}

      {audits.length === 0 && !loading ? (
        <div className="rounded-[12px] border border-dashed border-[#E5E7EB] bg-[#FAFAFA] p-6 text-center text-[13px] text-[#7E7E7E] dark:border-[#2a2a2a] dark:bg-[#101010]">
          No audits yet. Open the AppAtlas Figma plugin, pair with a code from Connect apps → Figma, select a frame,
          and run Design Validation.
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[280px_1fr]">
          <div className="overflow-y-auto rounded-[12px] border border-[#E5E7EB] dark:border-[#2a2a2a]">
            {audits.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  setSelected(a);
                  setDryRun(null);
                }}
                className={`flex w-full flex-col gap-0.5 border-b border-[#F0F0F0] px-3 py-2.5 text-left dark:border-[#1f1f1f] ${
                  selected?.id === a.id ? "bg-[#F3EEFF] dark:bg-[#1a1428]" : "hover:bg-[#F8F8F8] dark:hover:bg-[#141414]"
                }`}
              >
                <div className="text-[13px] font-medium text-[#1F1F1F] dark:text-[#ededed]">{a.frameName}</div>
                <div className="text-[11px] text-[#7E7E7E]">
                  Score {a.score} · {a.summary.errors}e / {a.summary.warns}w ·{" "}
                  {new Date(a.createdAt).toLocaleString()}
                </div>
              </button>
            ))}
          </div>

          <div className="min-h-0 overflow-y-auto rounded-[12px] border border-[#E5E7EB] p-4 dark:border-[#2a2a2a]">
            {!selected ? (
              <div className="text-[13px] text-[#7E7E7E]">Select an audit</div>
            ) : (
              <>
                <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <div className="text-[16px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">
                      {selected.frameName}
                    </div>
                    <div className="text-[12px] text-[#7E7E7E]">
                      {selected.pageName ? `${selected.pageName} · ` : ""}
                      ruleset {selected.rulesetVersion}
                      {selected.createdBy ? ` · ${selected.createdBy.name}` : ""}
                    </div>
                  </div>
                  <div
                    className={`rounded-full px-3 py-1 text-[13px] font-semibold ${
                      selected.score >= 80
                        ? "bg-[#ECFDF5] text-[#166534]"
                        : selected.score >= 50
                          ? "bg-[#FFFBEB] text-[#92400E]"
                          : "bg-[#FEF2F2] text-[#991B1B]"
                    }`}
                  >
                    Score {selected.score}
                  </div>
                </div>

                <div className="space-y-2">
                  {selected.findings.length === 0 ? (
                    <div className="text-[13px] text-[#166534]">No findings — deterministic checks passed.</div>
                  ) : (
                    selected.findings.map((f) => (
                      <div
                        key={f.id}
                        className="rounded-[10px] border border-[#ECECEC] p-3 dark:border-[#2a2a2a]"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                              f.severity === "error"
                                ? "bg-[#FEE2E2] text-[#991B1B]"
                                : f.severity === "warn"
                                  ? "bg-[#FEF3C7] text-[#92400E]"
                                  : "bg-[#E5E7EB] text-[#374151]"
                            }`}
                          >
                            {f.severity}
                          </span>
                          <span className="text-[13px] font-medium text-[#1F1F1F] dark:text-[#ededed]">
                            {f.title}
                          </span>
                          <span className="text-[11px] text-[#9CA3AF]">{f.ruleId}</span>
                        </div>
                        <p className="mt-1 text-[12.5px] text-[#4B5563] dark:text-[#9ca3af]">{f.detail}</p>
                        {f.nodeName ? (
                          <p className="mt-1 text-[11px] text-[#9CA3AF]">
                            Node: {f.nodeName} {f.nodeId ? `(${f.nodeId})` : ""}
                          </p>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void runDryRun(f)}
                          className="mt-2 text-[12px] text-[#8664F2] hover:underline"
                        >
                          Preview Jira bug (dry-run)
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {dryRun ? (
                  <div className="mt-4 rounded-[10px] border border-[#DDD6FE] bg-[#F5F3FF] p-3 text-[12.5px] dark:border-[#3b2f63] dark:bg-[#1a1428]">
                    <div className="font-semibold text-[#5B21B6] dark:text-[#C4B5FD]">Jira dry-run (not created)</div>
                    <div className="mt-1 font-medium">{dryRun.summary}</div>
                    <pre className="mt-2 whitespace-pre-wrap text-[11.5px] text-[#4B5563] dark:text-[#9ca3af]">
                      {dryRun.description}
                    </pre>
                    <div className="mt-1 text-[11px] text-[#7E7E7E]">Labels: {dryRun.labels.join(", ")}</div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
