/**
 * Shared HF endpoint → UI status mapping for Home and SIT.
 * Raw values are the endpoint/clarify `state` strings (e.g. running, paused).
 */

export type UiModelStatus =
  | "ready"
  | "warming_up"
  | "inactive"
  | "checking"
  | "not_configured";

/** Raw states that mean the endpoint is actually starting (after normalize). */
export const RAW_WARMING_NORMALIZED = ["initializing", "pending", "updating"] as const;

const CHECKING_MS = 10_000;

export type MapModelStatusInput = {
  /** Raw endpoint/clarify state string. */
  raw?: string | null;
  /** First load / request in flight. */
  loading?: boolean;
  /** Request failed (network/HTTP). */
  error?: boolean;
  /** App Atlas SIT HF URL/token missing (existing SIT-only path). */
  notConfigured?: boolean;
  /** When loading started (ms). Used to expire checking → inactive after 10s. */
  checkingStartedAt?: number | null;
  now?: number;
};

export type MappedModelStatus = {
  ui: UiModelStatus;
  /** Home pill text after "AI Model " */
  homeLabel: "Active" | "Starting" | "Inactive";
  /** SIT pill text after "Model · " */
  sitLabel: string;
  /** Plain-language sentence for tooltips. */
  tooltip: string;
  homeBadgeClass: string;
  homeDotClass: string;
  sitPillClass: string;
  generateDisabled: boolean;
};

export function normalizeModelRaw(raw: string | null | undefined): string {
  return String(raw ?? "")
    .trim()
    .replace(/_/g, "")
    .toLowerCase();
}

export function mapModelStatus(input: MapModelStatusInput): MappedModelStatus {
  const now = input.now ?? Date.now();

  if (input.notConfigured) {
    return finish("not_configured");
  }

  if (input.loading) {
    const started = input.checkingStartedAt ?? now;
    if (now - started < CHECKING_MS) return finish("checking");
    return finish("inactive");
  }

  if (input.error) return finish("inactive");

  const norm = normalizeModelRaw(input.raw);
  if (!norm) return finish("inactive");

  if (norm === "running") return finish("ready");

  if ((RAW_WARMING_NORMALIZED as readonly string[]).includes(norm)) {
    return finish("warming_up");
  }

  // paused, scaledtozero, failed, updatefailed, unknown, made-up → inactive
  return finish("inactive");
}

function finish(ui: UiModelStatus): MappedModelStatus {
  switch (ui) {
    case "ready":
      return {
        ui,
        homeLabel: "Active",
        sitLabel: "Ready",
        tooltip: "The AI model is ready.",
        homeBadgeClass: "bg-[rgba(40,167,69,0.1)] text-[#28A745]",
        homeDotClass: "bg-[#28A745]",
        sitPillClass: "border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]",
        generateDisabled: false,
      };
    case "warming_up":
      return {
        ui,
        homeLabel: "Starting",
        sitLabel: "Warming up",
        tooltip: "The AI model is starting. Try again in a moment.",
        homeBadgeClass: "bg-[rgba(255,193,7,0.15)] text-[#B7791F]",
        homeDotClass: "bg-[#B7791F]",
        sitPillClass: "border-[#fcd34d] bg-[#fffbeb] text-[#92400e]",
        generateDisabled: true,
      };
    case "checking":
      return {
        ui,
        homeLabel: "Inactive",
        sitLabel: "Checking",
        tooltip: "Checking whether the AI model is available.",
        homeBadgeClass: "bg-[rgba(220,53,69,0.1)] text-[#DC3545]",
        homeDotClass: "bg-[#DC3545]",
        sitPillClass: "border-[#e5e7eb] bg-[#f9fafb] text-[#6b7280]",
        generateDisabled: true,
      };
    case "not_configured":
      return {
        ui,
        homeLabel: "Inactive",
        sitLabel: "Not configured",
        tooltip: "The AI model is not configured. Generation is unavailable.",
        homeBadgeClass: "bg-[rgba(220,53,69,0.1)] text-[#DC3545]",
        homeDotClass: "bg-[#DC3545]",
        sitPillClass: "border-[#fecaca] bg-[#fff5f5] text-[#b91c1c]",
        generateDisabled: true,
      };
    case "inactive":
    default:
      return {
        ui: "inactive",
        homeLabel: "Inactive",
        sitLabel: "Inactive",
        tooltip: "The AI model is inactive. Generation is unavailable.",
        homeBadgeClass: "bg-[rgba(220,53,69,0.1)] text-[#DC3545]",
        homeDotClass: "bg-[#DC3545]",
        sitPillClass: "border-[#fecaca] bg-[#fff5f5] text-[#b91c1c]",
        generateDisabled: true,
      };
  }
}
