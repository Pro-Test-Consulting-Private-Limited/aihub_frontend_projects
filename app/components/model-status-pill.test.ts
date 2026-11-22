import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ModelStatusPill,
  modelStatusPresentation,
  type ModelStatusPillStatus,
} from "./model-status-pill";

const CASES: Array<{
  status: ModelStatusPillStatus;
  label: string;
  tooltip: string;
  badge: RegExp;
  dot: RegExp;
}> = [
  {
    status: "ready",
    label: "AI Model Active",
    tooltip: "The AI model is ready.",
    badge: /28A745|40,167,69/,
    dot: /28A745/,
  },
  {
    status: "warming_up",
    label: "AI Model Starting",
    tooltip: "The AI model is starting. Try again in a moment.",
    badge: /B7791F|255,193,7/,
    dot: /B7791F/,
  },
  {
    status: "inactive",
    label: "AI Model Inactive",
    tooltip: "The AI model is inactive. Generation is unavailable.",
    badge: /DC3545|220,53,69/,
    dot: /DC3545/,
  },
  {
    status: "checking",
    label: "AI Model Checking",
    tooltip: "Checking the AI model status.",
    badge: /6b7280|9ca3af|e5e7eb|f3f4f6/i,
    dot: /6b7280|9ca3af/i,
  },
  {
    status: "not_configured",
    label: "AI Model Not configured",
    tooltip: "The AI model is not configured.",
    badge: /DC3545|220,53,69/,
    dot: /DC3545/,
  },
];

describe("ModelStatusPill", () => {
  it.each(CASES)("$status renders exact label, color class and tooltip", (c) => {
    const html = renderToStaticMarkup(
      React.createElement(ModelStatusPill, { status: c.status }),
    );
    expect(html).toContain(c.label);
    expect(html).toContain(`title="${c.tooltip}"`);
    expect(html).toMatch(c.badge);
    expect(html).toMatch(c.dot);
    expect(html.includes("Model" + " \u00b7")).toBe(false);
    expect(html).not.toMatch(/[\u2014\u2013\u2192]/);

    const p = modelStatusPresentation(c.status);
    expect(p.label).toBe(c.label);
    expect(p.tooltip).toBe(c.tooltip);
  });
});
