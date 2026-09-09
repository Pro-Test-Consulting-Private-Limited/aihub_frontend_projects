/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import MetricsTimeFilterBar from "@/app/components/metrics-time-filter-bar";
import { useMetricsFilter } from "@/app/context/metrics-filter-context";
import { MetricsTimeFilters } from "@/app/constants/metrics";
import { getCustomFilterSeconds } from "@/app/interfaces/metrics-time-filter";
import { getQualityMetrics } from "@/app/services/analytics";
import { useEffect, useState } from "react";
import AreaLineChart from "../charts/area";

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

  const [statsData, setStatsData] = useState<any>(null);

  const handleCustomOpenChange = (open: boolean) => {
    if (open && selectedFilter === "custom") {
      setCustomFilter(appliedCustomFilter);
    }
    setIsCustomOpen(open);
  };

  const handleCustomApply = () => {
    setAppliedCustomFilter(customFilter);
    setSelectedFilter("custom");
  };

  const handleCustomClearAndDismiss = () => {
    setSelectedFilter("15m");
    setIsCustomOpen(false);
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const seconds =
          selectedFilter === "custom"
            ? getCustomFilterSeconds(appliedCustomFilter)
            : MetricsTimeFilters.find((f) => f.value === selectedFilter)
                ?.seconds || 10800;

        const res = await getQualityMetrics(seconds);
        setStatsData(res.data);
      } catch (err) {
        console.log(err);
      }
    };

    fetchStats();
  }, [selectedFilter, appliedCustomFilter]);

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
        onCustomApply={handleCustomApply}
        onCustomClearAndDismiss={handleCustomClearAndDismiss}
      />

      <div className="flex justify-between flex-wrap items-center mt-[20px]">
        <div className="w-[49%] border border-[rgba(94,96,102,0.1)] rounded-[15px] pb-[30px] mb-[20px]">
          <div className="text-[14px] text-[#2C2C2C] p-4">
            Hallucination Rate (Fidelity)
          </div>
          <AreaLineChart metrics={statsData?.hallucination?.data || []} />
        </div>
        <div className="w-[49%] border border-[rgba(94,96,102,0.1)] rounded-[15px] pb-[30px] mb-[20px]">
          <div className="text-[14px] text-[#2C2C2C] p-4">Healing</div>
          <AreaLineChart metrics={statsData?.healing?.data || []} />
        </div>

        <div className="w-[49%] border border-[rgba(94,96,102,0.1)] rounded-[15px] pb-[30px] mb-[20px]">
          <div className="text-[14px] text-[#2C2C2C] p-4">Validity Rate</div>
          <AreaLineChart metrics={statsData?.validity_rate?.data || []} />
        </div>
      </div>
    </div>
  );
}