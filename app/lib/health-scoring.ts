/**
 * Mirrors backend `healthBadgeLevel` in backend/src/health.ts.
 * Keep these thresholds in sync when changing scoring.
 */
export const HEALTH_BADGE_RULES = {
  /** Green — none of the warn/bad conditions. */
  ok: {
    label: "Healthy (green)",
    color: "#22C55E",
    summary: "No page errors, console errors, HTTP failures, broken images, or accessibility violations.",
  },
  /** Yellow — at least one mild issue. */
  warn: {
    label: "Needs attention (yellow)",
    color: "#F59E0B",
    anyOf: [
      "consoleErrors ≥ 1 (and ≤ 2)",
      "httpErrors ≥ 1 (and ≤ 3)",
      "failedRequests ≥ 1",
      "brokenImages ≥ 1",
      "a11yViolations ≥ 1 (and ≤ 10)",
    ],
  },
  /** Red — serious failure signals. */
  bad: {
    label: "Unhealthy (red)",
    color: "#EF4444",
    anyOf: [
      "pageErrors ≥ 1 (uncaught exception)",
      "consoleErrors ≥ 3",
      "httpErrors ≥ 4",
      "a11yViolations ≥ 11",
    ],
  },
} as const;

/** Informational Web Vital bands (do not change the badge colour today). */
export const WEB_VITAL_BANDS = {
  ttfbMs: {
    name: "TTFB — Time to First Byte",
    meaning: "How long until the browser receives the first byte of the document response (Navigation Timing).",
    good: "≤ 800 ms",
    needsImprovement: "800–1800 ms",
    poor: "> 1800 ms",
  },
  lcpMs: {
    name: "LCP — Largest Contentful Paint",
    meaning: "When the largest visible content element finishes painting. Proxy for “page feels loaded”.",
    good: "≤ 2500 ms",
    needsImprovement: "2500–4000 ms",
    poor: "> 4000 ms",
  },
  cls: {
    name: "CLS — Cumulative Layout Shift",
    meaning: "How much the layout jumps while loading (unexpected shifts). Lower is more stable.",
    good: "≤ 0.1",
    needsImprovement: "0.1–0.25",
    poor: "> 0.25",
  },
} as const;

export const METRIC_HELP: Record<string, { title: string; body: string; scoring?: string }> = {
  consoleErrors: {
    title: "Console errors",
    body: "Count of console.error messages heard on this screen while recording (Playwright console listener).",
    scoring: "1–2 → yellow; ≥3 → red.",
  },
  consoleWarnings: {
    title: "Console warnings",
    body: "Count of console.warn messages. Shown for context; they do not change the green/yellow/red badge.",
  },
  pageErrors: {
    title: "Page errors",
    body: "Uncaught JavaScript exceptions (pageerror). These usually break interactive behaviour.",
    scoring: "Any (≥1) → red.",
  },
  failedRequests: {
    title: "Failed requests",
    body: "Network requests that failed before a response (DNS, connection reset, aborted, etc.).",
    scoring: "≥1 → yellow (unless a red rule already applies).",
  },
  httpErrors: {
    title: "4xx / 5xx",
    body: "HTTP responses with status ≥ 400 observed while on this screen.",
    scoring: "1–3 → yellow; ≥4 → red.",
  },
  brokenImages: {
    title: "Broken images",
    body: "img elements that did not load (incomplete or naturalWidth === 0) at sample time.",
    scoring: "≥1 → yellow.",
  },
  ttfbMs: {
    title: WEB_VITAL_BANDS.ttfbMs.name,
    body: WEB_VITAL_BANDS.ttfbMs.meaning + ` Bands: good ${WEB_VITAL_BANDS.ttfbMs.good}; needs improvement ${WEB_VITAL_BANDS.ttfbMs.needsImprovement}; poor ${WEB_VITAL_BANDS.ttfbMs.poor}.`,
    scoring: "Informational only — does not change the badge colour.",
  },
  lcpMs: {
    title: WEB_VITAL_BANDS.lcpMs.name,
    body: WEB_VITAL_BANDS.lcpMs.meaning + ` Bands: good ${WEB_VITAL_BANDS.lcpMs.good}; needs improvement ${WEB_VITAL_BANDS.lcpMs.needsImprovement}; poor ${WEB_VITAL_BANDS.lcpMs.poor}.`,
    scoring: "Informational only — does not change the badge colour.",
  },
  cls: {
    title: WEB_VITAL_BANDS.cls.name,
    body: WEB_VITAL_BANDS.cls.meaning + ` Bands: good ${WEB_VITAL_BANDS.cls.good}; needs improvement ${WEB_VITAL_BANDS.cls.needsImprovement}; poor ${WEB_VITAL_BANDS.cls.poor}.`,
    scoring: "Informational only — does not change the badge colour.",
  },
  a11yViolations: {
    title: "Accessibility (axe)",
    body: "axe-core violations run read-only in an isolated world (does not change the page). Count is nodes with issues.",
    scoring: "1–10 → yellow; ≥11 → red.",
  },
  slowestRequestMs: {
    title: "Slowest request",
    body: "Longest observed request duration on this screen (from Playwright request timing). Context for performance, not badge colour.",
  },
};
