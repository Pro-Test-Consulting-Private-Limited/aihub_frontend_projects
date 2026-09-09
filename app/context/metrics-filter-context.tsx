"use client";

import {
  DEFAULT_CUSTOM_TIME_FILTER,
  MetricsCustomTimeFilterState,
} from "@/app/interfaces/metrics-time-filter";
import { createContext, useContext, useState, ReactNode } from "react";

const DEFAULT_APPLIED_FILTER: MetricsCustomTimeFilterState = {
  ...DEFAULT_CUSTOM_TIME_FILTER,
  mode: "relative",
  duration: "15",
  unit: "months",
};

interface MetricsFilterContextValue {
  selectedFilter: string;
  setSelectedFilter: (value: string) => void;
  isCustomOpen: boolean;
  setIsCustomOpen: (open: boolean) => void;
  customFilter: MetricsCustomTimeFilterState;
  setCustomFilter: (value: MetricsCustomTimeFilterState) => void;
  appliedCustomFilter: MetricsCustomTimeFilterState;
  setAppliedCustomFilter: (value: MetricsCustomTimeFilterState) => void;
}

const MetricsFilterContext = createContext<MetricsFilterContextValue | null>(
  null,
);

export function MetricsFilterProvider({ children }: { children: ReactNode }) {
  const [selectedFilter, setSelectedFilter] = useState("15m");
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [customFilter, setCustomFilter] = useState(DEFAULT_APPLIED_FILTER);
  const [appliedCustomFilter, setAppliedCustomFilter] = useState(
    DEFAULT_APPLIED_FILTER,
  );

  return (
    <MetricsFilterContext.Provider
      value={{
        selectedFilter,
        setSelectedFilter,
        isCustomOpen,
        setIsCustomOpen,
        customFilter,
        setCustomFilter,
        appliedCustomFilter,
        setAppliedCustomFilter,
      }}
    >
      {children}
    </MetricsFilterContext.Provider>
  );
}

export function useMetricsFilter() {
  const ctx = useContext(MetricsFilterContext);
  if (!ctx) {
    throw new Error(
      "useMetricsFilter must be used within a MetricsFilterProvider",
    );
  }
  return ctx;
}