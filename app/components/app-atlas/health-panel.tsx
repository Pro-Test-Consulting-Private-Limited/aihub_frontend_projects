"use client";

import { useEffect, useMemo, useState } from "react";
import type { A11yIssue, CanvasNode, SessionHealthSummary } from "@/app/interfaces/appatlas";
import {
  A11Y_RULE_GUIDE,
  HEALTH_BADGE_RULES,
  METRIC_HELP,
  WEB_VITAL_BANDS,
} from "@/app/lib/health-scoring";
import { atlasUrl } from "@/app/services/appatlas";

type MetricKey = keyof typeof METRIC_HELP;

export function HealthPanel({ node }: { node: CanvasNode }) {
  const h = node.health;
  const [guideOpen, setGuideOpen] = useState(false);
  const [issueModal, setIssueModal] = useState<A11yIssue | null>(null);
  const [fullscreenSrc, setFullscreenSrc] = useState<string | null>(null);

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

  useEffect(() => {
    if (!guideOpen && !issueModal && !fullscreenSrc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (fullscreenSrc) setFullscreenSrc(null);
        else if (issueModal) setIssueModal(null);
        else setGuideOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [guideOpen, issueModal, fullscreenSrc]);

  if (!h) {
    return <div className="p-4 text-[13px] text-[#7E7E7E]">No health data captured for this screen yet.</div>;
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <ColorChip color={levelColor(h.level)} label={h.level} />
          <span className="text-[13px] font-medium text-[#1F1F1F] dark:text-[#ededed]">
            {node.path} · {h.level === "ok" ? "Healthy" : h.level === "warn" ? "Needs attention" : "Unhealthy"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setGuideOpen(true)}
          className="shrink-0 rounded-md border border-[#C7D2FE] bg-[#EEF2FF] px-2 py-1 text-[11px] font-medium text-[#5B3FD1] hover:bg-[#E0E7FF] dark:border-[#4338ca] dark:bg-[#1e1b4b] dark:text-[#c7d2fe] dark:hover:bg-[#312e81]"
        >
          Scoring & a11y guide
        </button>
      </div>

      <ScoringLegend level={h.level} />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {metrics.map((m) => (
          <MetricCard key={m.key} metric={m} />
        ))}
      </div>

      {a11yIssues.length > 0 && (
        <div className="space-y-2">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">Accessibility</div>
            <p className="text-[12px] text-[#6B7280]">
              {h.a11yViolations} failing node{h.a11yViolations === 1 ? "" : "s"} across {a11yIssues.length} rule
              {a11yIssues.length === 1 ? "" : "s"}. Click a card for details and full-size crop.
            </p>
          </div>
          <div className="space-y-2">
            {a11yIssues.map((issue, i) => (
              <button
                key={`${issue.id}-${i}`}
                type="button"
                onClick={() => setIssueModal(issue)}
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
                    <div className="mt-1 text-[10px] text-[#6366F1]">Open details</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {h.slowestRequestUrl && h.slowestRequestMs != null && (
        <div className="truncate text-[11px] text-[#7E7E7E]" title={h.slowestRequestUrl}>
          Slowest URL ({h.slowestRequestMs} ms): {h.slowestRequestUrl}
        </div>
      )}

      {guideOpen && <GuideOverlay onClose={() => setGuideOpen(false)} />}
      {issueModal && (
        <A11yIssueOverlay
          issue={issueModal}
          screenShot={node.screenshotUrl}
          onClose={() => setIssueModal(null)}
          onFullscreen={(src) => setFullscreenSrc(src)}
        />
      )}
      {fullscreenSrc && <FullscreenImage src={fullscreenSrc} onClose={() => setFullscreenSrc(null)} />}
    </div>
  );
}

function ColorChip({
  color,
  label,
  size = 12,
  showHex = true,
}: {
  color: string;
  label: string;
  size?: number;
  showHex?: boolean;
}) {
  return (
    <button
      type="button"
      title={`${label}: ${color}`}
      aria-label={`${label} colour ${color}`}
      className="inline-flex items-center gap-1 rounded border border-black/10 bg-white px-1 py-0.5 text-[10px] text-[#4B5563] dark:border-white/10 dark:bg-[#1a1a1a] dark:text-[#d1d5db]"
      onClick={() => {
        void navigator.clipboard?.writeText(color).catch(() => undefined);
      }}
    >
      <span
        className="inline-block rounded-sm border border-black/15 dark:border-white/20"
        style={{ width: size, height: size, background: color }}
      />
      {showHex && <span className="font-mono">{color}</span>}
    </button>
  );
}

function levelColor(level: SessionHealthSummary["level"]) {
  return level === "ok" ? "#22C55E" : level === "warn" ? "#F59E0B" : "#EF4444";
}

function ScoringLegend({ level }: { level: SessionHealthSummary["level"] }) {
  return (
    <div className="rounded-[10px] border border-[#E5E7EB] bg-[#FAFAFA] p-3 dark:border-[#2a2a2a] dark:bg-[#141414]">
      <div className="mb-2 text-[12px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">How scoring works</div>
      <p className="mb-2 text-[11px] leading-relaxed text-[#4B5563] dark:text-[#d1d5db]">
        Badge colour comes from error / HTTP / image / accessibility counts on this screen. TTFB, LCP, and CLS are
        context only.
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
              <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
                <ColorChip color={rule.color} label={rule.label} />
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

function GuideOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Health scoring and accessibility guide"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[12px] border border-[#E5E7EB] bg-white p-4 shadow-xl dark:border-[#333] dark:bg-[#0f0f0f]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-[15px] font-semibold text-[#111827] dark:text-[#ededed]">Health scoring & accessibility</div>
            <p className="mt-1 text-[12px] text-[#6B7280]">
              Definitions, badge criteria, Web Vitals bands, and common accessibility rules with examples.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-[12px] text-[#6B7280] hover:bg-[#F3F4F6]">
            Close
          </button>
        </div>

        <section className="mb-4">
          <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[#9ca3af]">Badge colours</h3>
          <div className="space-y-2">
            {(["ok", "warn", "bad"] as const).map((key) => {
              const rule = HEALTH_BADGE_RULES[key];
              return (
                <div key={key} className="rounded-lg border border-[#E5E7EB] p-2.5 dark:border-[#2a2a2a]">
                  <div className="mb-1 flex items-center gap-2">
                    <ColorChip color={rule.color} label={rule.label} size={14} />
                    <span className="text-[13px] font-medium text-[#111827] dark:text-[#ededed]">{rule.label}</span>
                  </div>
                  {"summary" in rule ? (
                    <p className="text-[12px] text-[#4B5563] dark:text-[#d1d5db]">{rule.summary}</p>
                  ) : (
                    <ul className="list-disc space-y-0.5 pl-4 text-[12px] text-[#4B5563] dark:text-[#d1d5db]">
                      {rule.anyOf.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="mb-4">
          <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[#9ca3af]">Web Vitals</h3>
          <div className="space-y-2">
            {Object.values(WEB_VITAL_BANDS).map((v) => (
              <div key={v.name} className="rounded-lg border border-[#E5E7EB] p-2.5 text-[12px] dark:border-[#2a2a2a]">
                <div className="font-medium text-[#111827] dark:text-[#ededed]">{v.name}</div>
                <p className="mt-1 text-[#4B5563] dark:text-[#d1d5db]">{v.meaning}</p>
                <p className="mt-1 text-[#6B7280]">
                  Good {v.good}; needs improvement {v.needsImprovement}; poor {v.poor}.
                </p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[#9ca3af]">Accessibility rules</h3>
          <div className="space-y-2">
            {A11Y_RULE_GUIDE.map((rule) => (
              <div key={rule.id} className="rounded-lg border border-[#E5E7EB] p-2.5 text-[12px] dark:border-[#2a2a2a]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-[#EEF2FF] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#4338CA]">
                    {rule.id}
                  </span>
                  <span className="font-medium text-[#111827] dark:text-[#ededed]">{rule.title}</span>
                </div>
                <p className="mt-1 text-[#4B5563] dark:text-[#d1d5db]">
                  <span className="font-medium">Definition:</span> {rule.definition}
                </p>
                <p className="mt-1 text-[#4B5563] dark:text-[#d1d5db]">
                  <span className="font-medium">Example:</span> {rule.example}
                </p>
                {rule.id === "color-contrast" && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-[#6B7280]">Fail example</span>
                    <ColorChip color="#A78BFA" label="light purple on white" />
                    <span className="text-[11px] text-[#6B7280]">on</span>
                    <ColorChip color="#FFFFFF" label="white" />
                    <span className="text-[11px] text-[#6B7280]">Pass example</span>
                    <ColorChip color="#4C1D95" label="deep purple on white" />
                    <span className="text-[11px] text-[#6B7280]">on</span>
                    <ColorChip color="#FFFFFF" label="white" />
                  </div>
                )}
                <p className="mt-1 text-[#4B5563] dark:text-[#d1d5db]">
                  <span className="font-medium">Fix:</span> {rule.fix}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function A11yIssueOverlay({
  issue,
  screenShot,
  onClose,
  onFullscreen,
}: {
  issue: A11yIssue;
  screenShot: string;
  onClose: () => void;
  onFullscreen: (src: string) => void;
}) {
  const src = issue.screenshotUrl || screenShot;
  const guide = A11Y_RULE_GUIDE.find((g) => g.id === issue.id);
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${issue.id} accessibility issue`}
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[12px] border border-[#E5E7EB] bg-white p-4 shadow-xl dark:border-[#333] dark:bg-[#0f0f0f]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded bg-[#EEF2FF] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#4338CA]">
                {issue.id}
              </span>
              {issue.impact && <ImpactPill impact={issue.impact} />}
              <span className="text-[11px] text-[#9ca3af]">
                {issue.nodes} node{issue.nodes === 1 ? "" : "s"}
              </span>
            </div>
            <div className="mt-1 text-[14px] font-semibold text-[#111827] dark:text-[#ededed]">{issue.help}</div>
          </div>
          <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-[12px] text-[#6B7280] hover:bg-[#F3F4F6]">
            Close
          </button>
        </div>

        {src ? (
          <button
            type="button"
            className="group relative mb-3 block w-full overflow-hidden rounded-lg border border-[#E5E7EB] dark:border-[#333]"
            onClick={() => onFullscreen(atlasUrl(src))}
            title="View full screen"
          >
            <img src={atlasUrl(src)} alt={`${issue.id} crop`} className="max-h-64 w-full object-contain bg-[#F8FAFC]" />
            <span className="absolute right-2 bottom-2 rounded bg-black/65 px-2 py-1 text-[10px] text-white opacity-90 group-hover:opacity-100">
              Full screen
            </span>
          </button>
        ) : null}

        <div className="space-y-2 text-[12px] leading-relaxed text-[#4B5563] dark:text-[#d1d5db]">
          {issue.failureSummary && (
            <p>
              <span className="font-medium text-[#111827] dark:text-[#ededed]">Failure:</span> {issue.failureSummary}
            </p>
          )}
          {issue.target && (
            <p className="break-all font-mono text-[11px] text-[#6B7280]">
              <span className="font-sans font-medium text-[#111827] dark:text-[#ededed]">Target: </span>
              {issue.target}
            </p>
          )}
          <p>
            <span className="font-medium text-[#111827] dark:text-[#ededed]">Fix hint:</span> {a11yFixHint(issue.id)}
          </p>
          {guide && (
            <div className="rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] p-2.5 dark:border-[#2a2a2a] dark:bg-[#141414]">
              <div className="font-medium text-[#111827] dark:text-[#ededed]">{guide.title}</div>
              <p className="mt-1">{guide.definition}</p>
              <p className="mt-1">
                <span className="font-medium">Example:</span> {guide.example}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FullscreenImage({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90 p-3" onClick={onClose}>
      <button
        type="button"
        className="absolute top-3 right-3 rounded-md bg-white/10 px-3 py-1.5 text-[12px] text-white hover:bg-white/20"
        onClick={onClose}
      >
        Close
      </button>
      <img
        src={src}
        alt="Accessibility crop full screen"
        className="max-h-full max-w-full object-contain"
        onClick={(e) => e.stopPropagation()}
      />
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
    countMetric("consoleErrors", "Console errors", h.consoleErrors, { warnAt: 1, badAt: 3 }),
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
  return { key, label, display: String(value), tone, body: help.body, scoring: help.scoring };
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
    };
  }
  const help = METRIC_HELP[key];
  return { key, label, display: fmt(value), tone: "info", body: help.body };
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
      {metric.scoring && <ScoringRuleLine text={metric.scoring} />}
    </div>
  );
}

/** Inline colour chips next to yellow / red / green mentions in scoring rules. */
function ScoringRuleLine({ text }: { text: string }) {
  const COLOR_WORDS: Record<string, string> = {
    yellow: "#F59E0B",
    red: "#EF4444",
    green: "#22C55E",
  };
  const parts = text.split(/(\byellow\b|\bred\b|\bgreen\b)/gi);
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[10px] font-medium text-[#6366F1]">
      {parts.map((part, i) => {
        const color = COLOR_WORDS[part.toLowerCase()];
        if (!color) return <span key={i}>{part}</span>;
        return (
          <span key={i} className="inline-flex items-center gap-1">
            <ColorChip color={color} label={part} size={10} showHex={false} />
            <span>{part}</span>
          </span>
        );
      })}
    </p>
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
  const color =
    impact === "critical" || impact === "serious" ? "#EF4444" : impact === "moderate" ? "#F59E0B" : "#9CA3AF";
  const c =
    impact === "critical" || impact === "serious"
      ? "bg-[#FEE2E2] text-[#B91C1C]"
      : impact === "moderate"
        ? "bg-[#FEF3C7] text-[#B45309]"
        : "bg-[#E5E7EB] text-[#374151]";
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${c}`}>
      <span className="inline-block h-2 w-2 rounded-sm" style={{ background: color }} />
      {impact}
    </span>
  );
}

function a11yFixHint(id: string): string {
  const guide = A11Y_RULE_GUIDE.find((g) => g.id === id);
  if (guide) return guide.fix;
  return "Review the failing nodes and apply the WCAG guidance for this rule.";
}
