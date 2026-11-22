import { describe, expect, it } from "vitest";
import {
  SIT_DEFAULT_WIDTHS,
  SIT_FIT_MIN_WIDTHS,
  SIT_MIN_WIDTHS,
  fitColumnWidthsToContainer,
  sumColumnWidths,
} from "./sit-v2-prefs";

const VISIBLE = [
  "id",
  "module",
  "feature",
  "prioSev",
  "scenario",
  "preconditions",
  "steps",
  "expected",
  "status",
] as const;

describe("R8-01 fitColumnWidthsToContainer", () => {
  it("keeps defaults when container is wide enough", () => {
    const preferred = { ...SIT_DEFAULT_WIDTHS };
    const total = sumColumnWidths(preferred, VISIBLE);
    const fitted = fitColumnWidthsToContainer(preferred, VISIBLE, total + 200);
    for (const id of VISIBLE) {
      expect(fitted[id]).toBe(preferred[id]);
    }
  });

  it("shrinks proportionally toward fit mins when container is narrower than defaults", () => {
    const preferred = { ...SIT_DEFAULT_WIDTHS };
    const defaultTotal = sumColumnWidths(preferred, VISIBLE);
    const minTotal = sumColumnWidths(SIT_FIT_MIN_WIDTHS, VISIBLE);
    // Pick a width strictly between mins and defaults so proportional shrink applies.
    const available = Math.floor((defaultTotal + minTotal) / 2);
    expect(available).toBeGreaterThan(minTotal);
    expect(available).toBeLessThan(defaultTotal);
    const fitted = fitColumnWidthsToContainer(preferred, VISIBLE, available);
    const fittedTotal = sumColumnWidths(fitted, VISIBLE);
    expect(fittedTotal).toBeLessThanOrEqual(available + 2);
    expect(fittedTotal).toBeGreaterThanOrEqual(minTotal - 1);
    // Status stays at least the fit min and should remain readable (>= 110)
    expect(fitted.status).toBeGreaterThanOrEqual(SIT_FIT_MIN_WIDTHS.status);
    expect(fitted.status).toBeLessThanOrEqual(preferred.status);
  });

  it("does not shrink below fit mins; total may exceed available (horizontal scroll)", () => {
    const preferred = { ...SIT_DEFAULT_WIDTHS };
    const minTotal = sumColumnWidths(SIT_FIT_MIN_WIDTHS, VISIBLE);
    const fitted = fitColumnWidthsToContainer(preferred, VISIBLE, minTotal - 80);
    for (const id of VISIBLE) {
      expect(fitted[id]).toBeGreaterThanOrEqual(SIT_FIT_MIN_WIDTHS[id] ?? SIT_MIN_WIDTHS[id] ?? 0);
    }
    expect(sumColumnWidths(fitted, VISIBLE)).toBeGreaterThanOrEqual(minTotal - 1);
  });

  it("preserves a user-resized column width when it already equals preferred (wins)", () => {
    const preferred = { ...SIT_DEFAULT_WIDTHS, steps: 500 };
    const available = sumColumnWidths(SIT_DEFAULT_WIDTHS, VISIBLE) - 100;
    const fitted = fitColumnWidthsToContainer(preferred, VISIBLE, available, {
      userResized: new Set(["steps"]),
    });
    // User-resized column is not auto-shrunk below their chosen width until mins force it
    expect(fitted.steps).toBe(500);
  });

  it("is idempotent for the same inputs", () => {
    const preferred = { ...SIT_DEFAULT_WIDTHS };
    const available = 1200;
    const a = fitColumnWidthsToContainer(preferred, VISIBLE, available);
    const b = fitColumnWidthsToContainer(a, VISIBLE, available);
    expect(b).toEqual(a);
  });
});
