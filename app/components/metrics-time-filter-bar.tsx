"use client";

import MetricsCustomTimeFilter from "@/app/components/metrics-custom-time-filter";
import { MetricsTimeFilters } from "@/app/constants/metrics";
import {
  MetricsCustomTimeFilterState,
} from "@/app/interfaces/metrics-time-filter";
import { useEffect, useRef } from "react";

interface MetricsTimeFilterBarProps {
  selectedFilter: string;
  onSelectedFilterChange: (value: string) => void;
  customFilter: MetricsCustomTimeFilterState;
  onCustomFilterChange: (value: MetricsCustomTimeFilterState) => void;
  appliedCustomFilter: MetricsCustomTimeFilterState;
  isCustomOpen: boolean;
  onCustomOpenChange: (open: boolean) => void;
  onCustomApply: () => void;
  onCustomClearAndDismiss: () => void;
}

function formatAppliedCustomLabel(filter: MetricsCustomTimeFilterState) {
  if (filter.mode === "absolute") {
    if (filter.startDate && filter.endDate) {
      return `${filter.startDate} - ${filter.endDate}`;
    }
    return "Custom";
  }

  const unitLabel = filter.unit
    ? filter.unit.charAt(0).toUpperCase() + filter.unit.slice(1)
    : "";

  return `${filter.duration} ${unitLabel}`;
}

export default function MetricsTimeFilterBar({
  selectedFilter,
  onSelectedFilterChange,
  customFilter,
  onCustomFilterChange,
  appliedCustomFilter,
  isCustomOpen,
  onCustomOpenChange,
  onCustomApply,
  onCustomClearAndDismiss,
}: MetricsTimeFilterBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        onCustomOpenChange(false);
      }
    };

    if (isCustomOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isCustomOpen, onCustomOpenChange]);

  const handleFilterClick = (filterValue: string) => {
    if (filterValue === "custom") {
      onCustomOpenChange(true);
      return;
    }

    onSelectedFilterChange(filterValue);
    onCustomOpenChange(false);
  };

  const handleApply = () => {
    onCustomApply();
    onCustomOpenChange(false);
  };

  const handleCancel = () => {
    onCustomOpenChange(false);
  };

  const handleClearAndDismiss = () => {
    onCustomClearAndDismiss();
  };

  return (
    <div className="flex justify-end">
      <div className="relative mt-[20px]" ref={containerRef}>
        <div className="flex items-center border border-[rgba(94,96,102,0.1)] rounded-[8px] h-[40px]">
          {MetricsTimeFilters.map((filter) => {
            const isCustomTab = filter.value === "custom";
            const label =
              isCustomTab && selectedFilter === "custom"
                ? formatAppliedCustomLabel(appliedCustomFilter)
                : filter.label;

            return (
              <div
                className={`h-[25px] text-[14px] flex items-center px-[20px] cursor-pointer border-r border-[rgba(94,96,102,0.1)] last:border-r-0 whitespace-nowrap ${
                  selectedFilter === filter.value ||
                  (isCustomTab && isCustomOpen)
                    ? "text-[#8664F2] font-[500]"
                    : "text-[#49454F]"
                }`}
                key={filter.value}
                onClick={() => handleFilterClick(filter.value)}
              >
                {label}
              </div>
            );
          })}
        </div>

        <MetricsCustomTimeFilter
          isOpen={isCustomOpen}
          value={customFilter}
          onChange={onCustomFilterChange}
          onApply={handleApply}
          onCancel={handleCancel}
          onClearAndDismiss={handleClearAndDismiss}
        />
      </div>
    </div>
  );
}