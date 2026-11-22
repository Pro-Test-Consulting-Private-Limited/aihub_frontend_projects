import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { mapModelStatus } from "@/app/lib/map-model-status";
import {
  ModelStatusPill,
  modelStatusPresentation,
} from "@/app/components/model-status-pill";

/**
 * Component-facing assertions: shared map → ModelStatusPill presentation
 * (same values SitTestingViewV2 / Home render).
 * Label strings live only in model-status-pill.tsx; this file reads them via presentation().
 */
describe("SIT model pill / Generate from mapModelStatus + ModelStatusPill", () => {
  it("ready: Active green, generate enabled", () => {
    const m = mapModelStatus({ raw: "running" });
    expect(m.ui).toBe("ready");
    expect(m.generateDisabled).toBe(false);
    const p = modelStatusPresentation(m.ui);
    expect(p.label).toBe(modelStatusPresentation("ready").label);
    expect(p.tooltip).toBe("The AI model is ready.");
    expect(p.badgeClass).toMatch(/28A745|40,167,69/);
    const html = renderToStaticMarkup(
      React.createElement(ModelStatusPill, { status: m.ui, size: "sm" }),
    );
    expect(html).toContain(p.label);
    expect(html.includes("Model" + " \u00b7")).toBe(false);
  });

  it("warming_up: Starting amber, generate disabled", () => {
    const m = mapModelStatus({ raw: "pending" });
    expect(m.ui).toBe("warming_up");
    expect(m.generateDisabled).toBe(true);
    const p = modelStatusPresentation(m.ui);
    expect(p.label).toBe(modelStatusPresentation("warming_up").label);
    expect(p.tooltip).toMatch(/starting/i);
    expect(p.badgeClass).toMatch(/B7791F|255,193,7/);
  });

  it("inactive: Inactive red, generate disabled", () => {
    const m = mapModelStatus({ raw: "paused" });
    expect(m.ui).toBe("inactive");
    expect(m.generateDisabled).toBe(true);
    const p = modelStatusPresentation(m.ui);
    expect(p.label).toBe(modelStatusPresentation("inactive").label);
    expect(p.tooltip).toBe("The AI model is inactive. Generation is unavailable.");
    expect(p.badgeClass).toMatch(/DC3545|220,53,69/);
  });

  it("checking: Checking grey, never warming_up", () => {
    const m = mapModelStatus({ loading: true, checkingStartedAt: 0, now: 100 });
    expect(m.ui).toBe("checking");
    expect(m.generateDisabled).toBe(true);
    const p = modelStatusPresentation(m.ui);
    expect(p.label).toBe(modelStatusPresentation("checking").label);
    expect(p.tooltip).toBe("Checking the AI model status.");
    expect(p.badgeClass).toMatch(/6b7280/i);
    expect(m.ui).not.toBe("warming_up");
  });

  it("not_configured: Not configured red", () => {
    const m = mapModelStatus({ notConfigured: true });
    expect(m.ui).toBe("not_configured");
    expect(m.generateDisabled).toBe(true);
    const p = modelStatusPresentation(m.ui);
    expect(p.label).toBe(modelStatusPresentation("not_configured").label);
    expect(p.tooltip).toBe("The AI model is not configured.");
    expect(p.badgeClass).toMatch(/DC3545|220,53,69/);
  });
});

describe("Home pill from mapModelStatus + ModelStatusPill", () => {
  it("ready → Active green", () => {
    const m = mapModelStatus({ raw: "running" });
    const p = modelStatusPresentation(m.ui);
    const html = renderToStaticMarkup(
      React.createElement(ModelStatusPill, { status: m.ui }),
    );
    expect(html).toContain(p.label);
    expect(html).toMatch(/28A745/);
  });

  it("warming_up → Starting amber", () => {
    const m = mapModelStatus({ raw: "initializing" });
    const p = modelStatusPresentation(m.ui);
    const html = renderToStaticMarkup(
      React.createElement(ModelStatusPill, { status: m.ui }),
    );
    expect(html).toContain(p.label);
    expect(html).toMatch(/B7791F/);
  });

  it("inactive → Inactive red", () => {
    const m = mapModelStatus({ raw: "paused" });
    const p = modelStatusPresentation(m.ui);
    const html = renderToStaticMarkup(
      React.createElement(ModelStatusPill, { status: m.ui }),
    );
    expect(html).toContain(p.label);
    expect(html).toMatch(/DC3545/);
  });

  it("checking → Checking grey (intended Home change)", () => {
    const m = mapModelStatus({ loading: true, checkingStartedAt: 0, now: 100 });
    const p = modelStatusPresentation(m.ui);
    const html = renderToStaticMarkup(
      React.createElement(ModelStatusPill, { status: m.ui }),
    );
    expect(html).toContain(p.label);
    expect(html).toMatch(/6b7280/i);
  });
});
