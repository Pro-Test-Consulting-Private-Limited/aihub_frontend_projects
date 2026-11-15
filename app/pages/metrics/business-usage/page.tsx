"use client";

import MetricsTimeFilterBar from "@/app/components/metrics-time-filter-bar";
import { MetricsChartCard, MetricsChartGrid, MetricsStatusBar } from "@/app/components/metrics-chart-grid";
import { useMetricsFilter } from "@/app/context/metrics-filter-context";
import { pickModelSeries, useMetricsStats } from "@/app/hooks/use-metrics-stats";
import { getBusinessMetrics } from "@/app/services/analytics";

export default function BusinessUsage() {
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

  const { data, loading, error, reload } = useMetricsStats(getBusinessMetrics);

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
          setSelectedFilter("15m");
          setIsCustomOpen(false);
        }}
      />
      <MetricsStatusBar loading={loading && !data} error={error} onRetry={reload} />
      <MetricsChartGrid>
        <MetricsChartCard title="Total Invocations / Requests" metrics={data?.total_invocations?.data || []} />
        <MetricsChartCard title="Model-Specific Invocations" metrics={pickModelSeries(data?.models)} />
        <MetricsChartCard title="Input Token Count" metrics={data?.tokens?.input || []} />
        <MetricsChartCard title="Output Token Count (Generated)" metrics={data?.tokens?.output || []} />
      </MetricsChartGrid>
    </div>
  );
}
