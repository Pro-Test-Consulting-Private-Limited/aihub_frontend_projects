import { describe, expect, it } from "vitest";
import {
  gitSyncDotClass,
  gitSyncStatusLabel,
  gitSyncTone,
  repoNameOnly,
  shortSha,
  relativeTime,
} from "./git-sync-ui";

describe("git-sync-ui", () => {
  it("shows repo name only for long org/repo paths", () => {
    expect(repoNameOnly("Pro-Test-Consulting-Private-Limited/appatlas-data")).toBe("appatlas-data");
    expect(repoNameOnly("org/very-long-repository-name-that-overflows")).toBe(
      "very-long-repository-name-that-overflows",
    );
  });

  it("maps tones for explorer dots and panel labels", () => {
    expect(gitSyncTone({ connected: true, lastStatus: "ok" })).toBe("synced");
    expect(gitSyncTone({ connected: true, dirty: true })).toBe("waiting");
    expect(gitSyncTone({ connected: true, syncing: true })).toBe("syncing");
    expect(gitSyncTone({ connected: true, masterOff: true })).toBe("paused");
    expect(gitSyncTone({ connected: true, lastStatus: "error" })).toBe("attention");
    expect(gitSyncTone({ connected: true, needsReconnectAccount: true })).toBe("reconnect");
    expect(gitSyncStatusLabel("paused")).toBe("Paused by admin");
    expect(gitSyncDotClass("synced")).toContain("22C55E");
    expect(gitSyncDotClass("waiting")).toContain("3B82F6");
    expect(gitSyncDotClass("paused")).toContain("F59E0B");
    expect(gitSyncDotClass("attention")).toContain("EF4444");
  });

  it("formats short sha and relative time", () => {
    expect(shortSha("3494b97789971a2986d62019c5f8363681b040ba")).toBe("3494b97");
    expect(relativeTime(Date.now() - 120_000, Date.now())).toBe("2m ago");
  });
});
