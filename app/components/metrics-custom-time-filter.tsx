"use client";

import Dropdown from "@/app/components/dropdown";
import {
  MetricsCustomTimeFilterState,
  MetricsTimeFilterMode,
  RELATIVE_PRESETS,
  RELATIVE_TIME_UNITS,
  RelativeTimeUnit,
} from "@/app/interfaces/metrics-time-filter";
import dayjs, { Dayjs } from "dayjs";
import Image from "next/image";
import { useMemo, useState } from "react";
import ChevronRight from "../../public/icons/chevron-right.svg";

interface MetricsCustomTimeFilterProps {
  isOpen: boolean;
  value: MetricsCustomTimeFilterState;
  onChange: (value: MetricsCustomTimeFilterState) => void;
  onApply: () => void;
  onCancel: () => void;
  onClearAndDismiss: () => void;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function CalendarMonth({
  month,
  selectedStart,
  selectedEnd,
  onDateClick,
  showPrevNav,
  showNextNav,
  onPrevMonth,
  onNextMonth,
}: {
  month: Dayjs;
  selectedStart: Dayjs | null;
  selectedEnd: Dayjs | null;
  onDateClick: (date: Dayjs) => void;
  showPrevNav: boolean;
  showNextNav: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) {
  const calendarDays = useMemo(() => {
    const startOfMonth = month.startOf("month");
    const startOffset = (startOfMonth.day() + 6) % 7;
    const gridStart = startOfMonth.subtract(startOffset, "day");
    return Array.from({ length: 42 }, (_, index) =>
      gridStart.add(index, "day"),
    );
  }, [month]);

  const isInRange = (date: Dayjs) => {
    if (!selectedStart || !selectedEnd) return false;
    return date.isAfter(selectedStart, "day") && date.isBefore(selectedEnd, "day");
  };

  const isSelected = (date: Dayjs) => {
    if (selectedStart?.isSame(date, "day")) return true;
    if (selectedEnd?.isSame(date, "day")) return true;
    return false;
  };

  return (
    <div className="flex-1 min-w-[280px]">
      <div className="flex items-center justify-between mb-3 px-1">
        {showPrevNav ? (
          <button
            type="button"
            onClick={onPrevMonth}
            className="text-[#49454F] hover:text-[#8664F2] text-[18px] w-6 h-6 flex items-center justify-center"
            aria-label="Previous month"
          >
            ‹
          </button>
        ) : (
          <span className="w-6" />
        )}
        <span className="text-[14px] font-[500] text-[#2C2C2C]">
          {month.format("MMMM YYYY")}
        </span>
        {showNextNav ? (
          <button
            type="button"
            onClick={onNextMonth}
            className="text-[#49454F] hover:text-[#8664F2] text-[18px] w-6 h-6 flex items-center justify-center"
            aria-label="Next month"
          >
            ›
          </button>
        ) : (
          <span className="w-6" />
        )}
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="text-[12px] text-[#49454F] font-[500] py-1"
          >
            {day}
          </div>
        ))}
        {calendarDays.map((date) => {
          const isCurrentMonth = date.month() === month.month();
          const inRange = isInRange(date);
          const selected = isSelected(date);

          return (
            <button
              key={date.format("YYYY-MM-DD")}
              type="button"
              onClick={() => onDateClick(date)}
              className={`h-8 w-8 mx-auto rounded-full text-[13px] transition-colors ${
                selected
                  ? "bg-[#8664F2] text-white font-[500]"
                  : inRange
                    ? "bg-[#F3EDFF] text-[#8664F2]"
                    : isCurrentMonth
                      ? "text-[#2C2C2C] hover:bg-[#F3EDFF]"
                      : "text-[#CAC4D0] hover:bg-[#F3EDFF]"
              }`}
            >
              {date.date()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function MetricsCustomTimeFilter({
  isOpen,
  value,
  onChange,
  onApply,
  onCancel,
  onClearAndDismiss,
}: MetricsCustomTimeFilterProps) {
  const [leftMonth, setLeftMonth] = useState(dayjs().startOf("month"));

  const selectedStart = value.startDate
    ? dayjs(value.startDate, "YYYY/MM/DD", true)
    : null;
  const selectedEnd = value.endDate
    ? dayjs(value.endDate, "YYYY/MM/DD", true)
    : null;

  const updateValue = (partial: Partial<MetricsCustomTimeFilterState>) => {
    onChange({ ...value, ...partial });
  };

  const setMode = (mode: MetricsTimeFilterMode) => {
    updateValue({ mode });
  };

  const handleDateClick = (date: Dayjs) => {
    const formatted = date.format("YYYY/MM/DD");

    if (
      !selectedStart ||
      (selectedStart && selectedEnd) ||
      date.isBefore(selectedStart, "day")
    ) {
      updateValue({
        startDate: formatted,
        endDate: "",
        startTime: value.startTime || "00:00:00",
      });
      return;
    }

    updateValue({
      endDate: formatted,
      endTime: value.endTime || "23:59:59",
    });
  };

  const handlePresetClick = (unit: RelativeTimeUnit, amount: number) => {
    updateValue({
      duration: String(amount),
      unit,
    });
  };

  const formatHeaderDate = (date: string) => {
    if (!date) return null;
    const parsed = dayjs(date, "YYYY/MM/DD", true);
    return parsed.isValid() ? parsed.format("MMM D, YYYY") : date;
  };

  if (!isOpen) return null;

  return (
    <div className="absolute top-[calc(100%+8px)] right-0 z-20 w-[680px] bg-white border border-[rgba(94,96,102,0.1)] rounded-[12px] shadow-lg">
      {value.mode === "absolute" && (
        <div className="flex items-center justify-between px-5 py-3 border-b border-[rgba(94,96,102,0.1)] text-[14px] text-[#49454F]">
          <div className="flex items-center gap-2">
            <span>{formatHeaderDate(value.startDate) || "Start date"}</span>
            <Image src={ChevronRight} alt="" width={8} height={8} />
            <span>{formatHeaderDate(value.endDate) || "End date"}</span>
          </div>
          <span className="text-[16px] text-[#49454F]">▦</span>
        </div>
      )}

      <div className="p-5">
        <div className="inline-flex border border-[rgba(94,96,102,0.1)] rounded-[8px] overflow-hidden mb-5">
          <button
            type="button"
            onClick={() => setMode("absolute")}
            className={`px-4 py-2 text-[14px] ${
              value.mode === "absolute"
                ? "bg-[#8664F2] text-white font-[500]"
                : "bg-white text-[#49454F]"
            }`}
          >
            Absolute mode
          </button>
          <button
            type="button"
            onClick={() => setMode("relative")}
            className={`px-4 py-2 text-[14px] ${
              value.mode === "relative"
                ? "bg-[#8664F2] text-white font-[500]"
                : "bg-white text-[#49454F]"
            }`}
          >
            Relative mode
          </button>
        </div>

        {value.mode === "absolute" ? (
          <>
            <div className="flex gap-6 mb-5">
              <CalendarMonth
                month={leftMonth}
                selectedStart={selectedStart?.isValid() ? selectedStart : null}
                selectedEnd={selectedEnd?.isValid() ? selectedEnd : null}
                onDateClick={handleDateClick}
                showPrevNav
                showNextNav={false}
                onPrevMonth={() =>
                  setLeftMonth((current) => current.subtract(1, "month"))
                }
                onNextMonth={() =>
                  setLeftMonth((current) => current.add(1, "month"))
                }
              />
              <CalendarMonth
                month={leftMonth.add(1, "month")}
                selectedStart={selectedStart?.isValid() ? selectedStart : null}
                selectedEnd={selectedEnd?.isValid() ? selectedEnd : null}
                onDateClick={handleDateClick}
                showPrevNav={false}
                showNextNav
                onPrevMonth={() =>
                  setLeftMonth((current) => current.subtract(1, "month"))
                }
                onNextMonth={() =>
                  setLeftMonth((current) => current.add(1, "month"))
                }
              />
            </div>

            <div className="grid grid-cols-4 gap-3 mb-2">
              <div>
                <label className="block text-[13px] font-[500] text-[#2C2C2C] mb-1">
                  Start date
                </label>
                <input
                  type="text"
                  placeholder="YYYY/MM/DD"
                  value={value.startDate}
                  onChange={(event) =>
                    updateValue({ startDate: event.target.value })
                  }
                  className="w-full h-[36px] px-3 border border-[rgba(94,96,102,0.1)] rounded-[8px] text-[14px] text-[#2C2C2C] outline-none focus:border-[#8664F2]"
                />
              </div>
              <div>
                <label className="block text-[13px] font-[500] text-[#2C2C2C] mb-1">
                  Start time
                </label>
                <input
                  type="text"
                  placeholder="hh:mm:ss"
                  value={value.startTime}
                  onChange={(event) =>
                    updateValue({ startTime: event.target.value })
                  }
                  className="w-full h-[36px] px-3 border border-[rgba(94,96,102,0.1)] rounded-[8px] text-[14px] text-[#2C2C2C] outline-none focus:border-[#8664F2]"
                />
              </div>
              <div>
                <label className="block text-[13px] font-[500] text-[#2C2C2C] mb-1">
                  End date
                </label>
                <input
                  type="text"
                  placeholder="YYYY/MM/DD"
                  value={value.endDate}
                  onChange={(event) =>
                    updateValue({ endDate: event.target.value })
                  }
                  className="w-full h-[36px] px-3 border border-[rgba(94,96,102,0.1)] rounded-[8px] text-[14px] text-[#2C2C2C] outline-none focus:border-[#8664F2]"
                />
              </div>
              <div>
                <label className="block text-[13px] font-[500] text-[#2C2C2C] mb-1">
                  End time
                </label>
                <input
                  type="text"
                  placeholder="hh:mm:ss"
                  value={value.endTime}
                  onChange={(event) =>
                    updateValue({ endTime: event.target.value })
                  }
                  className="w-full h-[36px] px-3 border border-[rgba(94,96,102,0.1)] rounded-[8px] text-[14px] text-[#2C2C2C] outline-none focus:border-[#8664F2]"
                />
              </div>
            </div>
            <p className="text-[12px] text-[#49454F]">
              For date, use YY/MM/DD. For time, use hh:mm:ss 24hr format.
            </p>
          </>
        ) : (
          <>
            <div className="space-y-4 mb-5">
              {(Object.keys(RELATIVE_PRESETS) as RelativeTimeUnit[]).map(
                (unit) => (
                  <div key={unit} className="flex items-center gap-4">
                    <span className="w-[70px] text-[14px] font-[500] text-[#2C2C2C] capitalize">
                      {unit}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {RELATIVE_PRESETS[unit].map((amount) => {
                        const isActive =
                          value.unit === unit &&
                          value.duration === String(amount);

                        return (
                          <button
                            key={`${unit}-${amount}`}
                            type="button"
                            onClick={() => handlePresetClick(unit, amount)}
                            className={`min-w-[40px] h-[32px] px-3 rounded-[8px] border text-[14px] ${
                              isActive
                                ? "border-[#8664F2] bg-[#FBF8FF] text-[#8664F2] font-[500]"
                                : "border-[rgba(94,96,102,0.1)] bg-white text-[#2C2C2C] hover:border-[#8664F2]"
                            }`}
                          >
                            {amount}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ),
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-[500] text-[#2C2C2C] mb-1">
                  Duration
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={value.duration}
                  onChange={(event) => {
                    const nextValue = event.target.value.replace(/\D/g, "");
                    updateValue({ duration: nextValue });
                  }}
                  className="w-full h-[36px] px-3 border border-[rgba(94,96,102,0.1)] rounded-[8px] text-[14px] text-[#2C2C2C] outline-none focus:border-[#8664F2]"
                />
                <p className="text-[12px] text-[#49454F] mt-1">
                  Up to 4 digits.
                </p>
              </div>
              <div>
                <label className="block text-[13px] font-[500] text-[#2C2C2C] mb-1">
                  Unit of time
                </label>
                <Dropdown
                  options={RELATIVE_TIME_UNITS}
                  placeholder="Select unit"
                  selected={
                    RELATIVE_TIME_UNITS.find((item) => item.value === value.unit) ||
                    null
                  }
                  onChange={(item) =>
                    updateValue({ unit: item.value as RelativeTimeUnit })
                  }
                  className="w-full"
                  buttonClass="w-full min-w-0"
                />
              </div>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-between px-5 py-4 border-t border-[rgba(94,96,102,0.1)]">
        <button
          type="button"
          onClick={onClearAndDismiss}
          className="h-[36px] px-4 rounded-[8px] border border-[#8664F2] text-[#8664F2] text-[14px] font-[500]"
        >
          Clear and dismiss
        </button>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="text-[#8664F2] text-[14px] font-[500] px-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onApply}
            className="h-[36px] px-5 rounded-[8px] bg-[#8664F2] text-white text-[14px] font-[500]"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
