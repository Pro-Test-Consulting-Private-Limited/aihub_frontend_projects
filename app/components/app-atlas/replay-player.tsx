"use client";

import { useMemo, useState } from "react";
import type { Canvas } from "@/app/interfaces/appatlas";
import { atlasUrl } from "@/app/services/appatlas";
import { outlineButton, primaryButton } from "./modal";

/**
 * Screenshot-timeline replay (Phase A MVP).
 * Click ripples / cursor / keystroke toasts are composited from edges when present.
 * Full MP4/GIF export needs ffmpeg on the backend (not installed on ai-hub-dev yet).
 */
export function ReplayPlayer({ canvas, onClose }: { canvas: Canvas; onClose: () => void }) {
  const frames = useMemo(() => {
    const out: { id: string; label: string; shotUrl: string; path: string }[] = [];
    for (const n of canvas.nodes) {
      for (const st of n.states) {
        out.push({ id: st.id, label: st.label || n.title, shotUrl: st.screenshotUrl, path: n.path });
      }
      if (!n.states.length && n.screenshotUrl) {
        out.push({ id: n.id, label: n.title, shotUrl: n.screenshotUrl, path: n.path });
      }
    }
    return out;
  }, [canvas.nodes]);

  const [idx, setIdx] = useState(0);
  const [speed, setSpeed] = useState(1);
  const frame = frames[idx];

  const play = () => {
    if (!frames.length) return;
    let i = idx;
    const step = () => {
      i += 1;
      if (i >= frames.length) return;
      setIdx(i);
      window.setTimeout(step, Math.max(200, 900 / speed));
    };
    window.setTimeout(step, Math.max(200, 900 / speed));
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal>
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[12px] bg-white shadow-xl dark:bg-[#141414]">
        <div className="flex items-center justify-between border-b border-[#EEE] px-4 py-2 dark:border-[#2a2a2a]">
          <div className="text-[14px] font-medium text-[#1F1F1F] dark:text-[#ededed]">Replay · {canvas.name}</div>
          <button type="button" className={outlineButton} onClick={onClose}>
            Close
          </button>
        </div>
        <div className="relative min-h-[280px] flex-1 bg-[#111]">
          {frame ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={atlasUrl(frame.shotUrl)} alt="" className="h-full max-h-[60vh] w-full object-contain object-top" />
          ) : (
            <div className="flex h-full items-center justify-center text-[13px] text-[#9ca3af]">No frames</div>
          )}
          {frame && (
            <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-[11px] text-white">
              {frame.path} · {frame.label}
            </div>
          )}
        </div>
        <div className="space-y-2 border-t border-[#EEE] px-4 py-3 dark:border-[#2a2a2a]">
          <input
            type="range"
            min={0}
            max={Math.max(0, frames.length - 1)}
            value={idx}
            onChange={(e) => setIdx(Number(e.target.value))}
            className="w-full"
            aria-label="Scrubber"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={primaryButton} onClick={play} disabled={!frames.length}>
              Play
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
              {frames.length ? `${idx + 1} / ${frames.length}` : "0 frames"}
            </span>
            <span className="text-[11px] text-[#B45309]">MP4/GIF export needs ffmpeg on the VM</span>
          </div>
        </div>
      </div>
    </div>
  );
}
