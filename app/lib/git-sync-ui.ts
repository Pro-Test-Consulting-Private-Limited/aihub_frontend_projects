/** Shared helpers for explorer GitHub pill + connect panel status. */

export type GitSyncUiTone = "synced" | "waiting" | "syncing" | "paused" | "attention" | "reconnect" | "disconnected";

export type GitSyncStatusInput = {
  connected?: boolean;
  lastStatus?: string | null;
  lastError?: string | null;
  dirty?: boolean;
  syncing?: boolean;
  /** Master switch off (from availability). */
  masterOff?: boolean;
  /** Account OAuth / vault not usable. */
  needsReconnectAccount?: boolean;
};

export function repoNameOnly(repo: string | null | undefined): string {
  if (!repo) return "GitHub";
  const parts = repo.split("/").filter(Boolean);
  return parts[parts.length - 1] || repo;
}

export function shortSha(sha: string | null | undefined): string {
  if (!sha) return "";
  return sha.slice(0, 7);
}

export function relativeTime(ts: number | null | undefined, now = Date.now()): string {
  if (!ts) return "Not synced yet";
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function gitSyncTone(input: GitSyncStatusInput): GitSyncUiTone {
  if (input.needsReconnectAccount) return "reconnect";
  if (!input.connected) return "disconnected";
  if (input.masterOff || input.lastStatus === "paused_master_off") return "paused";
  if (input.lastStatus === "needs_connect") return "reconnect";
  if (input.lastStatus === "error" || input.lastError) return "attention";
  if (input.syncing) return "syncing";
  if (input.dirty) return "waiting";
  if (input.lastStatus === "ok" || input.lastStatus === "nothing_to_commit" || !input.lastStatus) return "synced";
  if (/error|fail/i.test(input.lastStatus)) return "attention";
  return "waiting";
}

export function gitSyncStatusLabel(tone: GitSyncUiTone): string {
  switch (tone) {
    case "synced":
      return "Synced";
    case "waiting":
      return "Waiting to sync";
    case "syncing":
      return "Syncing";
    case "paused":
      return "Paused by admin";
    case "attention":
      return "Needs attention";
    case "reconnect":
      return "Reconnect GitHub";
    default:
      return "Disconnected";
  }
}

/** Tailwind classes for the small explorer status dot. */
export function gitSyncDotClass(tone: GitSyncUiTone): string {
  switch (tone) {
    case "synced":
      return "bg-[#22C55E]";
    case "waiting":
    case "syncing":
      return "bg-[#3B82F6]";
    case "paused":
      return "bg-[#F59E0B]";
    case "attention":
    case "reconnect":
      return "bg-[#EF4444]";
    default:
      return "bg-[#9CA3AF]";
  }
}

export function gitSyncPillClass(tone: GitSyncUiTone): string {
  switch (tone) {
    case "synced":
      return "bg-[#ECFDF5] text-[#15803D] border-[#86EFAC] dark:bg-[#052e1c] dark:text-[#86EFAC] dark:border-[#166534]";
    case "waiting":
    case "syncing":
      return "bg-[#EFF6FF] text-[#1D4ED8] border-[#93C5FD] dark:bg-[#0c1a33] dark:text-[#93C5FD] dark:border-[#1e3a8a]";
    case "paused":
      return "bg-[#FFFBEB] text-[#B45309] border-[#FCD34D] dark:bg-[#2a2210] dark:text-[#FCD34D] dark:border-[#92400e]";
    case "attention":
    case "reconnect":
      return "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA] dark:bg-[#2a1212] dark:text-[#FCA5A5] dark:border-[#7f1d1d]";
    default:
      return "bg-[#F3F4F6] text-[#6B7280] border-[#E5E7EB] dark:bg-[#1a1a1a] dark:text-[#9ca3af] dark:border-[#2a2a2a]";
  }
}

export function gitSyncGuidance(tone: GitSyncUiTone, lastError?: string | null): string {
  if (tone === "reconnect") {
    return "Reconnect GitHub on the Integrations page, then return here.";
  }
  if (tone === "paused") {
    return "An admin turned off GitHub sync. Your canvas is unchanged; syncing will resume when they turn it back on.";
  }
  if (tone === "attention") {
    return lastError
      ? `${lastError.slice(0, 160)}${lastError.length > 160 ? "…" : ""}`
      : "Something went wrong syncing. Check your GitHub connection on Integrations, or ask an admin to review the logs site.";
  }
  if (tone === "waiting" || tone === "syncing") {
    return "Changes to this canvas and its SIT are saved to GitHub automatically about a minute after you stop editing.";
  }
  return "Changes to this canvas and its SIT are saved to GitHub automatically about a minute after you stop editing.";
}

export function githubRepoUrl(owner: string | null | undefined, repoFull: string | null | undefined): string | null {
  if (!repoFull) return null;
  if (repoFull.startsWith("http")) return repoFull;
  return `https://github.com/${repoFull.replace(/^\//, "")}`;
}

export function githubBranchUrl(repoFull: string | null | undefined, branch: string | null | undefined): string | null {
  const base = githubRepoUrl(null, repoFull);
  if (!base || !branch) return null;
  return `${base}/tree/${encodeURIComponent(branch)}`;
}

export function githubCommitUrl(repoFull: string | null | undefined, sha: string | null | undefined): string | null {
  const base = githubRepoUrl(null, repoFull);
  if (!base || !sha) return null;
  return `${base}/commit/${sha}`;
}
