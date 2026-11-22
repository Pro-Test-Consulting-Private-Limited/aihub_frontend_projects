import { describe, expect, it } from "vitest";
import { mapModelStatus } from "@/app/lib/map-model-status";

/**
 * Component-facing assertions for SIT pill/Generate derived from shared mapping
 * (same values SitTestingViewV2 renders).
 */
describe("SIT model pill / Generate from mapModelStatus", () => {
  it("ready: green Ready, generate enabled", () => {
    const m = mapModelStatus({ raw: "running" });
    expect(m.sitLabel).toBe("Ready");
    expect(m.sitPillClass).toMatch(/166534|bbf7d0|f0fdf4/);
    expect(m.generateDisabled).toBe(false);
    expect(m.tooltip).toMatch(/ready/i);
  });

  it("warming_up: amber Warming up, generate disabled", () => {
    const m = mapModelStatus({ raw: "pending" });
    expect(m.sitLabel).toBe("Warming up");
    expect(m.sitPillClass).toMatch(/92400e|fcd34d|fffbeb/);
    expect(m.generateDisabled).toBe(true);
    expect(m.tooltip).toMatch(/starting/i);
  });

  it("inactive: red Inactive, generate disabled", () => {
    const m = mapModelStatus({ raw: "paused" });
    expect(m.sitLabel).toBe("Inactive");
    expect(m.sitPillClass).toMatch(/b91c1c|fecaca|fff5f5/);
    expect(m.generateDisabled).toBe(true);
    expect(m.tooltip).toBe("The AI model is inactive. Generation is unavailable.");
  });

  it("checking: grey Checking, never Warming up", () => {
    const m = mapModelStatus({ loading: true, checkingStartedAt: 0, now: 100 });
    expect(m.sitLabel).toBe("Checking");
    expect(m.ui).toBe("checking");
    expect(m.sitPillClass).toMatch(/6b7280|e5e7eb|f9fafb/);
    expect(m.generateDisabled).toBe(true);
  });

  it("not_configured: red Not configured", () => {
    const m = mapModelStatus({ notConfigured: true });
    expect(m.sitLabel).toBe("Not configured");
    expect(m.generateDisabled).toBe(true);
  });
});

describe("Home pill from mapModelStatus", () => {
  it("ready → Active green", () => {
    const m = mapModelStatus({ raw: "running" });
    expect(m.homeLabel).toBe("Active");
    expect(m.homeDotClass).toMatch(/28A745/);
  });

  it("warming_up → Starting amber", () => {
    const m = mapModelStatus({ raw: "initializing" });
    expect(m.homeLabel).toBe("Starting");
    expect(m.homeDotClass).toMatch(/B7791F/);
  });

  it("inactive → Inactive red", () => {
    const m = mapModelStatus({ raw: "paused" });
    expect(m.homeLabel).toBe("Inactive");
    expect(m.homeDotClass).toMatch(/DC3545/);
  });
});
