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
    meaning:
      "When the largest visible content element finishes painting. Proxy for when the page feels loaded. Often null on SPA soft navigations or short dwell times because Chromium may not emit an LCP entry before you leave the screen. Context only; not needed for the green/yellow/red badge.",
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
    body:
      "Count of console.warn messages (plus demoted browser noise such as missing resources). Context only; does not change the badge. Open the card notes or guide for sample texts when captured.",
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
    body: WEB_VITAL_BANDS.lcpMs.meaning,
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

/** Glossary shown in the Health help overlay and issue popups. */
export const A11Y_RULE_GUIDE: Array<{
  id: string;
  title: string;
  /** WCAG criterion id when applicable, e.g. 1.4.3 */
  wcagId?: string;
  /** Full criterion name */
  wcagName?: string;
  /** WCAG level A / AA / AAA */
  wcagLevel?: string;
  definition: string;
  /** What is typically missing or wrong when this fails */
  missing: string;
  example: string;
  fix: string;
}> = [
  {
    id: "button-name",
    title: "Button name",
    wcagId: "4.1.2",
    wcagName: "Name, Role, Value",
    wcagLevel: "A",
    definition:
      "WCAG (Web Content Accessibility Guidelines) 4.1.2 requires every UI control to expose an accessible name so assistive tech can announce what it does.",
    missing: "No visible text, aria-label, aria-labelledby, or title that names the button.",
    example: "An icon-only button with no text or aria-label fails this rule.",
    fix: "Add visible text, aria-label, or aria-labelledby.",
  },
  {
    id: "color-contrast",
    title: "Color contrast",
    wcagId: "1.4.3",
    wcagName: "Contrast (Minimum)",
    wcagLevel: "AA",
    definition:
      "WCAG (Web Content Accessibility Guidelines) 1.4.3 Contrast (Minimum) requires text and its background to meet a contrast ratio so people with low vision can read it.",
    missing:
      "Foreground/background contrast below 4.5:1 for normal text (or 3:1 for large text ≥18pt / 14pt bold).",
    example: "Light green amount text (#0F9D58) on white often measures ~3.5:1 and fails AA.",
    fix: "Darken the text or adjust the background until the ratio is high enough (e.g. use a deeper green).",
  },
  {
    id: "label",
    title: "Form labels",
    wcagId: "1.3.1",
    wcagName: "Info and Relationships",
    wcagLevel: "A",
    definition:
      "WCAG (Web Content Accessibility Guidelines) 1.3.1 / 3.3.2 require form fields to have a programmatic label.",
    missing: "No <label for>, wrapping <label>, aria-label, or aria-labelledby on the control.",
    example: "A date input with only a placeholder and no label fails.",
    fix: "Wrap with <label>, or use for/id, aria-label, or aria-labelledby.",
  },
  {
    id: "select-name",
    title: "Select name",
    wcagId: "4.1.2",
    wcagName: "Name, Role, Value",
    wcagLevel: "A",
    definition:
      "WCAG (Web Content Accessibility Guidelines) 4.1.2 requires a <select> to expose an accessible name like any other form control.",
    missing: "No associated label or aria-label on the select.",
    example: "A type filter dropdown with no label fails select-name.",
    fix: "Associate a visible label or set aria-label.",
  },
  {
    id: "page-has-heading-one",
    title: "Page heading",
    wcagId: "1.3.1",
    wcagName: "Info and Relationships",
    wcagLevel: "A",
    definition:
      "Best practice (and axe rule page-has-heading-one): pages should include one level-one heading that names the page purpose. Related to WCAG (Web Content Accessibility Guidelines) information structure.",
    missing: "No <h1> in the document.",
    example: "A dashboard with only <h2>/<h3> and no <h1> fails.",
    fix: "Add a single <h1> (can be visually styled or sr-only if needed).",
  },
  {
    id: "image-alt",
    title: "Image alternative text",
    wcagId: "1.1.1",
    wcagName: "Non-text Content",
    wcagLevel: "A",
    definition:
      "WCAG (Web Content Accessibility Guidelines) 1.1.1 Non-text Content requires images to have text alternatives.",
    missing: "No alt attribute (or empty alt when the image is not decorative).",
    example: "A product photo with no alt attribute fails.",
    fix: "Set meaningful alt, or alt=\"\" for decorative images.",
  },
];
