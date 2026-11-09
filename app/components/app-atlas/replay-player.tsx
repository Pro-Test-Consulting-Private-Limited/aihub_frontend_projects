"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Canvas, ReplayTimelineEvent } from "@/app/interfaces/appatlas";
import { atlasUrl } from "@/app/services/appatlas";
import { outlineButton, primaryButton } from "./modal";

/**
 * Replay player: prefers assembled MP4 when present; falls back to screenshot scrubber.
 * Click ripples, cursor spotlight, keystroke toasts, and sensitive-field blurs are
 * composited from the recorded timeline (never injected into the page under test).
 */
export function ReplayPlayer({ canvas, onClose }: { canvas: Canvas; onClose: () => void }) {
  const frames = useMemo(() => {
    const out: { id: string; label: string; shotUrl: string; path: string; at: number }[] = [];
    let t = 0;
    for (const n of canvas.nodes) {
      for (const st of n.states) {
        out.push({ id: st.id, label: st.label || n.title, shotUrl: st.screenshotUrl, path: n.path, at: t });
        t += 900;
      }
      if (!n.states.length && n.screenshotUrl) {
        out.push({ id: n.id, label: n.title, shotUrl: n.screenshotUrl, path: n.path, at: t });
        t += 900;
      }
    }
    return out;
  }, [canvas.nodes]);

  const timeline = canvas.timeline || [];
  const mp4 = canvas.replay?.mp4Url ? atlasUrl(canvas.replay.mp4Url) : null;
  const gif = canvas.replay?.gifUrl ? atlasUrl(canvas.replay.gifUrl) : null;

  const [idx, setIdx] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [mediaTime, setMediaTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const frame = frames[idx];

  const clockMs = mp4 ? mediaTime * 1000 : frame?.at ?? 0;

  const activeOverlays = useMemo(() => {
    return timeline.filter((e) => {
      const start = e.at;
      const end = e.at + (e.kind === "key" ? 900 : e.kind === "sensitive" ? 2500 : 450);
      return clockMs >= start && clockMs <= end;
    });
  }, [timeline, clockMs]);

  useEffect(() => {
    if (!playing || mp4) return;
    if (!frames.length) return;
    const id = window.setTimeout(() => {
      setIdx((i) => {
        if (i + 1 >= frames.length) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, Math.max(120, 900 / speed));
    return () => window.clearTimeout(id);
  }, [playing, idx, speed, frames.length, mp4]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !mp4) return;
    v.playbackRate = speed;
    if (playing) void v.play().catch(() => undefined);
    else v.pause();
  }, [playing, speed, mp4]);

  const markers = useMemo(() => {
    const dur = (canvas.replay?.durationSec || frames.length * 0.9) * 1000 || 1;
    return timeline
      .filter((e) => e.kind === "click" || e.kind === "key" || e.kind === "navigate")
      .slice(0, 80)
      .map((e) => ({ ...e, pct: Math.min(100, (e.at / dur) * 100) }));
  }, [timeline, canvas.replay?.durationSec, frames.length]);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal>
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[12px] bg-white shadow-xl dark:bg-[#141414]">
        <div className="flex items-center justify-between border-b border-[#EEE] px-4 py-2 dark:border-[#2a2a2a]">
          <div className="text-[14px] font-medium text-[#1F1F1F] dark:text-[#ededed]">Replay · {canvas.name}</div>
          <button type="button" className={outlineButton} onClick={onClose}>
            Close
          </button>
        </div>
        <div className="relative min-h-[280px] flex-1 overflow-hidden bg-[#111]">
          {mp4 ? (
            <video
              ref={videoRef}
              src={mp4}
              className="h-full max-h-[60vh] w-full object-contain object-top"
              onTimeUpdate={(e) => setMediaTime(e.currentTarget.currentTime)}
              onEnded={() => setPlaying(false)}
              playsInline
            />
          ) : frame ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={atlasUrl(frame.shotUrl)} alt="" className="h-full max-h-[60vh] w-full object-contain object-top" />
          ) : (
            <div className="flex h-full items-center justify-center text-[13px] text-[#9ca3af]">No frames</div>
          )}

          {/* Composited overlays from timeline */}
          <div className="pointer-events-none absolute inset-0">
            {activeOverlays.map((e, i) => (
              <Overlay key={`${e.at}-${e.kind}-${i}`} event={e} />
            ))}
          </div>

          {timeline.some((e) => e.kind === "simulate" && Math.abs((mp4 ? mediaTime * 1000 : frame?.at ?? 0) - e.at) < 8000) && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 rounded bg-[#B45309]/90 px-3 py-1 text-[11px] font-semibold text-white">
              Simulated failure
            </div>
          )}
          {frame && !mp4 && (
            <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-[11px] text-white">
              {frame.path} · {frame.label}
              {canvas.nodes
                .flatMap((n) => n.states)
                .find((s) => s.id === frame.id && s.simulated) && (
                <span className="ml-2 rounded bg-[#B45309] px-1.5 py-0.5 text-[10px]">Simulated</span>
              )}
            </div>
          )}
          {canvas.replay?.limitedMessage && (
            <div className="absolute left-2 top-2 max-w-[80%] rounded bg-[#92400E]/90 px-2 py-1 text-[11px] text-white">
              {canvas.replay.limitedMessage}
            </div>
          )}
        </div>
        <div className="space-y-2 border-t border-[#EEE] px-4 py-3 dark:border-[#2a2a2a]">
          <div className="relative">
            <input
              type="range"
              min={0}
              max={mp4 ? Math.max(0.1, canvas.replay?.durationSec || 1) : Math.max(0, frames.length - 1)}
              step={mp4 ? 0.05 : 1}
              value={mp4 ? mediaTime : idx}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (mp4 && videoRef.current) {
                  videoRef.current.currentTime = v;
                  setMediaTime(v);
                } else setIdx(v);
              }}
              className="w-full"
              aria-label="Scrubber"
            />
            <div className="pointer-events-none absolute inset-x-0 top-1/2 h-0">
              {markers.map((m, i) => (
                <span
                  key={i}
                  title={`${m.kind}: ${m.label}`}
                  className={`absolute h-2 w-0.5 -translate-y-1/2 ${
                    m.kind === "click" ? "bg-[#8664F2]" : m.kind === "key" ? "bg-[#22C55E]" : "bg-[#F59E0B]"
                  }`}
                  style={{ left: `${m.pct}%` }}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={primaryButton} onClick={() => setPlaying((p) => !p)} disabled={!frames.length && !mp4}>
              {playing ? "Pause" : "Play"}
            </button>
            {[0.5, 1, 1.5, 2].map((s) => (
              <button
                key={s}
                type="button"
                className={`${outlineButton} !px-2 !py-1 !text-[12px] ${speed === s ? "!border-[#8664F2] !text-[#8664F2]" : ""}`}
                onClick={() => setSpeed(s)}
              >
                {s}x
              </button>
            ))}
            <span className="text-[12px] text-[#7E7E7E]">
              {mp4
                ? `${mediaTime.toFixed(1)}s / ${(canvas.replay?.durationSec || 0).toFixed(1)}s`
                : frames.length
                  ? `${idx + 1} / ${frames.length}`
                  : "0 frames"}
            </span>
            {mp4 && (
              <a className={`${outlineButton} !px-2 !py-1 !text-[12px]`} href={mp4} download={`replay-${canvas.id}.mp4`}>
                Export MP4
              </a>
            )}
            {gif && (
              <a className={`${outlineButton} !px-2 !py-1 !text-[12px]`} href={gif} download={`replay-${canvas.id}.gif`}>
                Export GIF
              </a>
            )}
            {canvas.replay?.error && <span className="text-[11px] text-[#B45309]">{canvas.replay.error}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Overlay({ event }: { event: ReplayTimelineEvent }) {
  if (event.kind === "sensitive" && event.box) {
    return (
      <div
        className="absolute backdrop-blur-md bg-black/70"
        style={{ left: event.box.x, top: event.box.y, width: event.box.w, height: event.box.h }}
        title="Sensitive field blurred"
      />
    );
  }
  if (event.kind === "click" && event.x != null && event.y != null) {
    return (
      <>
        <div
          className="absolute h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#8664F2] bg-[#8664F2]/35 animate-ping"
          style={{ left: event.x, top: event.y }}
        />
        <div
          className="absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80 shadow-[0_0_24px_8px_rgba(134,100,242,0.45)]"
          style={{ left: event.x, top: event.y }}
          title="Cursor"
        />
      </>
    );
  }
  if (event.kind === "key") {
    return (
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 rounded-md bg-black/75 px-3 py-1.5 text-[12px] text-white shadow">
        {event.label}
      </div>
    );
  }
  return null;
}
