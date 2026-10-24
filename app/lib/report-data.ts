// Hardcoded report figures for the Reports tab (Digital Wallet, Jira project DW). Everything derives from the Coverage
// tickets so the Coverage and Reports tabs always agree. Sprint history and the failing-test list are SAMPLE data.
import { COVERAGE_EPICS } from "./coverage-tickets";
import { SECURITY_CATEGORIES } from "./security-checklist";

export const SPRINTS = ["S9", "S10", "S11", "S12", "S13", "S14", "S15"] as const;
export const CURRENT_SPRINT = "Sprint 15";

export const TICKETS = COVERAGE_EPICS.flatMap((e) => e.tickets.map((t) => ({ ...t, epicKey: e.key, epicName: e.name })));

const avg = (xs: number[]) => xs.reduce((n, x) => n + x, 0) / xs.length;
const clamp = (n: number) => Math.max(0, Math.min(100, n));

export const SECURITY_TOTALS = {
  total: SECURITY_CATEGORIES.reduce((n, c) => n + c.automated + c.guided, 0),
  automated: SECURITY_CATEGORIES.reduce((n, c) => n + c.automated, 0),
  guided: SECURITY_CATEGORIES.reduce((n, c) => n + c.guided, 0),
  verified: 0,
};

export const API_TOTALS = { modules: 8, endpoints: 25 };

export type Band = "good" | "partial" | "low";
export const bandOf = (c: number): Band => (c >= 80 ? "good" : c >= 40 ? "partial" : "low");

export function summarize() {
  const tests = TICKETS.reduce((n, t) => n + t.tests, 0);
  const passed = TICKETS.reduce((n, t) => n + t.passed, 0);
  const coverage = Math.round(avg(TICKETS.map((t) => t.coverage)));
  const quality = Math.round(avg(TICKETS.map((t) => t.quality)));
  const passRate = Math.round((passed / tests) * 100);
  // Readiness: pass rate 40%, coverage 30%, quality 30%. 80+ ready, 60-79 at risk, below 60 not ready.
  const readiness = Math.round(passRate * 0.4 + coverage * 0.3 + quality * 0.3);
  const state = readiness >= 80 ? "Ready" : readiness >= 60 ? "At risk" : "Not ready";
  return { tests, passed, failed: tests - passed, coverage, quality, passRate, readiness, state };
}

export type FailingTest = { kind: "functional" | "edge" | "security" | "perf"; name: string; ticket: string; screen: string };
export const FAILING_TESTS: FailingTest[] = [
  { kind: "functional", name: "Expired OTP is rejected on password reset", ticket: "DW-8", screen: "Forgot password" },
  { kind: "edge", name: "Sending money to your own number is blocked", ticket: "DW-15", screen: "Send money" },
  { kind: "edge", name: "Insufficient balance shows a clear error", ticket: "DW-15", screen: "Send money" },
  { kind: "functional", name: "Failed Razorpay payment leaves the balance unchanged", ticket: "DW-13", screen: "Add money" },
  { kind: "security", name: "Approving KYC requires the admin role", ticket: "DW-16", screen: "KYC approvals" },
  { kind: "perf", name: "Transaction history loads under 2 seconds with 1,000 rows", ticket: "DW-14", screen: "Transactions" },
];

// Offsets from the current value, oldest sprint first, so every series ends on the figure the Coverage tab shows.
const COVERAGE_DELTAS: Record<string, number[]> = {
  "DW-1": [-13, -10, -8, -5, -3, -1, 0],
  "DW-2": [-9, -8, -6, -5, -3, -2, 0],
  "DW-3": [-12, -10, -7, -5, -4, -2, 0],
  "DW-4": [-8, -8, -6, -4, -3, -1, 0],
};
const QUALITY_DELTAS: Record<string, number[]> = {
  "DW-1": [-11, -9, -6, -5, -3, -1, 0],
  "DW-2": [-8, -7, -5, -4, -3, -1, 0],
  "DW-3": [-10, -8, -7, -4, -3, -2, 0],
  "DW-4": [-9, -7, -6, -4, -2, -1, 0],
};

export type EpicTrend = { key: string; name: string; coverage: number[]; quality: number[]; tickets: number };

export const EPIC_TRENDS: EpicTrend[] = COVERAGE_EPICS.map((e) => {
  const cov = avg(e.tickets.map((t) => t.coverage));
  const q = avg(e.tickets.map((t) => t.quality));
  return {
    key: e.key,
    name: e.name,
    tickets: e.tickets.length,
    coverage: COVERAGE_DELTAS[e.key]!.map((d) => clamp(cov + d)),
    quality: QUALITY_DELTAS[e.key]!.map((d) => clamp(q + d)),
  };
});

/** Ticket-weighted project-wide series, one value per sprint. */
export function projectTrend(field: "coverage" | "quality") {
  const total = EPIC_TRENDS.reduce((n, e) => n + e.tickets, 0);
  return SPRINTS.map((_, i) => Math.round(EPIC_TRENDS.reduce((n, e) => n + e[field][i]! * e.tickets, 0) / total));
}

export function buildMarkdown(date: string) {
  const s = summarize();
  const lines = [
    `# Quality & Readiness Report`,
    ``,
    `Pro-Test Digital Wallet · ${CURRENT_SPRINT} · generated ${date}`,
    ``,
    `| Metric | Value |`,
    `| --- | --- |`,
    `| Readiness | ${s.readiness}% (${s.state}) |`,
    `| Average test coverage | ${s.coverage}% |`,
    `| Tests passing | ${s.passed}/${s.tests} (${s.failed} failing) |`,
    `| Average quality score | ${s.quality}/100 |`,
    `| API endpoints | ${API_TOTALS.endpoints} across ${API_TOTALS.modules} modules |`,
    `| Security checks verified | ${SECURITY_TOTALS.verified}/${SECURITY_TOTALS.total} |`,
    ``,
    `## Coverage by Jira ticket`,
    ``,
    `| Epic | Ticket | Tests | Passed | Coverage | Quality |`,
    `| --- | --- | --- | --- | --- | --- |`,
    ...TICKETS.map((t) => `| ${t.epicKey} ${t.epicName} | ${t.key} ${t.name} | ${t.tests} | ${t.passed} | ${t.coverage}% | ${t.quality}/100 |`),
    ``,
    `## Failing tests (highest impact)`,
    ``,
    ...FAILING_TESTS.map((f) => `- [${f.kind}] ${f.name} (${f.ticket}, ${f.screen})`),
    ``,
    `_Figures are sample data until the tickets are tested._`,
    ``,
  ];
  return lines.join("\n");
}
