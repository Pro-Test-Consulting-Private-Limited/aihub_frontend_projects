import { describe, expect, it } from "vitest";
import { mapModelStatus } from "./map-model-status";

describe("Home ↔ SIT model status consistency", () => {
  const cases = [
    "running",
    "paused",
    "scaledToZero",
    "initializing",
    "pending",
    "updating",
    "failed",
    "unknown",
    "made-up",
    null,
    undefined,
    "",
  ] as const;

  it.each(cases)("same raw %j never contradicts Home vs SIT", (raw) => {
    const m = mapModelStatus({ raw: raw as string | null | undefined });
    if (m.homeLabel === "Inactive") {
      expect(["inactive", "checking", "not_configured"]).toContain(m.ui);
      expect(m.sitLabel).not.toBe("Ready");
      expect(m.sitLabel).not.toBe("Warming up");
    }
    if (m.homeLabel === "Active") {
      expect(m.ui).toBe("ready");
      expect(m.sitLabel).toBe("Ready");
    }
    if (m.homeLabel === "Starting") {
      expect(m.ui).toBe("warming_up");
      expect(m.sitLabel).toBe("Warming up");
    }
  });
});
