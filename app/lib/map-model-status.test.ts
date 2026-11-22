import { describe, expect, it } from "vitest";
import { mapModelStatus } from "./map-model-status";

describe("mapModelStatus", () => {
  it("maps running → ready", () => {
    const m = mapModelStatus({ raw: "running" });
    expect(m.ui).toBe("ready");
    expect(m.homeLabel).toBe("Active");
    expect(m.sitLabel).toBe("Ready");
    expect(m.generateDisabled).toBe(false);
  });

  it.each(["initializing", "pending", "updating", "Initializing", "PENDING"])(
    "maps starting raw %s → warming_up",
    (raw) => {
      const m = mapModelStatus({ raw });
      expect(m.ui).toBe("warming_up");
      expect(m.homeLabel).toBe("Starting");
      expect(m.sitLabel).toBe("Warming up");
      expect(m.sitPillClass).toMatch(/92400e|#fcd34d|fffbeb/);
      expect(m.generateDisabled).toBe(true);
    },
  );

  it.each(["paused", "scaledToZero", "scaled_to_zero", "failed", "updateFailed"])(
    "maps off/error raw %s → inactive (never warming_up)",
    (raw) => {
      const m = mapModelStatus({ raw });
      expect(m.ui).toBe("inactive");
      expect(m.homeLabel).toBe("Inactive");
      expect(m.sitLabel).toBe("Inactive");
      expect(m.ui).not.toBe("warming_up");
    },
  );

  it("maps undefined/null/empty → inactive", () => {
    expect(mapModelStatus({ raw: undefined }).ui).toBe("inactive");
    expect(mapModelStatus({ raw: null }).ui).toBe("inactive");
    expect(mapModelStatus({ raw: "" }).ui).toBe("inactive");
    expect(mapModelStatus({ raw: "   " }).ui).toBe("inactive");
  });

  it("maps made-up value → inactive (never warming_up)", () => {
    const m = mapModelStatus({ raw: "totally-made-up-state" });
    expect(m.ui).toBe("inactive");
    expect(m.sitLabel).toBe("Inactive");
  });

  it("maps request error → inactive", () => {
    expect(mapModelStatus({ error: true }).ui).toBe("inactive");
    expect(mapModelStatus({ error: true, raw: "running" }).ui).toBe("inactive");
  });

  it("checking only while loading under 10s", () => {
    const t0 = 1_000_000;
    expect(
      mapModelStatus({ loading: true, checkingStartedAt: t0, now: t0 + 999 }).ui,
    ).toBe("checking");
    expect(
      mapModelStatus({ loading: true, checkingStartedAt: t0, now: t0 + 10_000 }).ui,
    ).toBe("inactive");
  });

  it("notConfigured wins", () => {
    const m = mapModelStatus({ notConfigured: true, raw: "running" });
    expect(m.ui).toBe("not_configured");
    expect(m.sitLabel).toBe("Not configured");
  });

  it("tooltips and sit labels have no em/en dash or arrow", () => {
    for (const raw of ["running", "paused", "pending", null]) {
      const m = mapModelStatus({ raw });
      expect(m.tooltip).not.toMatch(/[\u2014\u2013\u2192]/);
      expect(m.sitLabel).not.toMatch(/[\u2014\u2013\u2192]/);
    }
  });
});
