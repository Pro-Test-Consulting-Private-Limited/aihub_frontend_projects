/**
 * Mirrors backend `healthBadgeLevel` in backend/src/health.ts.
 * Keep these thresholds in sync when changing scoring.
 */
export const HEALTH_BADGE_RULES = {
  ok: {
    label: "Healthy",
    color: "#22C55E",
    summary: "No page errors, console errors, HTTP failures, broken images, or accessibility violations.",
  },
  warn: {
    label: "Needs attention",
    color: "#F59E0B",
    anyOf: [
      "consoleErrors 1-2",
      "httpErrors 1-3",
      "failedRequests 1+",
      "brokenImages 1+",
      "a11yViolations 1-10",
    ],
  },
  bad: {
    label: "Unhealthy",
    color: "#EF4444",
    anyOf: [
      "pageErrors 1+",
      "consoleErrors 3+",
      "httpErrors 4+",
      "a11yViolations 11+",
    ],
  },
} as const;

/** Web Vital bands (info only; do not change badge colour). */
export const WEB_VITAL_BANDS = {
  ttfbMs: {
    name: "TTFB (Time to First Byte)",
    meaning: "How long until the browser receives the first byte of the document response (Navigation Timing).",
    good: "≤ 800 ms",
    needsImprovement: "800-1800 ms",
    poor: "> 1800 ms",
  },
  lcpMs: {
    name: "LCP (Largest Contentful Paint)",
    meaning: "When the largest visible content element finishes painting. Proxy for when the page feels loaded.",
    good: "≤ 2500 ms",
    needsImprovement: "2500-4000 ms",
    poor: "> 4000 ms",
  },
  cls: {
    name: "CLS (Cumulative Layout Shift)",
    meaning: "How much the layout jumps while loading (unexpected shifts). Lower is more stable.",
    good: "≤ 0.1",
    needsImprovement: "0.1-0.25",
    poor: "> 0.25",
  },
} as const;

export const METRIC_HELP: Record<string, { title: string; body: string; scoring?: string }> = {
  consoleErrors: {
    title: "Console errors",
    body: "Count of console.error messages heard on this screen while recording.",
    scoring: "1-2 yellow; 3+ red.",
  },
  consoleWarnings: {
    title: "Console warnings",
    body: "Count of console.warn messages. Context only; not used for the badge.",
  },
  pageErrors: {
    title: "Page errors",
    body: "Uncaught JavaScript exceptions (pageerror). These usually break interactive behaviour.",
    scoring: "Any (1+) red.",
  },
  failedRequests: {
    title: "Failed requests",
    body: "Network requests that failed before a response (DNS, connection reset, aborted, etc.).",
    scoring: "1+ yellow (unless a red rule already applies).",
  },
  httpErrors: {
    title: "4xx / 5xx",
    body: "HTTP responses with status 400 or higher observed while on this screen.",
    scoring: "1-3 yellow; 4+ red.",
  },
  brokenImages: {
    title: "Broken images",
    body: "img elements that did not load (incomplete or naturalWidth === 0) at sample time.",
    scoring: "1+ yellow.",
  },
  ttfbMs: {
    title: WEB_VITAL_BANDS.ttfbMs.name,
    body: `${WEB_VITAL_BANDS.ttfbMs.meaning} Good ${WEB_VITAL_BANDS.ttfbMs.good}; needs improvement ${WEB_VITAL_BANDS.ttfbMs.needsImprovement}; poor ${WEB_VITAL_BANDS.ttfbMs.poor}.`,
  },
  lcpMs: {
    title: WEB_VITAL_BANDS.lcpMs.name,
    body: `${WEB_VITAL_BANDS.lcpMs.meaning} Good ${WEB_VITAL_BANDS.lcpMs.good}; needs improvement ${WEB_VITAL_BANDS.lcpMs.needsImprovement}; poor ${WEB_VITAL_BANDS.lcpMs.poor}.`,
  },
  cls: {
    title: WEB_VITAL_BANDS.cls.name,
    body: `${WEB_VITAL_BANDS.cls.meaning} Good ${WEB_VITAL_BANDS.cls.good}; needs improvement ${WEB_VITAL_BANDS.cls.needsImprovement}; poor ${WEB_VITAL_BANDS.cls.poor}.`,
  },
  a11yViolations: {
    title: "Accessibility (axe)",
    body: "axe-core violations run read-only (does not change the page). Count is nodes with issues.",
    scoring: "1-10 yellow; 11+ red.",
  },
  slowestRequestMs: {
    title: "Slowest request",
    body: "Longest observed request duration on this screen. Context for performance, not badge colour.",
  },
};

/** Glossary shown in the Health help overlay. */
export const A11Y_RULE_GUIDE: Array<{
  id: string;
  title: string;
  definition: string;
  example: string;
  fix: string;
}> = [
  {
    id: "button-name",
    title: "Button name",
    definition: "Every button must have an accessible name so screen readers can announce what it does.",
    example: "An icon-only button with no text, aria-label, or title fails this rule.",
    fix: "Add visible text, aria-label, or aria-labelledby.",
  },
  {
    id: "color-contrast",
    title: "Color contrast",
    definition: "Text and its background must meet WCAG contrast ratios so people with low vision can read it.",
    example: "Light grey text on a white card often fails (needs 4.5:1 for normal text).",
    fix: "Darken text or lighten/darken the background until contrast is high enough.",
  },
  {
    id: "label",
    title: "Form labels",
    definition: "Inputs need a programmatic label so assistive tech can describe the field.",
    example: "A date input with only a placeholder and no <label> fails.",
    fix: "Wrap with <label>, or use for/id, aria-label, or aria-labelledby.",
  },
  {
    id: "select-name",
    title: "Select name",
    definition: "A <select> must expose an accessible name like any other form control.",
    example: "A type filter dropdown with no label fails select-name.",
    fix: "Associate a visible label or set aria-label.",
  },
  {
    id: "page-has-heading-one",
    title: "Page heading",
    definition: "Pages should include one level-one heading that names the page purpose.",
    example: "A dashboard with only <h2>/<h3> and no <h1> fails.",
    fix: "Add a single <h1> (can be visually styled or sr-only if needed).",
  },
  {
    id: "image-alt",
    title: "Image alternative text",
    definition: "Images need alt text that describes the image, or empty alt when decorative.",
    example: "A product photo with no alt attribute fails.",
    fix: "Set meaningful alt, or alt=\"\" for decorative images.",
  },
];
