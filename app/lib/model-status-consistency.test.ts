import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { mapModelStatus } from "./map-model-status";
import { ModelStatusPill } from "@/app/components/model-status-pill";

/**
 * Round 8 consistency: Home and SIT both render the real shared ModelStatusPill
 * for the same mocked raw status → identical text and classes.
 */
describe("Home ↔ SIT model status consistency (shared ModelStatusPill)", () => {
  const rawCases = [
    "running",
    "initializing",
    "pending",
    "updating",
    "paused",
    "scaledToZero",
    "failed",
    "unknown",
    "",
  ] as const;

  it.each(rawCases)("raw %j → identical Home and SIT pill markup", (raw) => {
    const m = mapModelStatus({ raw });
    const homeHtml = renderToStaticMarkup(
      React.createElement(ModelStatusPill, {
        status: m.ui,
        testId: "home-ai-model-pill",
      }),
    );
    const sitHtml = renderToStaticMarkup(
      React.createElement(ModelStatusPill, {
        status: m.ui,
        testId: "sit-model-status-pill",
      }),
    );
    const strip = (html: string) =>
      html
        .replace(/data-testid="[^"]*"/g, "")
        .replace(/\s+/g, " ")
        .trim();
    expect(strip(homeHtml)).toBe(strip(sitHtml));
    expect(homeHtml).toMatch(/AI Model /);
    expect(homeHtml.includes("Model" + " \u00b7")).toBe(false);
  });

  it("error / loading / empty map to the same pill label/color in Home and SIT", () => {
    const cases = [
      mapModelStatus({ error: true }),
      mapModelStatus({ loading: true, checkingStartedAt: 0, now: 100 }),
      mapModelStatus({ raw: null }),
      mapModelStatus({ raw: undefined }),
    ];
    for (const m of cases) {
      const a = renderToStaticMarkup(
        React.createElement(ModelStatusPill, { status: m.ui }),
      );
      const b = renderToStaticMarkup(
        React.createElement(ModelStatusPill, { status: m.ui, size: "sm" }),
      );
      const label = (html: string) => html.match(/AI Model [^<]+/)?.[0];
      const title = (html: string) => html.match(/title="([^"]*)"/)?.[1];
      const colorBits = (html: string) =>
        (
          html.match(
            /bg-\[[^\]]+\]|text-\[#(?:28A745|B7791F|DC3545|6b7280)\]/g,
          ) || []
        )
          .sort()
          .join("|");
      expect(label(a)).toBe(label(b));
      expect(title(a)).toBe(title(b));
      expect(colorBits(a)).toBe(colorBits(b));
    }
  });
});
