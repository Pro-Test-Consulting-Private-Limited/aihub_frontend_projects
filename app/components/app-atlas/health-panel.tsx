"use client";

import type { CanvasNode, SessionHealthSummary } from "@/app/interfaces/appatlas";

const SCORE_HELP: Record<string, string> = {
  consoleErrors: "Messages logged with console.error during the screen visit.",
  consoleWarnings: "Messages logged with console.warn during the screen visit.",
  pageErrors: "Uncaught exceptions (window error / pageerror) on this screen.",
  failedRequests: "Network requests that failed (DNS, aborted, or no response).",
  httpErrors: "Responses with HTTP status 4xx or 5xx.",
  brokenImages: "img elements that failed to load (naturalWidth === 0).",
  ttfbMs: "Time to First Byte from the Navigation Timing API (ms).",
  lcpMs: "Largest Contentful Paint (ms). Lower is better; >2500 is poor.",
  cls: "Cumulative Layout Shift. Lower is better; >0.1 is poor.",
  a11yViolations: "axe-core violations found in an isolated world (read-only).",
  slowestRequestMs: "Slowest observed request duration on this screen (ms).",
};

export function HealthPanel({ node }: { node: CanvasNode }) {
  const h = node.health;
  if (!h) {
    return <div className="p-4 text-[13px] text-[#7E7E7E]">No health data captured for this screen yet.</div>;
  }
  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center gap-2">
        <LevelDot level={h.level} />
        <span className="text-[13px] font-medium text-[#1F1F1F] dark:text-[#ededed]">
          {node.path} · {h.level === "ok" ? "Healthy" : h.level === "warn" ? "Needs attention" : "Unhealthy"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Metric label="Console errors" value={h.consoleErrors} help={SCORE_HELP.consoleErrors!} />
        <Metric label="Console warnings" value={h.consoleWarnings} help={SCORE_HELP.consoleWarnings!} />
        <Metric label="Page errors" value={h.pageErrors} help={SCORE_HELP.pageErrors!} />
        <Metric label="Failed requests" value={h.failedRequests} help={SCORE_HELP.failedRequests!} />
        <Metric label="4xx/5xx" value={h.httpErrors} help={SCORE_HELP.httpErrors!} />
        <Metric label="Broken images" value={h.brokenImages} help={SCORE_HELP.brokenImages!} />
        <Metric label="TTFB" value={fmtMs(h.ttfbMs)} help={SCORE_HELP.ttfbMs!} />
        <Metric label="LCP" value={fmtMs(h.lcpMs)} help={SCORE_HELP.lcpMs!} />
        <Metric label="CLS" value={h.cls ?? "—"} help={SCORE_HELP.cls!} />
        <Metric label="a11y" value={h.a11yViolations} help={SCORE_HELP.a11yViolations!} />
        <Metric
          label="Slowest request"
          value={h.slowestRequestMs != null ? `${h.slowestRequestMs} ms` : "—"}
          help={SCORE_HELP.slowestRequestMs!}
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

function LevelDot({ level }: { level: SessionHealthSummary["level"] }) {
  const c = level === "ok" ? "bg-[#22C55E]" : level === "warn" ? "bg-[#F59E0B]" : "bg-[#EF4444]";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${c}`} />;
}

function Metric({ label, value, help }: { label: string; value: string | number; help: string }) {
  return (
    <div className="rounded-[8px] border border-[#EEE] px-2.5 py-2 dark:border-[#2a2a2a]" title={help}>
      <div className="text-[10px] uppercase tracking-wide text-[#9ca3af]">{label}</div>
      <div className="text-[15px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">{value}</div>
    </div>
  );
}

function fmtMs(v: number | null | undefined) {
  return v == null ? "—" : `${Math.round(v)} ms`;
}
