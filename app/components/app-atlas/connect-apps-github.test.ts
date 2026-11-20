import { describe, expect, it } from "vitest";
import { INTEGRATION_CATEGORIES, listIntegrationProviders } from "@/app/lib/integrations-registry";
import { gitSyncTone, repoNameOnly } from "@/app/lib/git-sync-ui";

describe("connect apps github polish", () => {
  it("modal categories match Integrations registry titles", () => {
    expect(INTEGRATION_CATEGORIES.some((c) => /SOURCE CODE MANAGEMENT/i.test(c.title))).toBe(true);
    expect(listIntegrationProviders().length).toBeGreaterThanOrEqual(12);
  });

  it("pill label uses repo name only", () => {
    const full = "Pro-Test-Consulting-Private-Limited/appatlas-data";
    expect(`GitHub · ${repoNameOnly(full)}`).toBe("GitHub · appatlas-data");
  });

  it("panel status tones cover synced waiting syncing paused attention reconnect", () => {
    expect(gitSyncTone({ connected: true, lastStatus: "nothing_to_commit" })).toBe("synced");
    expect(gitSyncTone({ connected: true, dirty: true })).toBe("waiting");
    expect(gitSyncTone({ connected: true, syncing: true })).toBe("syncing");
    expect(gitSyncTone({ connected: true, lastStatus: "paused_master_off" })).toBe("paused");
    expect(gitSyncTone({ connected: true, lastError: "boom" })).toBe("attention");
    expect(gitSyncTone({ connected: true, lastStatus: "needs_connect" })).toBe("reconnect");
  });
});
