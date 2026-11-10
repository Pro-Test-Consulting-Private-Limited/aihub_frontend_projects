"use client";

import { useEffect, useMemo, useState } from "react";
import type { AtlasClient } from "@/app/services/appatlas";
import { atlasUrl } from "@/app/services/appatlas";
import type { CanvasSummary } from "@/app/interfaces/appatlas";
import { Modal, fieldInput, fieldLabel, outlineButton, primaryButton } from "./modal";

type DiffPair = {
  path: string;
  leftNodeId: string;
  leftUrl: string;
  rightUrl: string;
  diffUrl: string;
  percentChanged: number;
  changed: boolean;
};

export function PhaseCToolsModal({
  client,
  canvasId,
  canvasName,
  canvases,
  flags,
  onClose,
  onChangedNodes,
}: {
  client: AtlasClient;
  canvasId: string;
  canvasName: string;
  canvases: CanvasSummary[];
  flags: { visualDiff: boolean; responsiveSheet: boolean; shareExport: boolean };
  onClose: () => void;
  onChangedNodes: (ids: string[], releaseLabel: string | null) => void;
}) {
  const baselines = useMemo(() => canvases.filter((c) => c.id !== canvasId), [canvases, canvasId]);
  const [tab, setTab] = useState<"diff" | "sheet" | "share">(
    flags.visualDiff ? "diff" : flags.responsiveSheet ? "sheet" : "share",
  );
  const [baselineId, setBaselineId] = useState(baselines[0]?.id ?? "");
  const [releaseLabel, setReleaseLabel] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pairs, setPairs] = useState<DiffPair[] | null>(null);
  const [mode, setMode] = useState<"slider" | "onion" | "highlight">("slider");
  const [slider, setSlider] = useState(50);
  const [active, setActive] = useState(0);
  const [engineNote, setEngineNote] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Awaited<ReturnType<AtlasClient["responsiveSheet"]>> | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!flags.responsiveSheet) return;
    void client
      .responsiveSheetEngine(canvasId)
      .then((r) => setEngineNote(r.engine.note))
      .catch(() => setEngineNote(null));
  }, [client, canvasId, flags.responsiveSheet]);

  const runDiff = async () => {
    if (!baselineId) return;
    setBusy("diff");
    setError(null);
    try {
      const res = await client.visualDiff(canvasId, {
        rightCanvasId: baselineId,
        releaseLabel: releaseLabel.trim() || undefined,
      });
      setPairs(res.pairs);
      setActive(0);
      onChangedNodes(res.changedNodeIds, res.releaseLabel);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Visual diff failed");
    } finally {
      setBusy(null);
    }
  };

  const runSheet = async () => {
    setBusy("sheet");
    setError(null);
    try {
      const res = await client.responsiveSheet(canvasId, { maxScreens: 6 });
      setSheet(res);
      setEngineNote(res.engine.note);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Contact sheet failed");
    } finally {
      setBusy(null);
    }
  };

  const runShare = async () => {
    setBusy("share");
    setError(null);
    try {
      const link = await client.createShareLink(canvasId, { expiresInHours: 72 });
      setShareUrl(`${window.location.origin}/atlas-api${link.urlPath}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create share link");
    } finally {
      setBusy(null);
    }
  };

  const runPdf = async () => {
    setBusy("pdf");
    setError(null);
    try {
      const res = await client.exportCanvasPoster(canvasId);
      setPdfUrl(atlasUrl(res.pdfUrl));
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF export failed");
    } finally {
      setBusy(null);
    }
  };

  const pair = pairs?.[active];

  return (
    <Modal title={`Phase C · ${canvasName}`} onClose={onClose} width={720}>
      <div className="mt-3 flex gap-2 text-[12px]">
        {flags.visualDiff && (
          <button type="button" className={tab === "diff" ? primaryButton : outlineButton} onClick={() => setTab("diff")}>
            Visual diff
          </button>
        )}
        {flags.responsiveSheet && (
          <button type="button" className={tab === "sheet" ? primaryButton : outlineButton} onClick={() => setTab("sheet")}>
            Contact sheet
          </button>
        )}
        {flags.shareExport && (
          <button type="button" className={tab === "share" ? primaryButton : outlineButton} onClick={() => setTab("share")}>
            Share & export
          </button>
        )}
      </div>

      {error && <div className="mt-3 rounded-[8px] bg-[#FDF1F1] px-3 py-2 text-[12px] text-[#991B1B]">{error}</div>}

      {tab === "diff" && flags.visualDiff && (
        <div className="mt-4 space-y-3" data-testid="phase-c-visual-diff">
          <label className={fieldLabel}>Baseline canvas (Release)</label>
          <select className={fieldInput} value={baselineId} onChange={(e) => setBaselineId(e.target.value)} disabled={!!busy}>
            {baselines.length === 0 && <option value="">No other canvases</option>}
            {baselines.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <label className={fieldLabel}>Release label (badge text)</label>
          <input
            className={fieldInput}
            value={releaseLabel}
            onChange={(e) => setReleaseLabel(e.target.value)}
            placeholder="e.g. Release 1.4"
            disabled={!!busy}
          />
          <div className="flex justify-end">
            <button type="button" className={primaryButton} disabled={!!busy || !baselineId} onClick={() => void runDiff()}>
              {busy === "diff" ? "Comparing…" : "Compare"}
            </button>
          </div>

          {pairs && (
            <>
              <div className="flex flex-wrap gap-2 text-[11px]">
                {(["slider", "onion", "highlight"] as const).map((m) => (
                  <button key={m} type="button" className={mode === m ? primaryButton : outlineButton} onClick={() => setMode(m)}>
                    {m}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 overflow-x-auto text-[11px]">
                {pairs.map((p, i) => (
                  <button
                    key={p.leftNodeId}
                    type="button"
                    onClick={() => setActive(i)}
                    className={`shrink-0 rounded-[6px] border px-2 py-1 ${
                      i === active ? "border-[#8664F2] text-[#8664F2]" : "border-[#E5E7EB] text-[#5E6066]"
                    }`}
                  >
                    {p.path} · {p.percentChanged}%
                  </button>
                ))}
              </div>
              {pair && (
                <div className="relative overflow-hidden rounded-[10px] border border-[#E5E7EB] bg-[#111] h-[320px]">
                  {mode === "slider" && (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={atlasUrl(pair.rightUrl)} alt="baseline" className="absolute inset-0 h-full w-full object-contain" />
                      <div className="absolute inset-0 overflow-hidden" style={{ width: `${slider}%` }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={atlasUrl(pair.leftUrl)}
                          alt="current"
                          className="h-full max-w-none object-contain"
                          style={{ width: `${10000 / Math.max(slider, 1)}%`, maxWidth: "none", height: "100%" }}
                        />
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={slider}
                        onChange={(e) => setSlider(Number(e.target.value))}
                        className="absolute bottom-3 left-1/2 z-10 w-[60%] -translate-x-1/2"
                      />
                    </>
                  )}
                  {mode === "onion" && (
                    <div className="relative h-full w-full">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={atlasUrl(pair.rightUrl)} alt="baseline" className="absolute inset-0 h-full w-full object-contain opacity-100" />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={atlasUrl(pair.leftUrl)} alt="current" className="absolute inset-0 h-full w-full object-contain opacity-45 mix-blend-normal" />
                    </div>
                  )}
                  {mode === "highlight" && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={atlasUrl(pair.diffUrl)} alt="diff" className="h-full w-full object-contain" />
                  )}
                </div>
              )}
              <p className="text-[11px] text-[#6B7280]">
                {pairs.filter((p) => p.changed).length} changed · {pairs.length} compared. Ignore regions can be sent via API
                (`ignoreRegions`).
              </p>
            </>
          )}
        </div>
      )}

      {tab === "sheet" && flags.responsiveSheet && (
        <div className="mt-4 space-y-3" data-testid="phase-c-responsive-sheet">
          {engineNote && (
            <div className="rounded-[8px] bg-[#F5F3FF] px-3 py-2 text-[12px] text-[#5B3FD1]">
              Run engine: {engineNote}
            </div>
          )}
          <button type="button" className={primaryButton} disabled={!!busy} onClick={() => void runSheet()}>
            {busy === "sheet" ? "Capturing…" : "Build contact sheet"}
          </button>
          {sheet && (
            <div className="max-h-[420px] space-y-4 overflow-y-auto">
              {sheet.rows.map((row) => (
                <div key={row.nodeId}>
                  <div className="mb-2 text-[12px] font-semibold">{row.path}</div>
                  <div className="grid grid-cols-3 gap-2">
                    {row.frames.map((f) => (
                      <div key={f.presetId} className="rounded-[8px] border border-[#E5E7EB] p-2">
                        <div className="mb-1 text-[10px] text-[#6B7280]">
                          {f.label} · {f.width}×{f.height}
                        </div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={atlasUrl(f.screenshotUrl)} alt={f.label} className="h-[140px] w-full rounded object-cover object-top" />
                        {f.warnings.length > 0 && (
                          <ul className="mt-1 space-y-0.5 text-[10px] text-[#92400E]">
                            {f.warnings.map((w, i) => (
                              <li key={i}>
                                {w.message}
                                {w.detail ? ` — ${w.detail}` : ""}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {sheet.posterPngUrl && (
                <a className="text-[12px] text-[#8664F2] underline" href={atlasUrl(sheet.posterPngUrl)} target="_blank" rel="noreferrer">
                  Download PNG poster
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "share" && flags.shareExport && (
        <div className="mt-4 space-y-3" data-testid="phase-c-share-export">
          <p className="text-[12.5px] text-[#5E6066]">
            Create a read-only share link (expires) or export a PDF poster with coverage and health badges.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={primaryButton} disabled={!!busy} onClick={() => void runShare()}>
              {busy === "share" ? "Creating…" : "Create share link (72h)"}
            </button>
            <button type="button" className={outlineButton} disabled={!!busy} onClick={() => void runPdf()}>
              {busy === "pdf" ? "Rendering…" : "Export PDF poster"}
            </button>
          </div>
          {shareUrl && (
            <div className="rounded-[8px] bg-[#F9FAFB] px-3 py-2 text-[12px] break-all">
              <div className="font-medium">Share URL</div>
              <a href={shareUrl} className="text-[#8664F2] underline" target="_blank" rel="noreferrer">
                {shareUrl}
              </a>
            </div>
          )}
          {pdfUrl && (
            <a className="text-[12px] text-[#8664F2] underline" href={pdfUrl} target="_blank" rel="noreferrer">
              Open PDF poster
            </a>
          )}
        </div>
      )}
    </Modal>
  );
}
