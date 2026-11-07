"use client";

import { useEffect, useRef, useState } from "react";
import type { SessionSnapshot } from "@/app/interfaces/appatlas";
import { deviceDisplayName, networkChipLabel, recordingCountsLine } from "@/app/lib/recording-labels";
import { fitStreamScale } from "@/app/lib/stream-fit";
import { atlasUrl, type AtlasClient } from "@/app/services/appatlas";
import { outlineButton, primaryButton } from "./modal";

const DONE: SessionSnapshot["status"][] = ["finished", "expired", "error"];
const FALLBACK_BROWSER_CHROME = 88;

export function RecordingView({
  client,
  initial,
  onFinished,
  onDiscarded,
  onSwitchViewer,
  onEditSetup,
}: {
  client: AtlasClient;
  initial: SessionSnapshot;
  onFinished: (snap: SessionSnapshot) => void;
  onDiscarded: () => void;
  onSwitchViewer?: (to: "vnc" | "auto") => void;
  onEditSetup?: () => void;
}) {
  const [snap, setSnap] = useState(initial);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<"finish" | "discard" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [box, setBox] = useState({ w: 800, h: 500 });
  const containerRef = useRef<HTMLDivElement>(null);
  const latest = useRef(initial);
  const finishedRef = useRef(onFinished);
  finishedRef.current = onFinished;

  useEffect(() => {
    let es: EventSource | null = null;
    let closed = false;
    client.openEvents(initial.id).then((source) => {
      if (closed) return source.close();
      es = source;
      source.addEventListener("snapshot", (e) => {
        const next: SessionSnapshot = JSON.parse((e as MessageEvent).data);
        if (next.revision < latest.current.revision) return;
        latest.current = next;
        setSnap(next);
        if (DONE.includes(next.status)) {
          source.close();
          finishedRef.current(next);
        }
      });
    });
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      closed = true;
      es?.close();
      clearInterval(timer);
    };
  }, [client, initial.id]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setBox({ w: Math.max(1, r.width), h: Math.max(1, r.height) });
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);

  const vp = snap.emulation?.viewport;
  const vw = Math.max(1, vp?.width ?? 1280);
  const vh = Math.max(1, vp?.height ?? 800);
  const surface = snap.emulation?.streamSurface ?? {
    width: vw,
    height: vh + FALLBACK_BROWSER_CHROME,
  };
  const sw = Math.max(1, surface.width);
  const sh = Math.max(1, surface.height);
  const fitted = fitStreamScale(box.w, box.h, sw, sh, { maxUpscale: 1.5 });

  useEffect(() => {
    console.info("[stream-fit]", {
      container: box,
      streamNative: { w: sw, h: sh },
      viewport: { w: vw, h: vh },
      scale: fitted.scale,
      sized: { w: fitted.width, h: fitted.height },
    });
  }, [box, sw, sh, vw, vh, fitted.scale, fitted.width, fitted.height]);

  const finish = async () => {
    setBusy("finish");
    setError(null);
    try {
      const final = await client.finishSession(snap.id);
      latest.current = final;
      onFinished(final);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not finish the recording.");
      setBusy(null);
    }
  };

  const discard = async () => {
    if (!window.confirm("Discard this recording? Nothing will be saved.")) return;
    setBusy("discard");
    await client.discardSession(snap.id).catch(() => undefined);
    onDiscarded();
  };

  const left = Math.max(0, snap.expiresAt - now);
  const countdown = `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}`;
  const viewer = snap.viewer;

  const deviceLabel = deviceDisplayName(snap.emulation?.devicePreset ?? "desktop");
  const orientLabel = snap.emulation?.orientation === "portrait" ? "Portrait" : "Landscape";
  const netLabel = networkChipLabel({
    devicePreset: snap.emulation?.devicePreset ?? "desktop",
    networkPreset: snap.emulation?.networkPreset ?? "none",
    offline: snap.emulation?.offline,
    network: snap.emulation?.network,
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-4 border-b border-[#EEE] bg-white px-5 py-2.5 dark:border-[#1a1a1a] dark:bg-[#0a0a0a]">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[13px] font-medium text-[#1F1F1F] dark:text-[#ededed]">
            <span className="h-[8px] w-[8px] animate-pulse rounded-full bg-[#DC3545]" />
            {snap.status === "starting" ? "Starting browser…" : "Recording"}
            <span className={`text-[12px] font-normal ${left < 60000 ? "text-[#DC3545]" : "text-[#7E7E7E]"}`}>
              auto-stops in {countdown}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[#5E6066] dark:text-[#9ca3af]">
            <ConfigChip
              label={deviceLabel}
              title={`Preset: ${snap.emulation?.devicePreset ?? ""}\nDPR: ${snap.emulation?.deviceScaleFactor ?? 1}\nUA: ${snap.emulation?.userAgent ?? "default"}`}
            />
            <ConfigChip label={`${vw} × ${vh}`} title="Viewport CSS pixels" />
            <ConfigChip label={orientLabel} title={`Orientation: ${snap.emulation?.orientation ?? ""}`} />
            <ConfigChip
              label={netLabel}
              title={
                snap.emulation?.offline
                  ? "Offline"
                  : snap.emulation?.network
                    ? `↓ ${snap.emulation.network.downloadKbps} kbps · ↑ ${snap.emulation.network.uploadKbps} kbps · ${snap.emulation.network.latencyMs} ms`
                    : "No throttling"
              }
              danger={snap.emulation?.offline}
            />
            <span className="truncate font-mono text-[11px] text-[#7E7E7E]" title={snap.currentUrl || snap.startUrl}>
              {snap.currentUrl || snap.startUrl}
            </span>
            <span className="text-[#7E7E7E]">
              · {recordingCountsLine(snap.nodes.length, snap.edges.length, snap.eventCount)}
            </span>
            {onEditSetup && (
              <button
                type="button"
                className="ml-1 text-[#8664F2] underline-offset-2 hover:underline"
                onClick={onEditSetup}
              >
                Edit for next run
              </button>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-3">
          <button type="button" className={`${outlineButton} !py-1.5 !text-[13px]`} onClick={discard} disabled={!!busy}>
            {busy === "discard" ? "Discarding…" : "Discard"}
          </button>
          <button
            type="button"
            className={`${primaryButton} !py-1.5 !text-[13px]`}
            onClick={finish}
            disabled={!!busy || snap.status !== "recording"}
          >
            {busy === "finish" ? "Building map…" : "Finish & Save"}
          </button>
        </div>
      </div>
      {error && <div className="bg-[#FDF1F1] px-5 py-2 text-[12px] text-[#991B1B]">{error}</div>}
      {onSwitchViewer && viewer?.kind === "neko" && (
        <div className="flex items-center justify-between gap-3 bg-[#F4EFFE] px-5 py-1.5 text-[12px] text-[#5B3FD1] dark:bg-[#1e1a2e]">
          <span>Stuck on the neko logo? Some networks block the video stream.</span>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => onSwitchViewer("vnc")}
            className="shrink-0 font-medium underline hover:no-underline"
          >
            Switch to the compatible viewer
          </button>
        </div>
      )}
      {onSwitchViewer &&
        viewer?.kind === "vnc" &&
        typeof window !== "undefined" &&
        localStorage.getItem("appatlas-viewer") === "vnc" && (
          <div className="flex items-center justify-end gap-3 px-5 pt-1.5 text-[11px] text-[#7E7E7E]">
            Using the compatible viewer.
            <button
              type="button"
              disabled={!!busy}
              onClick={() => onSwitchViewer("auto")}
              className="text-[#8664F2] underline hover:no-underline"
            >
              Try the smooth viewer
            </button>
          </div>
        )}

      <div className="flex min-h-0 flex-1 gap-4 p-4">
        <div ref={containerRef} className="flex min-w-0 flex-1 items-center justify-center overflow-hidden">
          {viewer && viewer.kind !== "local" ? (
            <div
              className={`flex items-center justify-center ${
                snap.emulation?.isMobile ? "rounded-[28px] border-[3px] border-[#333] bg-[#111] p-1.5 shadow-lg" : ""
              }`}
            >
              <iframe
                src={atlasUrl(viewer.url)}
                allow="autoplay; clipboard-read; clipboard-write; fullscreen"
                className="rounded-[10px] border border-[#E6E1F5] bg-black dark:border-[#2a2a2a]"
                style={{
                  width: fitted.width,
                  height: fitted.height,
                }}
                title="Remote browser"
              />
            </div>
          ) : (
            <div className="mt-20 text-center text-[13px] text-[#7E7E7E]">
              {viewer?.kind === "local"
                ? "Use the Chromium window opened on the backend machine."
                : "Waiting for the browser…"}
            </div>
          )}
        </div>
        <div className="w-[230px] shrink-0 overflow-y-auto">
          <div className="mb-2 text-[12px] font-medium text-[#1F1F1F] dark:text-[#ededed]">Screens captured</div>
          {snap.nodes.length === 0 && <div className="text-[11px] text-[#7E7E7E]">Screens appear here as you browse.</div>}
          {[...snap.nodes].reverse().map((n) => (
            <div
              key={n.id}
              className={`mb-2 overflow-hidden rounded-[8px] border bg-white dark:bg-[#141414] ${
                n.status === "active" ? "border-[#8664F2]" : "border-[#E6E1F5] dark:border-[#2a2a2a]"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={atlasUrl(n.shotUrl)} alt="" loading="lazy" className="h-[90px] w-full object-cover object-top" />
              <div className="px-2 py-1.5">
                <div className="truncate text-[11px] font-medium text-[#1F1F1F] dark:text-[#ededed]">{n.path}</div>
                <div className="text-[10px] text-[#7E7E7E]">
                  {n.states.length} {n.states.length === 1 ? "state" : "states"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ConfigChip({ label, title, danger }: { label: string; title?: string; danger?: boolean }) {
  return (
    <span
      title={title}
      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${
        danger
          ? "border-[#FCD34D] bg-[#FFFBEB] text-[#92400E]"
          : "border-[#E5E7EB] bg-[#F9FAFB] text-[#374151] dark:border-[#2a2a2a] dark:bg-[#141414] dark:text-[#d1d5db]"
      }`}
    >
      {label}
    </span>
  );
}
