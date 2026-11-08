"use client";

import { useMemo } from "react";
import type { Canvas } from "@/app/interfaces/appatlas";

/** Screens × Web Vitals table with a simple LCP trend sparkline. */
export function PerformanceView({ canvas }: { canvas: Canvas | null }) {
  const rows = useMemo(() => {
    if (!canvas) return [];
    return canvas.nodes.map((n) => ({
      id: n.id,
      path: n.path,
      title: n.title,
      ttfb: n.health?.ttfbMs ?? null,
      lcp: n.health?.lcpMs ?? null,
      cls: n.health?.cls ?? null,
      httpErrors: n.health?.httpErrors ?? 0,
      failed: n.health?.failedRequests ?? 0,
    }));
  }, [canvas]);

  const lcpSeries = rows.map((r) => r.lcp).filter((v): v is number => v != null);

  if (!canvas) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-[#7E7E7E]">
        Open a canvas to see screen Web Vitals.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-6">
      <div>
        <h2 className="text-[16px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">Performance</h2>
        <p className="text-[13px] text-[#7E7E7E]">Web Vitals captured per screen during recording (TTFB, LCP, CLS).</p>
      </div>

      <div className="rounded-[10px] border border-[#EEE] bg-white p-4 dark:border-[#2a2a2a] dark:bg-[#141414]">
        <div className="mb-2 text-[12px] font-medium text-[#5E6066]">LCP trend across screens</div>
        <Trend values={lcpSeries} />
      </div>

      <div className="overflow-hidden rounded-[10px] border border-[#EEE] dark:border-[#2a2a2a]">
        <table className="w-full text-left text-[12.5px]">
          <thead className="bg-[#F9FAFB] text-[11px] uppercase text-[#7E7E7E] dark:bg-[#1a1a1a]">
            <tr>
              <th className="px-3 py-2 font-medium">Screen</th>
              <th className="px-3 py-2 font-medium">TTFB</th>
              <th className="px-3 py-2 font-medium">LCP</th>
              <th className="px-3 py-2 font-medium">CLS</th>
              <th className="px-3 py-2 font-medium">HTTP err</th>
              <th className="px-3 py-2 font-medium">Failed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-[#EEE] dark:border-[#2a2a2a]">
                <td className="px-3 py-2">
                  <div className="font-medium text-[#1F1F1F] dark:text-[#ededed]">{r.path}</div>
                  <div className="text-[11px] text-[#9ca3af]">{r.title}</div>
                </td>
                <td className="px-3 py-2">{fmt(r.ttfb)}</td>
                <td className={`px-3 py-2 ${lcpClass(r.lcp)}`}>{fmt(r.lcp)}</td>
                <td className={`px-3 py-2 ${clsClass(r.cls)}`}>{r.cls ?? "—"}</td>
                <td className="px-3 py-2">{r.httpErrors}</td>
                <td className="px-3 py-2">{r.failed}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-[#7E7E7E]">
                  No screens in this canvas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Trend({ values }: { values: number[] }) {
  if (values.length < 2) {
    return <div className="text-[12px] text-[#9ca3af]">{values.length ? `Single sample: ${Math.round(values[0]!)} ms` : "No LCP samples yet."}</div>;
  }
  const max = Math.max(...values, 1);
  const w = 320;
  const h = 48;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - (v / max) * (h - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="max-w-full">
      <polyline fill="none" stroke="#8664F2" strokeWidth="2" points={pts} />
      {values.map((v, i) => {
        const x = (i / (values.length - 1)) * w;
        const y = h - (v / max) * (h - 4) - 2;
        return <circle key={i} cx={x} cy={y} r={2.5} fill="#8664F2" />;
      })}
    </svg>
  );
}

function fmt(v: number | null) {
  return v == null ? "—" : `${Math.round(v)} ms`;
}
function lcpClass(v: number | null) {
  if (v == null) return "";
  if (v > 2500) return "text-[#DC2626]";
  if (v > 1800) return "text-[#B45309]";
  return "text-[#15803D]";
}
function clsClass(v: number | null) {
  if (v == null) return "";
  if (v > 0.25) return "text-[#DC2626]";
  if (v > 0.1) return "text-[#B45309]";
  return "text-[#15803D]";
}
