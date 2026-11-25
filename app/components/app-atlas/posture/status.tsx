export const STATUS_BG: Record<string, string> = {
  fail: "bg-[#FEE2E2] text-[#991B1B] dark:bg-[#3f1212] dark:text-[#fecaca]",
  pass: "bg-[#DCFCE7] text-[#166534] dark:bg-[#0f2418] dark:text-[#86efac]",
  partial: "bg-[#FEF9C3] text-[#854D0E] dark:bg-[#3a2a08] dark:text-[#fde68a]",
  not_tested: "bg-[#F3F4F6] text-[#4B5563] dark:bg-[#1a1a1a] dark:text-[#9ca3af]",
  manual: "bg-[#E0E7FF] text-[#3730A3] dark:bg-[#1e1b4b] dark:text-[#c7d2fe]",
  human_verified: "bg-[#F5D0FE] text-[#86198F] dark:bg-[#3b0764] dark:text-[#f0abfc]",
  human_verified_pass: "bg-[#F5D0FE] text-[#86198F] dark:bg-[#3b0764] dark:text-[#f0abfc]",
  human_verified_fail: "bg-[#F5D0FE] text-[#86198F] dark:bg-[#3b0764] dark:text-[#f0abfc]",
  human_verified_na: "bg-[#F5D0FE] text-[#86198F] dark:bg-[#3b0764] dark:text-[#f0abfc]",
  running: "bg-[#EDE9FE] text-[#5B21B6] dark:bg-[#2e1065] dark:text-[#ddd6fe]",
  queued: "bg-[#F3F4F6] text-[#374151]",
  done: "bg-[#DCFCE7] text-[#166534]",
  failed: "bg-[#FEE2E2] text-[#991B1B]",
  cancelled: "bg-[#F3F4F6] text-[#4B5563]",
};

export const FILTER_CHIPS = [
  { key: "fail", label: "Fail" },
  { key: "pass", label: "Pass" },
  { key: "partial", label: "Partial" },
  { key: "not_tested", label: "Not tested" },
  { key: "manual", label: "Manual" },
  { key: "human_verified", label: "Human verified" },
] as const;

export function statusBucket(status: string): string {
  if (String(status).startsWith("human_verified")) return "human_verified";
  return status;
}

export function StatusChip({ status, label }: { status: string; label?: string }) {
  const key = statusBucket(status);
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[12px] font-medium ${STATUS_BG[status] || STATUS_BG[key] || STATUS_BG.not_tested}`}
    >
      {label || status.replace(/_/g, " ")}
    </span>
  );
}

export function formatWhen(ts?: number | null): string {
  if (!ts) return "Never";
  try {
    return new Date(ts).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Unknown";
  }
}

export function passLabel(id?: string | null): string {
  switch (id) {
    case "inventory":
      return "Site discovery";
    case "pass1_passive":
      return "Pass 1";
    case "pass2_light_probes":
      return "Pass 2";
    case "pass3_mutation":
      return "Pass 3";
    case "pass4_identity":
      return "Pass 4";
    case "pass5_guided":
      return "Pass 5";
    case "connector":
      return "Connector";
    case "manual":
      return "Manual";
    default:
      return id || "Unassigned";
  }
}
