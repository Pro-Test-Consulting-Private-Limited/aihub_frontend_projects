"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMsal } from "@azure/msal-react";
import { SiFigma } from "react-icons/si";
import { TbRefresh } from "react-icons/tb";
import { getFreshIdToken } from "@/app/lib/auth-client";
import { atlasUrl, type AtlasClient } from "@/app/services/appatlas";
import type { Canvas, FigmaAudit, FigmaFinding } from "@/app/interfaces/appatlas";
import type { CanvasFigma } from "@/app/lib/canvas-figma";

type FrameRow = {
  pageId: string;
  pageName: string;
  frameId: string;
  frameName: string;
  width: number | null;
  height: number | null;
};

type DiffResult = {
  percentChanged: number;
  changed: boolean;
  figmaUrl: string;
  recordedUrl: string;
  diffUrl: string;
  frameName: string | null;
};

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
  const { instance, accounts } = useMsal();
  const [mode, setMode] = useState<"compare" | "audits" | "plugin">("compare");
  const [audits, setAudits] = useState<FigmaAudit[]>([]);
  const [selected, setSelected] = useState<FigmaAudit | null>(null);
  const [frames, setFrames] = useState<FrameRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [frameId, setFrameId] = useState("");
  const [nodeId, setNodeId] = useState("");
  const [stateId, setStateId] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [dryRun, setDryRun] = useState<{ summary: string; description: string; labels: string[] } | null>(null);
  const [liveFindings, setLiveFindings] = useState<FigmaFinding[] | null>(null);
  const [liveScore, setLiveScore] = useState<number | null>(null);
  const [diff, setDiff] = useState<DiffResult | null>(null);

  const linked = figma || canvas?.figma || null;
  const fileKey = linked?.fileKey || "";

  const nodes = canvas?.nodes || [];
  const selectedNode = useMemo(() => nodes.find((n) => n.id === nodeId) || null, [nodes, nodeId]);
  const selectedFrame = useMemo(() => frames.find((f) => f.frameId === frameId) || null, [frames, frameId]);

  const authHeaders = useCallback(async () => {
    const token = await getFreshIdToken(instance, accounts);
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, [instance, accounts]);

  const refreshAudits = useCallback(async () => {
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

  const loadFrames = useCallback(async () => {
    if (!fileKey) return;
    setBusy("frames");
    setError("");
    try {
      const res = await fetch(`/api/auth/figma/file?fileKey=${encodeURIComponent(fileKey)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not read Figma file");
      setFileName(data.name || null);
      setFrames(data.frames || []);
      if (!frameId && data.frames?.[0]?.frameId) setFrameId(data.frames[0].frameId);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not read Figma. Reconnect your PAT on Integrations.",
      );
    } finally {
      setBusy(null);
    }
  }, [fileKey, frameId]);

  useEffect(() => {
    void refreshAudits();
  }, [refreshAudits]);

  useEffect(() => {
    if (linked?.fileKey) void loadFrames();
  }, [linked?.fileKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!nodeId && nodes[0]?.id) setNodeId(nodes[0].id);
  }, [nodes, nodeId]);

  const runChecksFromPat = async () => {
    if (!canvas?.id || !fileKey || !selectedFrame) return;
    setBusy("checks");
    setError("");
    setLiveFindings(null);
    setLiveScore(null);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/auth/figma/run-checks", {
        method: "POST",
        headers,
        body: JSON.stringify({
          fileKey,
          frameId: selectedFrame.frameId,
          frameName: selectedFrame.frameName,
          pageId: selectedFrame.pageId,
          pageName: selectedFrame.pageName,
          canvasId: canvas.id,
          screenNodeId: nodeId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checks failed");
      setLiveFindings(data.findings || []);
      setLiveScore(typeof data.score === "number" ? data.score : null);
      if (data.saved) await refreshAudits();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checks failed");
    } finally {
      setBusy(null);
    }
  };

  const runVisualDiff = async () => {
    if (!canvas?.id || !fileKey || !selectedFrame || !nodeId) return;
    setBusy("diff");
    setError("");
    setDiff(null);
    try {
      const imgRes = await fetch("/api/auth/figma/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileKey, ids: [selectedFrame.frameId], scale: 2 }),
      });
      const imgData = await imgRes.json();
      if (!imgRes.ok) throw new Error(imgData.error || "Could not export Figma frame");
      const figmaImageUrl = imgData.images?.[selectedFrame.frameId];
      if (!figmaImageUrl) throw new Error("Figma did not return an image for that frame");

      const result = await client.figmaVisualDiff(canvas.id, {
        nodeId,
        stateId: stateId || null,
        figmaImageUrl,
        frameId: selectedFrame.frameId,
        frameName: selectedFrame.frameName,
      });
      setDiff({
        percentChanged: result.percentChanged,
        changed: result.changed,
        figmaUrl: result.figmaUrl,
        recordedUrl: result.recordedUrl,
        diffUrl: result.diffUrl,
        frameName: result.frameName,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Visual diff failed");
    } finally {
      setBusy(null);
    }
  };

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
        Select a canvas to review Design Validation.
      </div>
    );
  }

  if (!linked) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <SiFigma size={28} color="#F24E1E" />
        <div className="text-[15px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">No Figma file linked</div>
        <p className="max-w-md text-[13px] text-[#7E7E7E]">
          Connect Figma with a PAT on Integrations, then link a file on this canvas. AppAtlas will read frames via the
          Figma API — no plugin required for visual compare.
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

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-[15px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">
            <SiFigma size={18} color="#F24E1E" />
            Design Validation
          </div>
          <div className="mt-0.5 text-[12px] text-[#7E7E7E]">
            {fileName || linked.fileName || linked.fileKey} · PAT reads designs from Figma
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["compare", "Figma ↔ Canvas"],
              ["audits", "Saved audits"],
              ["plugin", "In-Figma plugin"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={`rounded-full px-3 py-1 text-[12px] font-medium ${
                mode === id
                  ? "bg-[#8664f2] text-white"
                  : "border border-[#E5E7EB] text-[#5E6066] dark:border-[#2a2a2a]"
              }`}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            disabled={loading || busy === "frames"}
            onClick={() => {
              void loadFrames();
              void refreshAudits();
            }}
            className="inline-flex items-center gap-1 rounded-[8px] border border-[rgba(94,96,102,0.3)] px-3 py-1.5 text-[12.5px] dark:border-[#2a2a2a]"
          >
            <TbRefresh size={14} />
            Refresh
          </button>
        </div>
      </div>

      {error ? <div className="text-[12px] text-[#D97706]">{error}</div> : null}

      {mode === "plugin" ? (
        <div className="rounded-[12px] border border-[#E5E7EB] bg-[#FAFAFA] p-5 text-[13px] dark:border-[#2a2a2a] dark:bg-[#101010]">
          <div className="font-semibold text-[#1F1F1F] dark:text-[#ededed]">Designer flow (optional)</div>
          <p className="mt-2 text-[#7E7E7E]">
            Use the AppAtlas Figma plugin when someone is designing <em>inside Figma</em> and wants WCAG-style feedback
            on the selected frame immediately. Pairing code comes from Connect apps → Figma.
          </p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-[#4B5563] dark:text-[#9ca3af]">
            <li>Import <code className="text-[12px]">figma-plugin/manifest.json</code> as a Figma Development plugin</li>
            <li>Generate a pairing code on this canvas</li>
            <li>Select a frame → Validate → findings also land here under Saved audits</li>
          </ol>
          <p className="mt-3 text-[#7E7E7E]">
            For QA in AppAtlas after a crawl, stay on <strong>Figma ↔ Canvas</strong> — that uses your PAT and does not
            need the plugin.
          </p>
        </div>
      ) : null}

      {mode === "compare" ? (
        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-2">
          <div className="space-y-3 overflow-y-auto rounded-[12px] border border-[#E5E7EB] p-4 dark:border-[#2a2a2a]">
            <div className="text-[12px] font-semibold uppercase tracking-wide text-[#6B7280]">From Figma (PAT)</div>
            <label className="block text-[12px] font-medium">
              Frame
              <select
                className="mt-1 w-full rounded-[8px] border border-[#E5E7EB] bg-white px-2 py-2 text-[13px] dark:border-[#2a2a2a] dark:bg-[#141414]"
                value={frameId}
                onChange={(e) => setFrameId(e.target.value)}
              >
                {frames.length === 0 ? <option value="">No frames loaded</option> : null}
                {frames.map((f) => (
                  <option key={f.frameId} value={f.frameId}>
                    {f.pageName} / {f.frameName}
                    {f.width ? ` (${Math.round(f.width)}×${Math.round(f.height || 0)})` : ""}
                  </option>
                ))}
              </select>
            </label>

            <div className="text-[12px] font-semibold uppercase tracking-wide text-[#6B7280]">Canvas screen</div>
            <label className="block text-[12px] font-medium">
              Screen / node
              <select
                className="mt-1 w-full rounded-[8px] border border-[#E5E7EB] bg-white px-2 py-2 text-[13px] dark:border-[#2a2a2a] dark:bg-[#141414]"
                value={nodeId}
                onChange={(e) => {
                  setNodeId(e.target.value);
                  setStateId("");
                }}
              >
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title || n.path || n.id}
                  </option>
                ))}
              </select>
            </label>
            {selectedNode && selectedNode.states.length > 0 ? (
              <label className="block text-[12px] font-medium">
                State (optional)
                <select
                  className="mt-1 w-full rounded-[8px] border border-[#E5E7EB] bg-white px-2 py-2 text-[13px] dark:border-[#2a2a2a] dark:bg-[#141414]"
                  value={stateId}
                  onChange={(e) => setStateId(e.target.value)}
                >
                  <option value="">Primary screenshot</option>
                  {selectedNode.states.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label || s.kind || s.id}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                disabled={!!busy || !selectedFrame}
                onClick={() => void runChecksFromPat()}
                className="rounded-[8px] bg-[#8664f2] px-3 py-2 text-[12.5px] font-medium text-white disabled:opacity-60"
              >
                {busy === "checks" ? "Running checks…" : "Run design checks (WCAG-style)"}
              </button>
              <button
                type="button"
                disabled={!!busy || !selectedFrame || !nodeId}
                onClick={() => void runVisualDiff()}
                className="rounded-[8px] border border-[#8664f2] px-3 py-2 text-[12.5px] font-medium text-[#8664f2] disabled:opacity-60"
              >
                {busy === "diff" ? "Comparing…" : "Visual diff vs screen"}
              </button>
            </div>
          </div>

          <div className="min-h-0 space-y-3 overflow-y-auto rounded-[12px] border border-[#E5E7EB] p-4 dark:border-[#2a2a2a]">
            {liveScore != null ? (
              <div>
                <div className="mb-2 text-[13px] font-semibold">
                  Design score {liveScore}
                  <span className="ml-2 text-[11px] font-normal text-[#7E7E7E]">from Figma API + PAT</span>
                </div>
                {(liveFindings || []).length === 0 ? (
                  <div className="text-[12.5px] text-[#166534]">No findings on this frame.</div>
                ) : (
                  <div className="space-y-2">
                    {(liveFindings || []).map((f) => (
                      <div key={f.id} className="rounded-[8px] border border-[#ECECEC] p-2.5 text-[12.5px] dark:border-[#2a2a2a]">
                        <span className="mr-2 text-[10px] font-semibold uppercase text-[#92400E]">{f.severity}</span>
                        <span className="font-medium">{f.title}</span>
                        <div className="mt-1 text-[#6B7280]">{f.detail}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {diff ? (
              <div>
                <div className="mb-2 text-[13px] font-semibold">
                  Visual diff · {diff.percentChanged}% changed
                  {diff.changed ? " · differences found" : " · closely matches"}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ["Figma", diff.figmaUrl],
                      ["Recorded", diff.recordedUrl],
                      ["Diff", diff.diffUrl],
                    ] as const
                  ).map(([label, url]) => (
                    <div key={label} className="overflow-hidden rounded-[8px] border border-[#E5E7EB] dark:border-[#2a2a2a]">
                      <div className="bg-[#F8FAFC] px-2 py-1 text-[10px] font-semibold uppercase text-[#6B7280] dark:bg-[#141414]">
                        {label}
                      </div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={atlasUrl(url)} alt={label} className="aspect-[3/4] w-full object-contain bg-white" />
                    </div>
                  ))}
                </div>
              </div>
            ) : !liveFindings ? (
              <div className="text-[13px] text-[#7E7E7E]">
                Pick a Figma frame and a crawled screen, then run design checks and/or visual diff. Frames are loaded
                with your Figma PAT — the plugin is only needed for in-Figma feedback while designing.
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {mode === "audits" ? (
        audits.length === 0 && !loading ? (
          <div className="rounded-[12px] border border-dashed border-[#E5E7EB] bg-[#FAFAFA] p-6 text-center text-[13px] text-[#7E7E7E] dark:border-[#2a2a2a] dark:bg-[#101010]">
            No saved audits yet. Run design checks from the Figma ↔ Canvas tab (or from the plugin).
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
                    Score {a.score} · {new Date(a.createdAt).toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
            <div className="min-h-0 overflow-y-auto rounded-[12px] border border-[#E5E7EB] p-4 dark:border-[#2a2a2a]">
              {!selected ? (
                <div className="text-[13px] text-[#7E7E7E]">Select an audit</div>
              ) : (
                <>
                  <div className="mb-3 text-[16px] font-semibold">
                    {selected.frameName} · score {selected.score}
                  </div>
                  <div className="space-y-2">
                    {selected.findings.map((f) => (
                      <div key={f.id} className="rounded-[10px] border border-[#ECECEC] p-3 dark:border-[#2a2a2a]">
                        <div className="text-[13px] font-medium">
                          <span className="mr-2 text-[10px] uppercase text-[#92400E]">{f.severity}</span>
                          {f.title}
                        </div>
                        <p className="mt-1 text-[12.5px] text-[#4B5563] dark:text-[#9ca3af]">{f.detail}</p>
                        <button
                          type="button"
                          onClick={() => void runDryRun(f)}
                          className="mt-2 text-[12px] text-[#8664F2] hover:underline"
                        >
                          Preview Jira bug (dry-run)
                        </button>
                      </div>
                    ))}
                  </div>
                  {dryRun ? (
                    <div className="mt-4 rounded-[10px] border border-[#DDD6FE] bg-[#F5F3FF] p-3 text-[12.5px] dark:border-[#3b2f63] dark:bg-[#1a1428]">
                      <div className="font-semibold">Jira dry-run (not created)</div>
                      <div className="mt-1 font-medium">{dryRun.summary}</div>
                      <pre className="mt-2 whitespace-pre-wrap text-[11.5px]">{dryRun.description}</pre>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}
