"use client";

import { useState } from "react";
import type { CanvasNode, SessionHealthSummary } from "@/app/interfaces/appatlas";
import { HEALTH_BADGE_RULES, METRIC_HELP, WEB_VITAL_BANDS } from "@/app/lib/health-scoring";

export function HealthPanel({ node }: { node: CanvasNode }) {
  const h = node.health;
  const [helpOpen, setHelpOpen] = useState(false);

  if (!h) {
    return <div className="p-4 text-[13px] text-[#7E7E7E]">No health data captured for this screen yet.</div>;
  }

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <LevelDot level={h.level} />
          <span className="text-[13px] font-medium text-[#1F1F1F] dark:text-[#ededed]">
            {node.path} · {h.level === "ok" ? "Healthy" : h.level === "warn" ? "Needs attention" : "Unhealthy"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setHelpOpen((v) => !v)}
          className="shrink-0 rounded-md border border-[#E5E7EB] px-2 py-1 text-[11px] font-medium text-[#4B5563] hover:bg-[#F9FAFB] dark:border-[#333] dark:text-[#d1d5db] dark:hover:bg-[#1a1a1a]"
          aria-expanded={helpOpen}
        >
          {helpOpen ? "Hide scoring" : "How scoring works"}
        </button>
      </div>

      {helpOpen && <ScoringHelpBox level={h.level} />}

      <div className="grid grid-cols-2 gap-2">
        <Metric metricKey="consoleErrors" label="Console errors" value={h.consoleErrors} />
        <Metric metricKey="consoleWarnings" label="Console warnings" value={h.consoleWarnings} />
        <Metric metricKey="pageErrors" label="Page errors" value={h.pageErrors} />
        <Metric metricKey="failedRequests" label="Failed requests" value={h.failedRequests} />
        <Metric metricKey="httpErrors" label="4xx/5xx" value={h.httpErrors} />
        <Metric metricKey="brokenImages" label="Broken images" value={h.brokenImages} />
        <Metric metricKey="ttfbMs" label="TTFB" value={fmtMs(h.ttfbMs)} />
        <Metric metricKey="lcpMs" label="LCP" value={fmtMs(h.lcpMs)} />
        <Metric metricKey="cls" label="CLS" value={h.cls ?? "—"} />
        <Metric metricKey="a11yViolations" label="a11y" value={h.a11yViolations} />
        <Metric
          metricKey="slowestRequestMs"
          label="Slowest request"
          value={h.slowestRequestMs != null ? `${h.slowestRequestMs} ms` : "—"}
        />
      </div>

      {h.a11ySummary && h.a11ySummary.length > 0 && (
        <div>
          <div className="mb-1 text-[11px] font-medium uppercase text-[#9ca3af]">Accessibility</div>
          <ul className="space-y-1 text-[12px] text-[#374151] dark:text-[#d1d5db]">
            {h.a11ySummary.map((s, i) => (
              <li key={i} className="rounded border border-[#EEE] px-2 py-1 dark:border-[#2a2a2a]">
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
      {h.slowestRequestUrl && (
        <div className="truncate text-[11px] text-[#7E7E7E]" title={h.slowestRequestUrl}>
          Slowest URL: {h.slowestRequestUrl}
        </div>
      )}
    </div>
  );
}

function ScoringHelpBox({ level }: { level: SessionHealthSummary["level"] }) {
  return (
    <div className="rounded-[10px] border border-[#E5E7EB] bg-[#FAFAFA] p-3 text-[12px] leading-relaxed text-[#374151] dark:border-[#2a2a2a] dark:bg-[#141414] dark:text-[#d1d5db]">
      <p className="mb-2 font-medium text-[#1F1F1F] dark:text-[#ededed]">
        Badge colour is driven by counts below — not by TTFB / LCP / CLS (those are informational).
      </p>

      <div className="space-y-2">
        {(["ok", "warn", "bad"] as const).map((key) => {
          const rule = HEALTH_BADGE_RULES[key];
          const active = level === key;
          return (
            <div
              key={key}
              className={`rounded-md border px-2.5 py-2 ${
                active
                  ? "border-[#C7D2FE] bg-white dark:border-[#4338ca] dark:bg-[#0f0f0f]"
                  : "border-transparent bg-transparent"
              }`}
            >
              <div className="mb-1 flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: rule.color }} />
                <span className="font-medium text-[#1F1F1F] dark:text-[#ededed]">{rule.label}</span>
                {active && <span className="text-[10px] uppercase tracking-wide text-[#6366F1]">this screen</span>}
              </div>
              {"summary" in rule ? (
                <p>{rule.summary}</p>
              ) : (
                <ul className="list-disc space-y-0.5 pl-4">
                  {rule.anyOf.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              )}
              {"anyOf" in rule && <p className="mt-1 text-[11px] text-[#6B7280]">Any one of these triggers this level (bad wins over warn).</p>}
            </div>
          );
        })}
      </div>

      <div className="mt-3 border-t border-[#E5E7EB] pt-2 dark:border-[#2a2a2a]">
        <div className="mb-1 font-medium text-[#1F1F1F] dark:text-[#ededed]">Web Vitals (info only)</div>
        <ul className="space-y-1.5">
          {Object.values(WEB_VITAL_BANDS).map((v) => (
            <li key={v.name}>
              <span className="font-medium">{v.name}</span> — {v.meaning} Good {v.good}; needs improvement {v.needsImprovement}; poor {v.poor}.
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-2 text-[11px] text-[#6B7280]">Hover any metric tile for a short definition and how it affects the badge.</p>
    </div>
  );
}

function LevelDot({ level }: { level: SessionHealthSummary["level"] }) {
  const c = level === "ok" ? "bg-[#22C55E]" : level === "warn" ? "bg-[#F59E0B]" : "bg-[#EF4444]";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${c}`} />;
}

function Metric({
  metricKey,
  label,
  value,
}: {
  metricKey: keyof typeof METRIC_HELP;
  label: string;
  value: string | number;
}) {
  const help = METRIC_HELP[metricKey];
  const title = help
    ? `${help.title}\n\n${help.body}${help.scoring ? `\n\nScoring: ${help.scoring}` : ""}`
    : undefined;
  return (
    <div className="rounded-[8px] border border-[#EEE] px-2.5 py-2 dark:border-[#2a2a2a]" title={title}>
      <div className="flex items-center gap-1">
        <div className="text-[10px] uppercase tracking-wide text-[#9ca3af]">{label}</div>
        {help && (
          <span
            className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[#D1D5DB] text-[9px] font-semibold text-[#6B7280]"
            aria-label={help.title}
          >
            ?
          </span>
        )}
      </div>
      <div className="text-[15px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">{value}</div>
    </div>
  );
}

function fmtMs(v: number | null | undefined) {
  return v == null ? "—" : `${Math.round(v)} ms`;
}
