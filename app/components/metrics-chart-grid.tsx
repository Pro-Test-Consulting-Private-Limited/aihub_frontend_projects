"use client";

import { TbLoader2, TbRefresh } from "react-icons/tb";
import AreaLineChart from "@/app/pages/metrics/charts/area";

export function MetricsStatusBar({
  loading,
  error,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (loading && !error) {
    return (
      <div className="mt-3 flex items-center gap-2 text-[12.5px] text-[#7E7E7E]">
        <TbLoader2 className="animate-spin" size={14} /> Loading metrics…
      </div>
    );
  }
  if (error) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[12.5px] text-[#991B1B]">
        <span>{error}</span>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline"
        >
          <TbRefresh size={14} /> Retry
        </button>
      </div>
    );
  }
  return null;
}

export function MetricsChartCard({
  title,
  metrics,
  emptyHint,
}: {
  title: string;
  metrics: unknown[];
  emptyHint?: string;
}) {
  const series = Array.isArray(metrics) ? metrics : [];
  return (
    <div className="min-w-0 rounded-[15px] border border-[rgba(94,96,102,0.1)] bg-white pb-[24px] dark:border-[#2a2a2a] dark:bg-[#141414]">
      <div className="p-4 text-[14px] text-[#2C2C2C] dark:text-[#ededed]">{title}</div>
      {series.length === 0 ? (
        <div className="flex h-[160px] items-center justify-center px-4 text-center text-[12.5px] text-[#7E7E7E]">
          {emptyHint || "No data in this window. Try a wider range or wait for traffic."}
        </div>
      ) : (
        <AreaLineChart metrics={series as never[]} />
      )}
    </div>
  );
}

export function MetricsChartGrid({ children }: { children: React.ReactNode }) {
  return <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">{children}</div>;
}
