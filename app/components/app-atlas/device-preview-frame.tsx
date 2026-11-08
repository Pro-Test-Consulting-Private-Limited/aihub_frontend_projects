"use client";

import { useEffect, useRef, useState } from "react";
import { applyResizeDelta, fitScale, type ResizeEdge } from "@/app/lib/preview-resize";
import { VIEWPORT, type DeviceCategory } from "@/app/lib/session-emulation";
import { ratioLabel } from "@/app/lib/viewport-ratio";

type Props = {
  width: number;
  height: number;
  orientation: "portrait" | "landscape";
  dpr: number;
  frameKind: DeviceCategory;
  editable: boolean;
  disabled?: boolean;
  rotating?: boolean;
  motionOk?: boolean;
  /** When true, drag-resize keeps aspect; Shift temporarily unlocks. */
  lockRatio?: boolean;
  ratioText?: string;
  onSizeChange: (width: number, height: number) => void;
  children?: React.ReactNode;
  appUrl?: string;
  /** Compact density: shorter preview box for short viewports. */
  compact?: boolean;
};

const BOX_MIN_H = 260;
const BOX_MIN_H_COMPACT = 140;
const BOX_PAD = 16;

export function DevicePreviewFrame({
  width,
  height,
  orientation,
  dpr,
  frameKind,
  editable,
  disabled,
  rotating,
  motionOk,
  lockRatio,
  ratioText,
  onSizeChange,
  children,
  appUrl,
  compact,
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const minH = compact ? BOX_MIN_H_COMPACT : BOX_MIN_H;
  const [box, setBox] = useState({ w: 280, h: minH });
  const [frozenScale, setFrozenScale] = useState<number | null>(null);
  const [ghost, setGhost] = useState<{ w: number; h: number } | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; label: string } | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    scale: number;
    edge: ResizeEdge;
    shift: boolean;
  } | null>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setBox({
        w: Math.max(160, r.width - BOX_PAD * 2),
        h: Math.max(minH - BOX_PAD * 2, r.height - BOX_PAD * 2),
      });
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [minH]);

  const fit = fitScale(width, height, box.w, box.h);
  const scale = frozenScale ?? fit.scale;
  const frameW = width * scale;
  const frameH = height * scale;
  const isMobileChrome = frameKind === "phone" || frameKind === "tablet";
  const shownRatio = ratioText || ratioLabel(width, height);

  const endDrag = () => {
    dragRef.current = null;
    setFrozenScale(null);
    setGhost(null);
    setTip(null);
  };

  const onPointerDown = (edge: ResizeEdge) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (!editable || disabled) return;
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const startScale = scale;
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startW: width,
      startH: height,
      scale: startScale,
      edge,
      shift: e.shiftKey,
    };
    setFrozenScale(startScale);
    setGhost({ w: width * startScale, h: height * startScale });
    setTip({ x: e.clientX, y: e.clientY, label: `${width} × ${height}` });
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    e.preventDefault();
    const shift = drag.shift || e.shiftKey;
    // Lock on → keep aspect for all edges; Shift unlocks. Corner always kept aspect unless shift or unlock.
    const keepAspect = shift ? false : Boolean(lockRatio) || drag.edge === "corner";
    const next = applyResizeDelta({
      startW: drag.startW,
      startH: drag.startH,
      dxScreen: e.clientX - drag.startX,
      dyScreen: e.clientY - drag.startY,
      scale: drag.scale,
      edge: drag.edge,
      shift,
      keepAspect,
    });
    onSizeChange(next.width, next.height);
    setTip({ x: e.clientX, y: e.clientY, label: `${next.width} × ${next.height}` });
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === e.pointerId) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      endDrag();
    }
  };

  const handleClass =
    "absolute z-10 touch-none bg-[#8664F2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white";

  const now = new Date();
  const timeLabel = `${now.getHours() % 12 || 12}:${String(now.getMinutes()).padStart(2, "0")}`;

  return (
    <div
      ref={boxRef}
      className={`relative flex w-full flex-1 flex-col items-center justify-center overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-[#F7F7FA] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] ${
        compact ? "min-h-[72px] p-1" : "min-h-[260px] p-3"
      }`}
    >
      <div
        className={`relative bg-[#111] text-white shadow-lg dark:bg-[#000] ${
          frozenScale == null && rotating && motionOk
            ? "transition-transform duration-150 ease-out scale-[0.97]"
            : frozenScale == null
              ? "transition-[width,height,transform] duration-150 ease-out scale-100"
              : "scale-100"
        } ${
          frameKind === "phone"
            ? "rounded-[28px] border-[3px] border-[#333]"
            : frameKind === "tablet"
              ? "rounded-[16px] border-2 border-[#444]"
              : frameKind === "laptop"
                ? "rounded-t-[8px] border border-[#555]"
                : "rounded-[8px] border-2 border-dashed border-[#8664F2]"
        }`}
        style={{ width: frameW, height: frameH }}
      >
        {ghost && (
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2 rounded-[inherit] border border-white/35"
            style={{ width: ghost.w, height: ghost.h }}
          />
        )}
        {frameKind === "phone" && (
          <div className="absolute left-1/2 top-1.5 z-[3] h-1.5 w-14 -translate-x-1/2 rounded-full bg-[#222]" aria-hidden />
        )}
        <div className="relative z-[1] flex h-full min-h-0 flex-col overflow-hidden rounded-[inherit] bg-white text-[#1F1F1F]">
          {isMobileChrome ? (
            <div className="relative shrink-0 border-b border-[#E5E7EB] bg-[#F8FAFC] pt-1 dark:border-[#2a2a2a] dark:bg-[#141414]">
              <div className="flex items-center justify-between px-3 pb-0.5 text-[9px] font-medium text-[#1F1F1F] dark:text-[#ededed]">
                <span>{timeLabel}</span>
                <span className="flex items-center gap-1 text-[#5E6066]" aria-hidden>
                  <span className="inline-block h-1.5 w-2.5 rounded-[1px] border border-current" />
                  <span className="inline-block h-2 w-3 rounded-[2px] border border-current">
                    <span className="ml-px mt-px block h-1 w-1.5 bg-current" />
                  </span>
                </span>
              </div>
              <div className="px-3 pb-1.5 pt-0.5">
                <div
                  className="truncate rounded-full bg-white px-2.5 py-0.5 text-center text-[9px] text-[#374151] shadow-sm ring-1 ring-[#E5E7EB] dark:bg-[#0a0a0a] dark:text-[#d1d5db] dark:ring-[#2a2a2a]"
                  title={appUrl}
                >
                  {appUrl ? appUrl.replace(/^https?:\/\//, "") : `${width} × ${height}`}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex shrink-0 items-center gap-1.5 border-b border-[#E5E7EB] bg-[#F3F4F6] px-2 py-1 dark:border-[#2a2a2a] dark:bg-[#1a1a1a]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#F87171]" aria-hidden />
              <span className="h-1.5 w-1.5 rounded-full bg-[#FBBF24]" aria-hidden />
              <span className="h-1.5 w-1.5 rounded-full bg-[#34D399]" aria-hidden />
              <div className="min-w-0 flex-1 truncate rounded bg-white px-1.5 py-0.5 text-[10px] text-[#374151] dark:bg-[#0a0a0a] dark:text-[#d1d5db]" title={appUrl}>
                {appUrl || `${width} × ${height}`}
              </div>
            </div>
          )}
          <div className="relative min-h-0 flex-1 overflow-hidden">
            {children ?? (
              <div className="flex h-full flex-col items-center justify-center gap-1 bg-[#111] p-3 text-center text-white">
                <div className="font-mono text-[12px] font-semibold tracking-wide">
                  {width} × {height}
                </div>
                <div className="text-[11px] text-white/70">
                  {orientation === "portrait" ? "Portrait" : "Landscape"}
                  {dpr !== 1 ? ` · ${dpr}× DPR` : ""}
                </div>
              </div>
            )}
            <div className="pointer-events-none absolute bottom-1 left-1 rounded bg-black/55 px-1.5 py-0.5 font-mono text-[9px] text-white">
              {shownRatio}
            </div>
          </div>
        </div>

        {editable && (
          <>
            <div
              role="slider"
              aria-label="Resize width"
              aria-valuemin={VIEWPORT.widthMin}
              aria-valuemax={VIEWPORT.widthMax}
              aria-valuenow={width}
              tabIndex={0}
              className={`${handleClass} right-0 top-1/2 h-8 w-4 -translate-y-1/2 translate-x-1/2 cursor-ew-resize rounded-sm`}
              style={{ touchAction: "none" }}
              onPointerDown={onPointerDown("right")}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
            <div
              role="slider"
              aria-label="Resize height"
              aria-valuemin={VIEWPORT.heightMin}
              aria-valuemax={VIEWPORT.heightMax}
              aria-valuenow={height}
              tabIndex={0}
              className={`${handleClass} bottom-0 left-1/2 h-4 w-8 -translate-x-1/2 translate-y-1/2 cursor-ns-resize rounded-sm`}
              style={{ touchAction: "none" }}
              onPointerDown={onPointerDown("bottom")}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
            <div
              role="slider"
              aria-label="Resize custom viewport"
              aria-valuemin={VIEWPORT.widthMin}
              aria-valuemax={VIEWPORT.widthMax}
              aria-valuenow={width}
              tabIndex={0}
              className={`${handleClass} bottom-0 right-0 h-4 w-4 translate-x-1/2 translate-y-1/2 cursor-se-resize rounded-sm`}
              style={{ touchAction: "none", minWidth: 16, minHeight: 16 }}
              onPointerDown={onPointerDown("corner")}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowUp") {
                  e.preventDefault();
                  onSizeChange(width + (e.shiftKey ? 1 : 10), height + (e.shiftKey ? 1 : 10));
                }
                if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
                  e.preventDefault();
                  onSizeChange(width - (e.shiftKey ? 1 : 10), height - (e.shiftKey ? 1 : 10));
                }
              }}
            />
          </>
        )}
      </div>
      {frameKind === "laptop" && (
        <div className="h-2 w-[min(100%,calc(100%+24px))] rounded-b-[6px] bg-[#333]" aria-hidden />
      )}
      {tip && (
        <div
          className="pointer-events-none fixed z-[80] rounded-md bg-[#1F1F1F] px-2 py-1 font-mono text-[11px] text-white shadow-lg"
          style={{ left: tip.x + 12, top: tip.y + 12 }}
        >
          {tip.label}
        </div>
      )}
    </div>
  );
}
