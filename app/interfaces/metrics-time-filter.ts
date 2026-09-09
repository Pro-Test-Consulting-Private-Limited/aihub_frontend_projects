import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(customParseFormat);

export type MetricsTimeFilterMode = "absolute" | "relative";

export type RelativeTimeUnit =
  | "minutes"
  | "hours"
  | "days"
  | "weeks"
  | "months";

export interface MetricsCustomTimeFilterState {
  mode: MetricsTimeFilterMode;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  duration: string;
  unit: RelativeTimeUnit;
}

export const DEFAULT_CUSTOM_TIME_FILTER: MetricsCustomTimeFilterState = {
  mode: "relative",
  startDate: "",
  startTime: "00:00:00",
  endDate: "",
  endTime: "23:59:59",
  duration: "3",
  unit: "hours",
};

export const RELATIVE_TIME_UNITS: { label: string; value: RelativeTimeUnit }[] =
  [
    { label: "Minutes", value: "minutes" },
    { label: "Hours", value: "hours" },
    { label: "Days", value: "days" },
    { label: "Weeks", value: "weeks" },
    { label: "Months", value: "months" },
  ];

export const RELATIVE_PRESETS: Record<RelativeTimeUnit, number[]> = {
  minutes: [1, 3, 5, 15, 30, 45],
  hours: [1, 2, 3, 6, 8, 12],
  days: [1, 2, 3, 4, 5, 6],
  weeks: [1, 2, 4, 6],
  months: [3, 6, 12, 15],
};

const UNIT_SECONDS: Record<RelativeTimeUnit, number> = {
  minutes: 60,
  hours: 3600,
  days: 86400,
  weeks: 604800,
  months: 2592000,
};

export function getCustomFilterSeconds(
  state: MetricsCustomTimeFilterState,
): number {
  if (state.mode === "relative") {
    const duration = parseInt(state.duration, 10) || 0;
    return duration * UNIT_SECONDS[state.unit];
  }

  const start = dayjs(
    `${state.startDate} ${state.startTime}`,
    "YYYY/MM/DD HH:mm:ss",
    true,
  );
  const end = dayjs(
    `${state.endDate} ${state.endTime}`,
    "YYYY/MM/DD HH:mm:ss",
    true,
  );

  if (!start.isValid() || !end.isValid()) {
    return 10800;
  }

  return Math.max(end.diff(start, "second"), 60);
}
