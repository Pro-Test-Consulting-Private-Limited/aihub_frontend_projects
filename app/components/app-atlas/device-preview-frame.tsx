"use client";

import { useEffect, useRef, useState } from "react";
import { applyResizeDelta, fitScale, type ResizeEdge } from "@/app/lib/preview-resize";
import { VIEWPORT, type DeviceCategory } from "@/app/lib/session-emulation";

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
  onSizeChange: (width: number, height: number) => void;
};

const BOX_MIN_H = 360;
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
  onSizeChange,
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 280, h: BOX_MIN_H });
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
        h: Math.max(BOX_MIN_H - BOX_PAD * 2, r.height - BOX_PAD * 2),
      });
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);

  const fit = fitScale(width, height, box.w, box.h);
  const scale = frozenScale ?? fit.scale;
  const frameW = width * scale;
  const frameH = height * scale;

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
    const next = applyResizeDelta({
      startW: drag.startW,
      startH: drag.startH,
      dxScreen: e.clientX - drag.startX,
      dyScreen: e.clientY - drag.startY,
      scale: drag.scale,
      edge: drag.edge,
      shift: drag.shift || e.shiftKey,
      keepAspect: drag.edge === "corner",
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

  return (
    <div
      ref={boxRef}
      className="relative flex w-full min-h-[360px] flex-1 flex-col items-center justify-center overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-[#F7F7FA] p-4 dark:border-[#2a2a2a] dark:bg-[#0a0a0a]"
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
          <div className="absolute left-1/2 top-1.5 h-1.5 w-14 -translate-x-1/2 rounded-full bg-[#222]" aria-hidden />
        )}
        <div className="relative z-[1] flex h-full flex-col items-center justify-center gap-1 p-3 text-center">
          <div className="font-mono text-[12px] font-semibold tracking-wide">
            {width} × {height}
          </div>
          <div className="text-[11px] text-white/70">
            {orientation === "portrait" ? "Portrait" : "Landscape"}
            {dpr !== 1 ? ` · ${dpr}× DPR` : ""}
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
