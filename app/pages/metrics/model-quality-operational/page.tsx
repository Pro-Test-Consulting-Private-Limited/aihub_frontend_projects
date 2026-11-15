"use client";

import MetricsTimeFilterBar from "@/app/components/metrics-time-filter-bar";
import { MetricsChartCard, MetricsChartGrid, MetricsStatusBar } from "@/app/components/metrics-chart-grid";
import { useMetricsFilter } from "@/app/context/metrics-filter-context";
import { useMetricsStats } from "@/app/hooks/use-metrics-stats";
import { withQualitySeed } from "@/app/lib/metrics-seed";
import { getQualityMetrics } from "@/app/services/analytics";

export default function ModelQuality() {
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

  const { data, loading, error, reload } = useMetricsStats(getQualityMetrics, { seed: withQualitySeed });

  const handleCustomOpenChange = (open: boolean) => {
    if (open && selectedFilter === "custom") setCustomFilter(appliedCustomFilter);
    setIsCustomOpen(open);
  };

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
        <MetricsChartCard title="Hallucination Rate (Fidelity)" metrics={data?.hallucination?.data || []} />
        <MetricsChartCard title="Healing" metrics={data?.healing?.data || []} />
        <MetricsChartCard title="Validity Rate" metrics={data?.validity_rate?.data || []} />
      </MetricsChartGrid>
    </div>
  );
}