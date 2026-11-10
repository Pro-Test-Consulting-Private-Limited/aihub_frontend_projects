"use client";

import { useMemo, useState } from "react";
import type { A11yIssue, CanvasNode, SessionHealthSummary } from "@/app/interfaces/appatlas";
import { HEALTH_BADGE_RULES, METRIC_HELP, WEB_VITAL_BANDS } from "@/app/lib/health-scoring";
import { atlasUrl } from "@/app/services/appatlas";

type MetricKey = keyof typeof METRIC_HELP;

export function HealthPanel({ node }: { node: CanvasNode }) {
  const h = node.health;
  const [openIssue, setOpenIssue] = useState<string | null>(null);

  const metrics = useMemo(() => (h ? buildMetrics(h) : []), [h]);
  const a11yIssues = useMemo((): A11yIssue[] => {
    if (!h) return [];
    if (h.a11yIssues?.length) return h.a11yIssues;
    return (h.a11ySummary || []).map((line): A11yIssue => {
      const idx = line.indexOf(":");
      return {
        id: idx > 0 ? line.slice(0, idx).trim() : "a11y",
        help: idx > 0 ? line.slice(idx + 1).trim() : line,
        impact: null,
        nodes: 1,
      };
    });
  }, [h]);

  if (!h) {
    return <div className="p-4 text-[13px] text-[#7E7E7E]">No health data captured for this screen yet.</div>;
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2">
        <LevelDot level={h.level} />
        <span className="text-[13px] font-medium text-[#1F1F1F] dark:text-[#ededed]">
          {node.path} · {h.level === "ok" ? "Healthy" : h.level === "warn" ? "Needs attention" : "Unhealthy"}
        </span>
      </div>

      <ScoringLegend level={h.level} />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {metrics.map((m) => (
          <MetricCard key={m.key} metric={m} />
        ))}
      </div>

      {a11yIssues.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">Accessibility</div>
              <p className="text-[12px] text-[#6B7280]">
                {h.a11yViolations} failing node{h.a11yViolations === 1 ? "" : "s"} across {a11yIssues.length} rule
                {a11yIssues.length === 1 ? "" : "s"}. Open a card for the crop and fix hint.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {a11yIssues.map((issue, i) => {
              const key = `${issue.id}-${i}`;
              const expanded = openIssue === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setOpenIssue(expanded ? null : key)}
                  className="w-full rounded-[10px] border border-[#E5E7EB] bg-white text-left transition hover:border-[#C7D2FE] dark:border-[#2a2a2a] dark:bg-[#141414]"
                >
                  <div className="flex gap-3 p-2.5">
                    <A11yThumb issue={issue} screenShot={node.screenshotUrl} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded bg-[#EEF2FF] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#4338CA] dark:bg-[#1e1b4b] dark:text-[#c7d2fe]">
                          {issue.id}
                        </span>
                        {issue.impact && <ImpactPill impact={issue.impact} />}
                        <span className="text-[10px] text-[#9ca3af]">
                          {issue.nodes} node{issue.nodes === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="mt-1 text-[12px] font-medium text-[#1F1F1F] dark:text-[#ededed]">{issue.help}</div>
                      {expanded && (
                        <div className="mt-2 space-y-2 text-[11px] leading-relaxed text-[#4B5563] dark:text-[#d1d5db]">
                          {issue.failureSummary && <p>{issue.failureSummary}</p>}
                          {issue.target && (
                            <p className="truncate font-mono text-[10px] text-[#6B7280]" title={issue.target}>
                              target: {issue.target}
                            </p>
                          )}
                          <p>{a11yFixHint(issue.id)}</p>
                          {(issue.screenshotUrl || node.screenshotUrl) && (
                            <div className="overflow-hidden rounded-md border border-[#E5E7EB] dark:border-[#333]">
                              <img
                                src={atlasUrl(issue.screenshotUrl || node.screenshotUrl)}
                                alt={`${issue.id} example`}
                                className="max-h-40 w-full object-cover object-top"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {h.slowestRequestUrl && h.slowestRequestMs != null && (
        <div className="truncate text-[11px] text-[#7E7E7E]" title={h.slowestRequestUrl}>
          Slowest URL ({h.slowestRequestMs} ms): {h.slowestRequestUrl}
        </div>
      )}
    </div>
  );
}

function ScoringLegend({ level }: { level: SessionHealthSummary["level"] }) {
  return (
    <div className="rounded-[10px] border border-[#E5E7EB] bg-[#FAFAFA] p-3 dark:border-[#2a2a2a] dark:bg-[#141414]">
      <div className="mb-2 text-[12px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">How scoring works</div>
      <p className="mb-2 text-[11px] leading-relaxed text-[#4B5563] dark:text-[#d1d5db]">
        Badge colour comes from error / HTTP / image / accessibility counts on this screen. TTFB, LCP, and CLS are
        informational and do not change green / yellow / red.
      </p>
      <div className="space-y-1.5">
        {(["ok", "warn", "bad"] as const).map((key) => {
          const rule = HEALTH_BADGE_RULES[key];
          const active = level === key;
          return (
            <div
              key={key}
              className={`rounded-md px-2 py-1.5 text-[11px] leading-snug ${
                active ? "bg-white ring-1 ring-[#C7D2FE] dark:bg-[#0f0f0f] dark:ring-[#4338ca]" : ""
              }`}
            >
              <div className="mb-0.5 flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: rule.color }} />
                <span className="font-medium text-[#1F1F1F] dark:text-[#ededed]">{rule.label}</span>
                {active && <span className="text-[9px] uppercase tracking-wide text-[#6366F1]">this screen</span>}
              </div>
              {"summary" in rule ? (
                <p className="text-[#4B5563] dark:text-[#d1d5db]">{rule.summary}</p>
              ) : (
                <p className="text-[#4B5563] dark:text-[#d1d5db]">{rule.anyOf.join(" · ")}</p>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 border-t border-[#E5E7EB] pt-2 text-[11px] leading-relaxed text-[#4B5563] dark:border-[#2a2a2a] dark:text-[#d1d5db]">
        <div className="mb-1 font-medium text-[#1F1F1F] dark:text-[#ededed]">Web Vitals bands</div>
        {Object.values(WEB_VITAL_BANDS).map((v) => (
          <p key={v.name} className="mb-1 last:mb-0">
            <span className="font-medium">{v.name}</span>: good {v.good}; needs improvement {v.needsImprovement}; poor{" "}
            {v.poor}.
          </p>
        ))}
      </div>
    </div>
  );
}

type BuiltMetric = {
  key: MetricKey;
  label: string;
  display: string;
  tone: "neutral" | "ok" | "warn" | "bad" | "info";
  body: string;
  scoring?: string;
};

function buildMetrics(h: SessionHealthSummary): BuiltMetric[] {
  const rows: Array<BuiltMetric | null> = [
    countMetric("consoleErrors", "Console errors", h.consoleErrors, {
      warnAt: 1,
      badAt: 3,
    }),
    countMetric("consoleWarnings", "Console warnings", h.consoleWarnings, { infoOnly: true }),
    countMetric("pageErrors", "Page errors", h.pageErrors, { badAt: 1 }),
    countMetric("failedRequests", "Failed requests", h.failedRequests, { warnAt: 1 }),
    countMetric("httpErrors", "4xx / 5xx", h.httpErrors, { warnAt: 1, badAt: 4 }),
    countMetric("brokenImages", "Broken images", h.brokenImages, { warnAt: 1 }),
    vitalMetric("ttfbMs", "TTFB", h.ttfbMs, (v) => `${Math.round(v)} ms`, WEB_VITAL_BANDS.ttfbMs),
    vitalMetric("lcpMs", "LCP", h.lcpMs, (v) => `${Math.round(v)} ms`, WEB_VITAL_BANDS.lcpMs),
    vitalMetric("cls", "CLS", h.cls, (v) => String(v), WEB_VITAL_BANDS.cls),
    countMetric("a11yViolations", "Accessibility", h.a11yViolations, { warnAt: 1, badAt: 11 }),
    h.slowestRequestMs != null
      ? {
          key: "slowestRequestMs",
          label: "Slowest request",
          display: `${h.slowestRequestMs} ms`,
          tone: "info",
          body: METRIC_HELP.slowestRequestMs.body,
        }
      : null,
  ];
  return rows.filter((r): r is BuiltMetric => r != null);
}

function countMetric(
  key: MetricKey,
  label: string,
  value: number,
  opts: { warnAt?: number; badAt?: number; infoOnly?: boolean },
): BuiltMetric {
  const help = METRIC_HELP[key];
  let tone: BuiltMetric["tone"] = "ok";
  if (opts.infoOnly) tone = value > 0 ? "info" : "ok";
  else if (opts.badAt != null && value >= opts.badAt) tone = "bad";
  else if (opts.warnAt != null && value >= opts.warnAt) tone = "warn";
  return {
    key,
    label,
    display: String(value),
    tone,
    body: help.body,
    scoring: help.scoring,
  };
}

function vitalMetric(
  key: MetricKey,
  label: string,
  value: number | null | undefined,
  fmt: (v: number) => string,
  bands: { good: string; needsImprovement: string; poor: string; meaning: string },
): BuiltMetric | null {
  if (value == null) {
    return {
      key,
      label,
      display: "Not measured",
      tone: "neutral",
      body: `${bands.meaning} This visit did not report a value (common for LCP on quick navigations or SPA transitions).`,
      scoring: "Informational only — does not change the badge colour.",
    };
  }
  const help = METRIC_HELP[key];
  return {
    key,
    label,
    display: fmt(value),
    tone: "info",
    body: help.body,
    scoring: help.scoring,
  };
}

function MetricCard({ metric }: { metric: BuiltMetric }) {
  const border =
    metric.tone === "bad"
      ? "border-[#FECACA] bg-[#FEF2F2]"
      : metric.tone === "warn"
        ? "border-[#FDE68A] bg-[#FFFBEB]"
        : metric.tone === "ok"
          ? "border-[#BBF7D0] bg-[#F0FDF4]"
          : "border-[#E5E7EB] bg-white dark:border-[#2a2a2a] dark:bg-[#141414]";
  return (
    <div className={`rounded-[10px] border px-2.5 py-2 ${border}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[#6B7280]">{metric.label}</div>
      <div className="text-[16px] font-semibold text-[#111827] dark:text-[#ededed]">{metric.display}</div>
      <p className="mt-1 text-[11px] leading-snug text-[#4B5563] dark:text-[#d1d5db]">{metric.body}</p>
      {metric.scoring && <p className="mt-1 text-[10px] font-medium text-[#6366F1]">{metric.scoring}</p>}
    </div>
  );
}

function A11yThumb({ issue, screenShot }: { issue: A11yIssue; screenShot: string }) {
  const src = issue.screenshotUrl || screenShot;
  return (
    <div className="relative h-14 w-16 shrink-0 overflow-hidden rounded-md border border-[#E5E7EB] bg-[#F3F4F6] dark:border-[#333] dark:bg-[#1a1a1a]">
      {src ? (
        <img src={atlasUrl(src)} alt="" className="h-full w-full object-cover object-top" />
      ) : (
        <div className="flex h-full items-center justify-center text-[10px] text-[#9ca3af]">a11y</div>
      )}
      <span className="absolute bottom-0.5 left-0.5 rounded bg-black/60 px-1 text-[8px] text-white">{issue.id.split("-")[0]}</span>
    </div>
  );
}

function ImpactPill({ impact }: { impact: string }) {
  const c =
    impact === "critical" || impact === "serious"
      ? "bg-[#FEE2E2] text-[#B91C1C]"
      : impact === "moderate"
        ? "bg-[#FEF3C7] text-[#B45309]"
        : "bg-[#E5E7EB] text-[#374151]";
  return <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${c}`}>{impact}</span>;
}

function a11yFixHint(id: string): string {
  switch (id) {
    case "button-name":
      return "Give the control visible text, aria-label, or an accessible name so screen readers can announce it.";
    case "color-contrast":
      return "Increase contrast between text and background to at least 4.5:1 for normal text (3:1 for large text).";
    case "label":
      return "Associate every input with a <label> (for/id) or aria-labelledby / aria-label.";
    case "select-name":
      return "Provide an accessible name for the <select> via a label or aria-label.";
    case "page-has-heading-one":
      return "Add a single <h1> that names the page purpose.";
    case "image-alt":
      return "Add meaningful alt text (or alt=\"\" for decorative images).";
    default:
      return "Review the failing nodes and apply the WCAG guidance for this rule.";
  }
}

function LevelDot({ level }: { level: SessionHealthSummary["level"] }) {
  const c = level === "ok" ? "bg-[#22C55E]" : level === "warn" ? "bg-[#F59E0B]" : "bg-[#EF4444]";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${c}`} />;
}
