"use client";

import type { UiModelStatus } from "@/app/lib/map-model-status";

export type ModelStatusPillStatus = UiModelStatus;

export type ModelStatusPresentation = {
  label: string;
  tooltip: string;
  badgeClass: string;
  dotClass: string;
};

/** Home pill look is the source of truth (dot + rounded badge). */
export function modelStatusPresentation(status: ModelStatusPillStatus): ModelStatusPresentation {
  switch (status) {
    case "ready":
      return {
        label: "AI Model Active",
        tooltip: "The AI model is ready.",
        badgeClass: "bg-[rgba(40,167,69,0.1)] text-[#28A745]",
        dotClass: "bg-[#28A745]",
      };
    case "warming_up":
      return {
        label: "AI Model Starting",
        tooltip: "The AI model is starting. Try again in a moment.",
        badgeClass: "bg-[rgba(255,193,7,0.15)] text-[#B7791F]",
        dotClass: "bg-[#B7791F]",
      };
    case "checking":
      return {
        label: "AI Model Checking",
        tooltip: "Checking the AI model status.",
        badgeClass: "bg-[rgba(107,114,128,0.12)] text-[#6b7280]",
        dotClass: "bg-[#6b7280]",
      };
    case "not_configured":
      return {
        label: "AI Model Not configured",
        tooltip: "The AI model is not configured.",
        badgeClass: "bg-[rgba(220,53,69,0.1)] text-[#DC3545]",
        dotClass: "bg-[#DC3545]",
      };
    case "inactive":
    default:
      return {
        label: "AI Model Inactive",
        tooltip: "The AI model is inactive. Generation is unavailable.",
        badgeClass: "bg-[rgba(220,53,69,0.1)] text-[#DC3545]",
        dotClass: "bg-[#DC3545]",
      };
  }
}

/**
 * Shared model-status pill for Home and SIT.
 * `size="sm"` slightly tightens padding for the SIT toolbar; same labels and colors.
 */
export function ModelStatusPill({
  status,
  className = "",
  size = "md",
  testId = "model-status-pill",
  titleOverride,
}: {
  status: ModelStatusPillStatus;
  className?: string;
  size?: "md" | "sm";
  testId?: string;
  /** Optional override (e.g. Home backend-down diagnostic tooltip). */
  titleOverride?: string;
}) {
  const p = modelStatusPresentation(status);
  const sizeClass =
    size === "sm"
      ? "h-[22px] ml-0 px-[12px] text-[11px]"
      : "h-[26px] ml-[15px] px-[15px] text-[12px]";

  return (
    <div
      className={`flex justify-center items-center rounded-[26px] font-[500] ${sizeClass} ${p.badgeClass} ${className}`}
      title={titleOverride ?? p.tooltip}
      data-testid={testId}
      data-model-status={status}
    >
      <div
        className={`w-[5px] h-[5px] rounded-full mr-[8px] animate-pulse-blocking ${p.dotClass}`}
      />
      {p.label}
    </div>
  );
}
