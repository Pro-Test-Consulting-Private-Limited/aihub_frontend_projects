"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  TbArrowsMaximize,
  TbFocusCentered,
  TbMinus,
  TbPlus,
  TbRefresh,
  TbSwitchHorizontal,
} from "react-icons/tb";
import { atlasUrl } from "@/app/services/appatlas";

export type CompareMode = "side" | "overlay" | "onion" | "swipe" | "diff";

const MODES: Array<{ id: CompareMode; label: string }> = [
  { id: "side", label: "Side-by-Side" },
  { id: "overlay", label: "Overlay" },
  { id: "onion", label: "Onion Skin" },
  { id: "swipe", label: "Swipe" },
  { id: "diff", label: "Difference Map" },
];

export function DesignValidationCompare({
  figmaUrl,
  recordedUrl,
  diffUrl,
  percentChanged,
  showLabels = true,
}: {
  figmaUrl: string;
  recordedUrl: string;
  diffUrl: string;
  percentChanged?: number;
  showLabels?: boolean;
}) {
  const [mode, setMode] = useState<CompareMode>("side");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragOrigin = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [opacity, setOpacity] = useState(45);
  const [figmaOnTop, setFigmaOnTop] = useState(true);
  const [swipe, setSwipe] = useState(50);
  const [swipeDragging, setSwipeDragging] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const swipeRef = useRef<HTMLDivElement>(null);

  const figmaSrc = atlasUrl(figmaUrl);
  const recordedSrc = atlasUrl(recordedUrl);
  const diffSrc = atlasUrl(diffUrl);

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    if (mode === "swipe") return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
    dragOrigin.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!dragging || !dragOrigin.current) return;
    setPan({
      x: dragOrigin.current.panX + (e.clientX - dragOrigin.current.x),
      y: dragOrigin.current.panY + (e.clientY - dragOrigin.current.y),
    });
  };
  const onPointerUp = () => {
    setDragging(false);
    dragOrigin.current = null;
  };

  const updateSwipeFromClientX = useCallback((clientX: number) => {
    const el = swipeRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / Math.max(rect.width, 1)) * 100;
    setSwipe(Math.max(0, Math.min(100, pct)));
  }, []);

  useEffect(() => {
    if (!swipeDragging) return;
    const move = (e: PointerEvent) => updateSwipeFromClientX(e.clientX);
    const up = () => setSwipeDragging(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [swipeDragging, updateSwipeFromClientX]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  const transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;

  const shell = (
    <div
      className={`flex min-h-0 flex-col ${fullscreen ? "fixed inset-0 z-[80] bg-[#0b0b0f] p-4" : "h-full"}`}
      ref={stageRef}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-[8px] border border-[#E5E7EB] p-0.5 dark:border-[#2a2a2a]">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`rounded-[6px] px-2.5 py-1 text-[11.5px] font-medium ${
                mode === m.id
                  ? "bg-[#8664f2] text-white"
                  : "text-[#5E6066] hover:bg-[#F5F3FF] dark:text-[#9ca3af] dark:hover:bg-[#1a1428]"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-1">
          {(mode === "overlay" || mode === "onion") && (
            <>
              <label className="flex items-center gap-2 text-[11px] text-[#6B7280]">
                Opacity
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={opacity}
                  onChange={(e) => setOpacity(Number(e.target.value))}
                  className="w-[110px]"
                />
                <span className="w-8 tabular-nums">{opacity}%</span>
              </label>
              {mode === "overlay" ? (
                <button
                  type="button"
                  title="Swap which image is on top"
                  onClick={() => setFigmaOnTop((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-[6px] border border-[#E5E7EB] px-2 py-1 text-[11px] dark:border-[#2a2a2a]"
                >
                  <TbSwitchHorizontal size={13} />
                  {figmaOnTop ? "Figma on top" : "Recorded on top"}
                </button>
              ) : null}
            </>
          )}
          <button
            type="button"
            className="rounded-[6px] border border-[#E5E7EB] p-1.5 dark:border-[#2a2a2a]"
            title="Zoom out"
            onClick={() => setZoom((z) => Math.max(0.25, Math.round((z - 0.25) * 100) / 100))}
          >
            <TbMinus size={14} />
          </button>
          <span className="min-w-[3rem] text-center text-[11px] tabular-nums text-[#6B7280]">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            className="rounded-[6px] border border-[#E5E7EB] p-1.5 dark:border-[#2a2a2a]"
            title="Zoom in"
            onClick={() => setZoom((z) => Math.min(4, Math.round((z + 0.25) * 100) / 100))}
          >
            <TbPlus size={14} />
          </button>
          <button
            type="button"
            className="rounded-[6px] border border-[#E5E7EB] p-1.5 dark:border-[#2a2a2a]"
            title="Fit / reset"
            onClick={resetView}
          >
            <TbFocusCentered size={14} />
          </button>
          <button
            type="button"
            className="rounded-[6px] border border-[#E5E7EB] p-1.5 dark:border-[#2a2a2a]"
            title="Reset pan & zoom"
            onClick={resetView}
          >
            <TbRefresh size={14} />
          </button>
          <button
            type="button"
            className="rounded-[6px] border border-[#E5E7EB] p-1.5 dark:border-[#2a2a2a]"
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            onClick={() => setFullscreen((v) => !v)}
          >
            <TbArrowsMaximize size={14} />
          </button>
        </div>
      </div>

      {typeof percentChanged === "number" ? (
        <div className="mb-2 text-[11.5px] text-[#6B7280]">
          Diff · <span className="font-semibold text-[#1F1F1F] dark:text-[#ededed]">{percentChanged}%</span> pixels
          changed
        </div>
      ) : null}

      <div
        className={`relative min-h-0 flex-1 overflow-hidden rounded-[10px] border border-[#E5E7EB] bg-[#111] dark:border-[#2a2a2a] ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={(e) => {
          if (!e.ctrlKey && !e.metaKey) return;
          e.preventDefault();
          setZoom((z) => Math.max(0.25, Math.min(4, z + (e.deltaY > 0 ? -0.1 : 0.1))));
        }}
      >
        {mode === "side" ? (
          <div className="grid h-full grid-cols-2 gap-px bg-[#1f1f1f]">
            {(["Figma", "Recorded"] as const).map((label) => (
              <div key={label} className="relative overflow-hidden bg-[#111]">
                {showLabels ? (
                  <div className="absolute left-2 top-2 z-10 rounded bg-black/55 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    {label}
                  </div>
                ) : null}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={label === "Figma" ? figmaSrc : recordedSrc}
                  alt={label}
                  draggable={false}
                  className="absolute left-1/2 top-1/2 max-h-none max-w-none origin-center object-contain"
                  style={{
                    transform: `translate(-50%, -50%) ${transform}`,
                    height: "90%",
                    width: "auto",
                  }}
                />
              </div>
            ))}
          </div>
        ) : null}

        {(mode === "overlay" || mode === "onion") && (
          <div className="relative h-full w-full">
            {showLabels ? (
              <div className="absolute left-2 top-2 z-10 rounded bg-black/55 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                {mode === "onion" ? "Onion" : figmaOnTop ? "Figma over Recorded" : "Recorded over Figma"}
              </div>
            ) : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mode === "overlay" && !figmaOnTop ? figmaSrc : recordedSrc}
              alt="base"
              draggable={false}
              className="absolute left-1/2 top-1/2 origin-center object-contain"
              style={{ transform: `translate(-50%, -50%) ${transform}`, height: "90%", width: "auto" }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mode === "overlay" && !figmaOnTop ? recordedSrc : figmaSrc}
              alt="top"
              draggable={false}
              className="absolute left-1/2 top-1/2 origin-center object-contain"
              style={{
                transform: `translate(-50%, -50%) ${transform}`,
                height: "90%",
                width: "auto",
                opacity: opacity / 100,
                mixBlendMode: mode === "onion" ? "normal" : "normal",
              }}
            />
          </div>
        )}

        {mode === "swipe" ? (
          <div
            ref={swipeRef}
            className="relative h-full w-full cursor-ew-resize select-none"
            onPointerDown={(e) => {
              e.stopPropagation();
              setSwipeDragging(true);
              updateSwipeFromClientX(e.clientX);
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={recordedSrc}
              alt="Recorded"
              draggable={false}
              className="absolute inset-0 h-full w-full object-contain"
              style={{ transform }}
            />
            <div className="absolute inset-0 overflow-hidden" style={{ width: `${swipe}%` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={figmaSrc}
                alt="Figma"
                draggable={false}
                className="h-full max-w-none object-contain"
                style={{
                  width: `${10000 / Math.max(swipe, 1)}%`,
                  height: "100%",
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: "left center",
                }}
              />
            </div>
            <div
              className="absolute inset-y-0 z-10 w-0.5 bg-[#8664f2] shadow-[0_0_0_1px_rgba(255,255,255,0.35)]"
              style={{ left: `${swipe}%` }}
            >
              <div className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#8664f2]" />
            </div>
            {showLabels ? (
              <>
                <div className="absolute left-2 top-2 z-10 rounded bg-black/55 px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
                  Figma
                </div>
                <div className="absolute right-2 top-2 z-10 rounded bg-black/55 px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
                  Recorded
                </div>
              </>
            ) : null}
          </div>
        ) : null}

        {mode === "diff" ? (
          <div className="relative h-full w-full">
            {showLabels ? (
              <div className="absolute left-2 top-2 z-10 rounded bg-black/55 px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
                Difference map
              </div>
            ) : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={diffSrc}
              alt="Difference"
              draggable={false}
              className="absolute left-1/2 top-1/2 origin-center object-contain"
              style={{ transform: `translate(-50%, -50%) ${transform}`, height: "90%", width: "auto" }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );

  return shell;
}
