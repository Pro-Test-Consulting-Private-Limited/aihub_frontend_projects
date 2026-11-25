"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMsal } from "@azure/msal-react";
import { SiFigma } from "react-icons/si";
import { TbLayoutGrid, TbList, TbRefresh, TbSearch, TbCloudDownload } from "react-icons/tb";
import { getFreshIdToken } from "@/app/lib/auth-client";
import { atlasUrl, type AtlasClient } from "@/app/services/appatlas";
import type { Canvas, FigmaAudit, FigmaFinding } from "@/app/interfaces/appatlas";
import type { CanvasFigma } from "@/app/lib/canvas-figma";
import { DesignValidationCompare } from "./design-validation-compare";

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
  /** visual = Figma↔Canvas compare; accessibility = WCAG checks / audits / plugin */
  panel = "visual",
}: {
  client: AtlasClient;
  canvas: Canvas | null;
  figma: CanvasFigma | null;
  onConnectApps?: () => void;
  panel?: "visual" | "accessibility";
}) {
  const { instance, accounts } = useMsal();
  const isVisual = panel === "visual";
  const [mode, setMode] = useState<"compare" | "audits" | "plugin">(isVisual ? "compare" : "compare");
  const [audits, setAudits] = useState<FigmaAudit[]>([]);
  const [selected, setSelected] = useState<FigmaAudit | null>(null);
  const [frames, setFrames] = useState<FrameRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [frameId, setFrameId] = useState("");
  const [nodeId, setNodeId] = useState("");
  const [stateId, setStateId] = useState("");
  const [pageFilter, setPageFilter] = useState<string>("all");
  const [frameQuery, setFrameQuery] = useState("");
  const [frameView, setFrameView] = useState<"grid" | "list">("grid");
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [thumbsSyncedAt, setThumbsSyncedAt] = useState<number | null>(null);
  const [loadingThumbs, setLoadingThumbs] = useState(false);
  const [syncProgress, setSyncProgress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [dryRun, setDryRun] = useState<{ summary: string; description: string; labels: string[] } | null>(null);
  const [liveFindings, setLiveFindings] = useState<FigmaFinding[] | null>(null);
  const [liveScore, setLiveScore] = useState<number | null>(null);
  const [activeFindingId, setActiveFindingId] = useState<string | null>(null);
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [findingsOpen, setFindingsOpen] = useState(true);

  const linked = figma || canvas?.figma || null;
  const fileKey = linked?.fileKey || "";

  const nodes = canvas?.nodes || [];
  const selectedNode = useMemo(() => nodes.find((n) => n.id === nodeId) || null, [nodes, nodeId]);
  const selectedFrame = useMemo(() => frames.find((f) => f.frameId === frameId) || null, [frames, frameId]);

  const pages = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of frames) map.set(f.pageId, f.pageName);
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [frames]);

  const filteredFrames = useMemo(() => {
    const q = frameQuery.trim().toLowerCase();
    return frames.filter((f) => {
      if (pageFilter !== "all" && f.pageId !== pageFilter) return false;
      if (!q) return true;
      return `${f.pageName} ${f.frameName}`.toLowerCase().includes(q);
    });
  }, [frames, pageFilter, frameQuery]);

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
        e instanceof Error ? e.message : "Could not read Figma. Reconnect your PAT on Integrations.",
      );
    } finally {
      setBusy(null);
    }
  }, [fileKey, frameId]);

  const loadCachedThumbs = useCallback(async () => {
    if (!canvas?.id) return;
    try {
      const res = await client.listFigmaThumbs(canvas.id);
      setThumbsSyncedAt(res.syncedAt);
      const map: Record<string, string> = {};
      for (const item of res.items || []) {
        if (item.frameId && item.url) map[item.frameId] = atlasUrl(item.url);
      }
      setThumbs(map);
    } catch {
      /* no cache yet */
    }
  }, [canvas?.id, client]);

  /** Manual sync: pull Figma previews via PAT in small batches, store on AppAtlas. */
  const syncFigmaThumbs = useCallback(async () => {
    if (!canvas?.id || !fileKey || frames.length === 0) return;
    setBusy("sync");
    setError("");
    setLoadingThumbs(true);
    let savedTotal = 0;
    let hitLimit = false;
    try {
      for (let i = 0; i < frames.length; i += 4) {
        const batch = frames.slice(i, i + 4);
        setSyncProgress(`Syncing previews ${Math.min(i + batch.length, frames.length)}/${frames.length}…`);
        const res = await fetch("/api/auth/figma/sync-thumbs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileKey,
            frames: batch.map((f) => ({
              frameId: f.frameId,
              frameName: f.frameName,
              pageId: f.pageId,
              pageName: f.pageName,
              width: f.width,
              height: f.height,
            })),
          }),
        });
        const data = await res.json();
        if (res.status === 429 || /rate limit/i.test(String(data.error || ""))) {
          hitLimit = true;
          setError(
            data.error ||
              "Figma rate limit hit mid-sync. Limits are per-minute (Tier 1 GET image ≈ 10–20/min on paid Dev/Full). Wait for Retry-After / the next minute, then Sync again — already saved previews stay cached.",
          );
          break;
        }
        if (!res.ok) throw new Error(data.error || "Sync batch failed");
        if (data.items?.length) {
          const saved = await client.saveFigmaThumbs(canvas.id, { items: data.items });
          savedTotal += saved.saved || 0;
          setThumbsSyncedAt(saved.syncedAt);
        }
        // Pause between batches to stay under Figma limits.
        await new Promise((r) => setTimeout(r, 2000));
      }
      await loadCachedThumbs();
      if (!hitLimit) {
        setSyncProgress(savedTotal ? `Synced ${savedTotal} previews` : "No new previews");
        setTimeout(() => setSyncProgress(null), 2500);
      } else {
        setSyncProgress(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sync Figma previews");
      setSyncProgress(null);
    } finally {
      setBusy(null);
      setLoadingThumbs(false);
    }
  }, [canvas?.id, client, fileKey, frames, loadCachedThumbs]);

  useEffect(() => {
    void refreshAudits();
  }, [refreshAudits]);

  useEffect(() => {
    if (linked?.fileKey) void loadFrames();
  }, [linked?.fileKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (canvas?.id) void loadCachedThumbs();
  }, [canvas?.id, loadCachedThumbs]);

  useEffect(() => {
    if (!nodeId && nodes[0]?.id) setNodeId(nodes[0].id);
  }, [nodes, nodeId]);

  const runChecksFromPat = async () => {
    if (!canvas?.id || !fileKey || !selectedFrame) return;
    setBusy("checks");
    setError("");
    setLiveFindings(null);
    setLiveScore(null);
    setFindingsOpen(true);
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
        Select a canvas to review {isVisual ? "Visual Testing" : "Accessibility checks"}.
      </div>
    );
  }

  if (!linked) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <SiFigma size={28} color="#F24E1E" />
        <div className="text-[15px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">No Figma file linked</div>
        <p className="max-w-md text-[13px] text-[#7E7E7E]">
          Connect Figma with a PAT on Integrations, then link a file on this canvas.
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

  const modeButtons = isVisual
    ? ([["compare", "Figma ↔ Canvas"]] as const)
    : ([
        ["compare", "WCAG checks"],
        ["audits", "Saved audits"],
        ["plugin", "In-Figma plugin"],
      ] as const);

  return (
    <div className={`flex min-h-0 flex-col gap-3 ${isVisual ? "h-full p-3 md:p-4" : "h-full"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-[15px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">
            <SiFigma size={18} color="#F24E1E" />
            {isVisual ? "Visual Testing" : "WCAG / design checks"}
          </div>
          <div className="mt-0.5 text-[12px] text-[#7E7E7E]">
            {fileName || linked.fileName || linked.fileKey}
            {selectedFrame ? ` · ${selectedFrame.pageName} / ${selectedFrame.frameName}` : ""}
            {selectedNode ? ` ↔ ${selectedNode.title || selectedNode.path}` : ""}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {modeButtons.map(([id, label]) => (
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

      {mode === "plugin" && !isVisual ? (
        <div className="rounded-[12px] border border-[#E5E7EB] bg-[#FAFAFA] p-5 text-[13px] dark:border-[#2a2a2a] dark:bg-[#101010]">
          <div className="font-semibold">Designer flow (optional)</div>
          <p className="mt-2 text-[#7E7E7E]">
            Use the AppAtlas Figma plugin for in-Figma WCAG feedback while designing. Recorded-screen health and axe
            results live under Health on this Accessibility tab.
          </p>
        </div>
      ) : null}

      {mode === "compare" ? (
        <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[320px_minmax(0,1fr)]">
          {/* Left rail: frame explorer + mapping */}
          <aside className="flex min-h-0 flex-col gap-3 overflow-hidden">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[12px] border border-[#E5E7EB] dark:border-[#2a2a2a]">
              <div className="shrink-0 space-y-2 border-b border-[#F0F0F0] p-3 dark:border-[#1f1f1f]">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
                    Frame explorer
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title="Sync Figma previews to AppAtlas (avoids rate limits on every visit)"
                      disabled={!!busy || frames.length === 0}
                      onClick={() => void syncFigmaThumbs()}
                      className="inline-flex items-center gap-1 rounded-[6px] border border-[#8664f2]/50 px-2 py-0.5 text-[11px] font-medium text-[#8664f2] disabled:opacity-50"
                    >
                      <TbCloudDownload size={12} />
                      {busy === "sync" ? "Syncing…" : "Sync"}
                    </button>
                    <button
                      type="button"
                      title="Grid"
                      onClick={() => setFrameView("grid")}
                      className={`rounded p-1 ${frameView === "grid" ? "bg-[#F3EEFF] text-[#8664f2]" : "text-[#9CA3AF]"}`}
                    >
                      <TbLayoutGrid size={14} />
                    </button>
                    <button
                      type="button"
                      title="List"
                      onClick={() => setFrameView("list")}
                      className={`rounded p-1 ${frameView === "list" ? "bg-[#F3EEFF] text-[#8664f2]" : "text-[#9CA3AF]"}`}
                    >
                      <TbList size={14} />
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <TbSearch className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={14} />
                  <input
                    value={frameQuery}
                    onChange={(e) => setFrameQuery(e.target.value)}
                    placeholder="Search frames"
                    className="w-full rounded-[8px] border border-[#E5E7EB] bg-white py-1.5 pl-7 pr-2 text-[12.5px] dark:border-[#2a2a2a] dark:bg-[#141414]"
                  />
                </div>
                <div className="flex gap-1 overflow-x-auto pb-0.5">
                  <button
                    type="button"
                    onClick={() => setPageFilter("all")}
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] ${
                      pageFilter === "all" ? "bg-[#8664f2] text-white" : "bg-[#F3F4F6] text-[#5E6066] dark:bg-[#1a1a1a]"
                    }`}
                  >
                    All pages
                  </button>
                  {pages.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPageFilter(p.id)}
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] ${
                        pageFilter === p.id
                          ? "bg-[#8664f2] text-white"
                          : "bg-[#F3F4F6] text-[#5E6066] dark:bg-[#1a1a1a]"
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
                {syncProgress ? (
                  <div className="text-[11px] text-[#8664f2]">{syncProgress}</div>
                ) : thumbsSyncedAt ? (
                  <div className="text-[11px] text-[#9CA3AF]">
                    Cached {new Date(thumbsSyncedAt).toLocaleString()} · Sync to refresh
                  </div>
                ) : Object.keys(thumbs).length === 0 && frames.length > 0 ? (
                  <div className="text-[11px] text-[#D97706]">
                    No cached previews yet — click Sync once (avoids Figma rate limits on every load)
                  </div>
                ) : loadingThumbs || busy === "frames" ? (
                  <div className="text-[11px] text-[#9CA3AF]">
                    {busy === "frames" ? "Loading frames…" : "Loading thumbnails…"}
                  </div>
                ) : null}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {filteredFrames.length === 0 ? (
                  <div className="p-3 text-[12px] text-[#7E7E7E]">No frames match.</div>
                ) : frameView === "grid" ? (
                  <div className="grid grid-cols-2 gap-2">
                    {filteredFrames.map((f) => {
                      const selected = f.frameId === frameId;
                      return (
                        <button
                          key={f.frameId}
                          type="button"
                          onClick={() => setFrameId(f.frameId)}
                          className={`overflow-hidden rounded-[10px] border text-left transition ${
                            selected
                              ? "border-[#8664f2] ring-2 ring-[#8664f2]/35"
                              : "border-[#E5E7EB] hover:border-[#C4B5FD] dark:border-[#2a2a2a]"
                          }`}
                        >
                          <div className="aspect-[4/3] bg-[#F8FAFC] dark:bg-[#0f0f0f]">
                            {thumbs[f.frameId] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={thumbs[f.frameId]}
                                alt={f.frameName}
                                className="h-full w-full object-cover object-top"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center text-[10px] text-[#9CA3AF]">
                                Preview
                              </div>
                            )}
                          </div>
                          <div className="space-y-0.5 p-2">
                            <div className="truncate text-[12px] font-medium text-[#1F1F1F] dark:text-[#ededed]">
                              {f.frameName}
                            </div>
                            <div className="truncate text-[10px] text-[#7E7E7E]">
                              {f.pageName}
                              {f.width ? ` · ${Math.round(f.width)}×${Math.round(f.height || 0)}` : ""}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredFrames.map((f) => {
                      const selected = f.frameId === frameId;
                      return (
                        <button
                          key={f.frameId}
                          type="button"
                          onClick={() => setFrameId(f.frameId)}
                          className={`flex w-full items-center gap-2 rounded-[8px] border px-2 py-1.5 text-left ${
                            selected
                              ? "border-[#8664f2] bg-[#F3EEFF] dark:bg-[#1a1428]"
                              : "border-transparent hover:bg-[#F8F8F8] dark:hover:bg-[#141414]"
                          }`}
                        >
                          <div className="h-10 w-14 shrink-0 overflow-hidden rounded bg-[#F3F4F6] dark:bg-[#1a1a1a]">
                            {thumbs[f.frameId] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={thumbs[f.frameId]} alt="" className="h-full w-full object-cover object-top" />
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-[12.5px] font-medium">{f.frameName}</div>
                            <div className="truncate text-[10px] text-[#7E7E7E]">
                              {f.pageName}
                              {f.width ? ` · ${Math.round(f.width)}×${Math.round(f.height || 0)}` : ""}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex max-h-[340px] shrink-0 flex-col overflow-hidden rounded-[12px] border border-[#E5E7EB] dark:border-[#2a2a2a]">
              <div className="shrink-0 space-y-1 border-b border-[#F0F0F0] p-3 dark:border-[#1f1f1f]">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
                  Canvas screenshots
                </div>
                <div className="text-[11px] text-[#9CA3AF]">
                  Pick the recorded screen (and state) to compare against the Figma frame
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {nodes.length === 0 ? (
                  <div className="p-3 text-[12px] text-[#7E7E7E]">No recorded screens on this canvas.</div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {nodes.map((n) => {
                      const selected = n.id === nodeId && !stateId;
                      const primaryUrl = n.screenshotUrl ? atlasUrl(n.screenshotUrl) : "";
                      return (
                        <div key={n.id} className="space-y-1">
                          <button
                            type="button"
                            onClick={() => {
                              setNodeId(n.id);
                              setStateId("");
                            }}
                            className={`w-full overflow-hidden rounded-[10px] border text-left transition ${
                              selected
                                ? "border-[#8664f2] ring-2 ring-[#8664f2]/35"
                                : "border-[#E5E7EB] hover:border-[#C4B5FD] dark:border-[#2a2a2a]"
                            }`}
                          >
                            <div className="aspect-[4/3] bg-[#F8FAFC] dark:bg-[#0f0f0f]">
                              {primaryUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={primaryUrl}
                                  alt={n.title || n.path}
                                  className="h-full w-full object-cover object-top"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center text-[10px] text-[#9CA3AF]">
                                  No shot
                                </div>
                              )}
                            </div>
                            <div className="space-y-0.5 p-2">
                              <div className="truncate text-[12px] font-medium text-[#1F1F1F] dark:text-[#ededed]">
                                {n.title || n.path || n.id}
                              </div>
                              <div className="truncate text-[10px] text-[#7E7E7E]">
                                {n.path || "Primary"}
                                {n.states.length > 0 ? ` · ${n.states.length} state${n.states.length === 1 ? "" : "s"}` : ""}
                              </div>
                            </div>
                          </button>
                          {n.id === nodeId && n.states.length > 0 ? (
                            <div className="grid grid-cols-2 gap-1 pl-0.5">
                              {n.states.map((s) => {
                                const stSelected = stateId === s.id;
                                const stUrl = s.screenshotUrl ? atlasUrl(s.screenshotUrl) : "";
                                return (
                                  <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => {
                                      setNodeId(n.id);
                                      setStateId(s.id);
                                    }}
                                    className={`overflow-hidden rounded-[8px] border text-left ${
                                      stSelected
                                        ? "border-[#8664f2] ring-1 ring-[#8664f2]/40"
                                        : "border-[#E5E7EB] dark:border-[#2a2a2a]"
                                    }`}
                                  >
                                    <div className="aspect-[4/3] bg-[#F8FAFC] dark:bg-[#0f0f0f]">
                                      {stUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                          src={stUrl}
                                          alt={s.label || s.kind}
                                          className="h-full w-full object-cover object-top"
                                        />
                                      ) : (
                                        <div className="flex h-full items-center justify-center text-[9px] text-[#9CA3AF]">
                                          —
                                        </div>
                                      )}
                                    </div>
                                    <div className="truncate px-1.5 py-1 text-[10px] text-[#5E6066]">
                                      {s.label || s.kind || "State"}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="shrink-0 space-y-2 border-t border-[#F0F0F0] p-3 dark:border-[#1f1f1f]">
                {!isVisual ? (
                  <button
                    type="button"
                    disabled={!!busy || !selectedFrame}
                    onClick={() => void runChecksFromPat()}
                    className="w-full rounded-[8px] bg-[#8664f2] px-3 py-2 text-[12.5px] font-medium text-white disabled:opacity-60"
                  >
                    {busy === "checks" ? "Running checks…" : "Run WCAG / design checks"}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!!busy || !selectedFrame || !nodeId}
                    onClick={() => void runVisualDiff()}
                    className="w-full rounded-[8px] bg-[#8664f2] px-3 py-2 text-[12.5px] font-medium text-white disabled:opacity-60"
                  >
                    {busy === "diff" ? "Comparing…" : "Run visual comparison"}
                  </button>
                )}
              </div>
            </div>
          </aside>

          {/* Main workspace */}
          <section className="flex min-h-0 min-w-0 flex-col gap-3">
            {isVisual ? (
            <div className="min-h-[320px] flex-1 overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-[#FAFAFA] p-2 dark:border-[#2a2a2a] dark:bg-[#0f0f0f] md:min-h-0">
              {diff ? (
                <DesignValidationCompare
                  figmaUrl={diff.figmaUrl}
                  recordedUrl={diff.recordedUrl}
                  diffUrl={diff.diffUrl}
                  percentChanged={diff.percentChanged}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-[13px] text-[#7E7E7E]">
                  <div className="text-[14px] font-medium text-[#1F1F1F] dark:text-[#ededed]">
                    Visual comparison workspace
                  </div>
                  <p className="max-w-md">
                    Select a frame and canvas screen, then run visual comparison. Modes (side-by-side, overlay, onion,
                    swipe, difference map) appear here without regenerating images when you switch.
                  </p>
                </div>
              )}
            </div>
            ) : liveScore == null && !(liveFindings && liveFindings.length) ? (
            <div className="flex min-h-[200px] flex-1 flex-col items-center justify-center gap-2 rounded-[12px] border border-dashed border-[#E5E7EB] p-6 text-center text-[13px] text-[#7E7E7E] dark:border-[#2a2a2a]">
              <div className="text-[14px] font-medium text-[#1F1F1F] dark:text-[#ededed]">WCAG findings</div>
              <p className="max-w-md">
                Pick a Figma frame, then run WCAG / design checks. Findings appear below. Saved audits and the in-Figma
                plugin are in the tabs above.
              </p>
            </div>
            ) : null}

            {!isVisual && (liveScore != null || (liveFindings && liveFindings.length > 0)) && (
              <div className="max-h-[240px] shrink-0 overflow-hidden rounded-[12px] border border-[#E5E7EB] dark:border-[#2a2a2a]">
                <button
                  type="button"
                  onClick={() => setFindingsOpen((v) => !v)}
                  className="flex w-full items-center justify-between border-b border-[#F0F0F0] px-3 py-2 text-left dark:border-[#1f1f1f]"
                >
                  <span className="text-[13px] font-semibold">
                    Design score {liveScore ?? "—"}
                    <span className="ml-2 text-[11px] font-normal text-[#7E7E7E]">
                      {(liveFindings || []).length} finding{(liveFindings || []).length === 1 ? "" : "s"}
                    </span>
                  </span>
                  <span className="text-[11px] text-[#8664f2]">{findingsOpen ? "Hide" : "Show"}</span>
                </button>
                {findingsOpen ? (
                  <div className="max-h-[190px] space-y-1.5 overflow-y-auto p-2">
                    {(liveFindings || []).length === 0 ? (
                      <div className="p-2 text-[12.5px] text-[#166534]">No findings on this frame.</div>
                    ) : (
                      (liveFindings || []).map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setActiveFindingId(f.id)}
                          className={`w-full rounded-[8px] border p-2.5 text-left text-[12.5px] ${
                            activeFindingId === f.id
                              ? "border-[#8664f2] bg-[#F3EEFF] dark:bg-[#1a1428]"
                              : "border-[#ECECEC] dark:border-[#2a2a2a]"
                          }`}
                        >
                          <span
                            className={`mr-2 text-[10px] font-semibold uppercase ${
                              f.severity === "error"
                                ? "text-[#991B1B]"
                                : f.severity === "warn"
                                  ? "text-[#92400E]"
                                  : "text-[#4B5563]"
                            }`}
                          >
                            {f.severity}
                          </span>
                          <span className="font-medium">{f.title}</span>
                          <div className="mt-1 text-[#6B7280]">{f.detail}</div>
                          {f.nodeName ? (
                            <div className="mt-1 text-[10.5px] text-[#9CA3AF]">
                              Node: {f.nodeName}
                              {f.nodeId ? ` (${f.nodeId})` : ""}
                            </div>
                          ) : null}
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </div>
      ) : null}

      {mode === "audits" ? (
        audits.length === 0 && !loading ? (
          <div className="rounded-[12px] border border-dashed border-[#E5E7EB] p-6 text-center text-[13px] text-[#7E7E7E] dark:border-[#2a2a2a]">
            No saved audits yet. Run WCAG / design checks from this tab.
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
                  <div className="text-[13px] font-medium">{a.frameName}</div>
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
