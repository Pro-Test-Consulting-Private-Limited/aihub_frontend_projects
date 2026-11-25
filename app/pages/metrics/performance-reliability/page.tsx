"use client";

import MetricsTimeFilterBar from "@/app/components/metrics-time-filter-bar";
import { MetricsChartCard, MetricsChartGrid, MetricsStatusBar } from "@/app/components/metrics-chart-grid";
import { useMetricsFilter } from "@/app/context/metrics-filter-context";
import { useMetricsStats } from "@/app/hooks/use-metrics-stats";
import { withPerformanceSeed } from "@/app/lib/metrics-seed";
import { getPerformanceMetrics } from "@/app/services/analytics";

export default function PerformanceReliability() {
  const {
    selectedFilter,
    setSelectedFilter,
    isCustomOpen,
    setIsCustomOpen,
    customFilter,
    setCustomFilter,
    appliedCustomFilter,
    setAppliedCustomFilter,
  } = useMetricsFilter();

  const { data, loading, error, reload } = useMetricsStats(getPerformanceMetrics, {
    seed: withPerformanceSeed,
  });

  const handleCustomOpenChange = (open: boolean) => {
    if (open && selectedFilter === "custom") setCustomFilter(appliedCustomFilter);
    setIsCustomOpen(open);
  };

  const throttling = data?.throttling?.data || data?.throughput?.data || [];

  return (
    <div>
      <MetricsTimeFilterBar
        selectedFilter={selectedFilter}
        onSelectedFilterChange={setSelectedFilter}
        customFilter={customFilter}
        onCustomFilterChange={setCustomFilter}
        appliedCustomFilter={appliedCustomFilter}
        isCustomOpen={isCustomOpen}
        onCustomOpenChange={handleCustomOpenChange}
        onCustomApply={() => {
          setAppliedCustomFilter(customFilter);
          setSelectedFilter("custom");
        }}
        onCustomClearAndDismiss={() => {
          setSelectedFilter("1h");
          setIsCustomOpen(false);
        }}
      />
      <MetricsStatusBar loading={loading && !data} error={error} onRetry={reload} />
      <MetricsChartGrid>
        <MetricsChartCard title="End-to-End Latency" metrics={data?.api_latency?.data || []} />
        <MetricsChartCard title="Model Inference Latency" metrics={data?.inference_latency?.data || []} />
        <MetricsChartCard title="Error Rate" metrics={data?.error_rate?.data || []} />
        <MetricsChartCard
          title="Throttling Events"
          metrics={throttling}
          emptyHint={
            data?.throughput?.data?.length && !(data?.throttling || data?.throttle_events)
              ? "Showing throughput (no dedicated throttling series from API)."
              : undefined
          }
        />
      </MetricsChartGrid>
    </div>
  );
}
