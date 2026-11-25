"use client";

import { useMemo, useState } from "react";
import type { A11yIssue, CanvasNode } from "@/app/interfaces/appatlas";
import {
  A11Y_RULE_GUIDE,
  WCAG_21_SPEC_URL,
  wcag21CriterionUrl,
  wcagMetaForRule,
} from "@/app/lib/health-scoring";
import { atlasUrl } from "@/app/services/appatlas";

function issuesOf(node: CanvasNode): A11yIssue[] {
  const h = node.health;
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
}

function ImpactPill({ impact }: { impact: string }) {
  const tone =
    /critical/i.test(impact)
      ? "bg-[#FEE2E2] text-[#991B1B]"
      : /serious/i.test(impact)
        ? "bg-[#FFEDD5] text-[#9A3412]"
        : /moderate/i.test(impact)
          ? "bg-[#FEF3C7] text-[#92400E]"
          : "bg-[#F3F4F6] text-[#4B5563]";
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${tone}`}>{impact}</span>;
}

/** WCAG 2.1–focused findings for one recorded screen (no console / vitals). */
export function WcagPanel({ node }: { node: CanvasNode }) {
  const issues = useMemo(() => issuesOf(node), [node]);
  const [open, setOpen] = useState<A11yIssue | null>(null);
  const totalNodes = issues.reduce((s, i) => s + (i.nodes || 1), 0);

  return (
    <div className="space-y-4 p-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[15px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">
            WCAG 2.1 checks · {node.path || node.title}
          </h2>
          <a
            href={WCAG_21_SPEC_URL}
            target="_blank"
            rel="noreferrer"
            className="text-[12px] font-medium text-[#8664f2] hover:underline"
          >
            W3C WCAG 2.1 ↗
          </a>
        </div>
        <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-[#6B7280]">
          Findings come from <span className="font-medium text-[#374151] dark:text-[#d1d5db]">axe-core</span> run
          against{" "}
          <a href={WCAG_21_SPEC_URL} target="_blank" rel="noreferrer" className="text-[#8664f2] hover:underline">
            Web Content Accessibility Guidelines (WCAG) 2.1
          </a>{" "}
          Level A + AA (tags <code className="text-[11px]">wcag2a / wcag2aa / wcag21a / wcag21aa</code>). Captured
          while recording — no Figma. This is not the Health tab (console / TTFB / LCP stay under Health).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="rounded-[10px] border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2.5 dark:border-[#2a2a2a] dark:bg-[#141414]">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[#9ca3af]">Rules failed</div>
          <div className="mt-0.5 text-[20px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">{issues.length}</div>
        </div>
        <div className="rounded-[10px] border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2.5 dark:border-[#2a2a2a] dark:bg-[#141414]">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[#9ca3af]">Failing nodes</div>
          <div className="mt-0.5 text-[20px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">
            {node.health?.a11yViolations ?? totalNodes}
          </div>
        </div>
        <div className="rounded-[10px] border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2.5 dark:border-[#2a2a2a] dark:bg-[#141414] sm:col-span-1 col-span-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[#9ca3af]">Standard</div>
          <div className="mt-0.5 text-[13px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">WCAG 2.1 A / AA</div>
        </div>
      </div>

      {issues.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-[#BBF7D0] bg-[#F0FDF4] p-6 text-center text-[13px] text-[#166534]">
          No WCAG 2.1 A/AA violations recorded on this screen.
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
            Success criteria failures
          </div>
          {issues.map((issue, i) => {
            const meta = wcagMetaForRule(issue.id);
            const guide = A11Y_RULE_GUIDE.find((g) => g.id === issue.id);
            const href = meta?.href || (guide?.wcagId ? wcag21CriterionUrl(guide.wcagId) : WCAG_21_SPEC_URL);
            const thumb = issue.screenshotUrl || issue.nodeDetails?.[0]?.screenshotUrl || node.screenshotUrl;
            return (
              <button
                key={`${issue.id}-${i}`}
                type="button"
                onClick={() => setOpen(issue)}
                className="flex w-full gap-3 rounded-[10px] border border-[#E5E7EB] bg-white p-2.5 text-left transition hover:border-[#C7D2FE] dark:border-[#2a2a2a] dark:bg-[#141414]"
              >
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-[8px] bg-[#F3F4F6] dark:bg-[#0f0f0f]">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={atlasUrl(thumb)} alt="" className="h-full w-full object-cover object-top" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[9px] text-[#9CA3AF]">a11y</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded bg-[#EEF2FF] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#4338CA]">
                      {issue.id}
                    </span>
                    {issue.impact ? <ImpactPill impact={issue.impact} /> : null}
                    {meta ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="rounded bg-[#ECFDF5] px-1.5 py-0.5 text-[10px] font-medium text-[#047857] hover:underline"
                      >
                        WCAG {meta.wcagId} {meta.wcagName} ({meta.wcagLevel})
                      </a>
                    ) : (
                      <span className="rounded bg-[#F3F4F6] px-1.5 py-0.5 text-[10px] text-[#6B7280]">WCAG 2.1</span>
                    )}
                    <span className="text-[10px] text-[#9ca3af]">
                      {issue.nodes} node{issue.nodes === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="mt-1 text-[13px] font-medium text-[#111827] dark:text-[#ededed]">{issue.help}</div>
                  {guide?.definition ? (
                    <p className="mt-0.5 line-clamp-2 text-[11.5px] text-[#6B7280]">{guide.definition}</p>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="rounded-[10px] border border-[#E5E7EB] bg-[#FAFAFA] p-3 text-[12px] text-[#4B5563] dark:border-[#2a2a2a] dark:bg-[#101010] dark:text-[#d1d5db]">
        <div className="font-semibold text-[#111827] dark:text-[#ededed]">About this check</div>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          <li>
            Spec:{" "}
            <a href={WCAG_21_SPEC_URL} target="_blank" rel="noreferrer" className="text-[#8664f2] hover:underline">
              https://www.w3.org/TR/WCAG21/
            </a>
          </li>
          <li>Engine: axe-core, WCAG 2.1 A + AA tags only (best-practice-only rules excluded on new recordings).</li>
          <li>Re-record the canvas after this update to refresh findings with the scoped rule set.</li>
        </ul>
      </div>

      {open ? (
        <WcagIssueModal
          issue={open}
          screenShot={node.screenshotUrl}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </div>
  );
}

function WcagIssueModal({
  issue,
  screenShot,
  onClose,
}: {
  issue: A11yIssue;
  screenShot: string;
  onClose: () => void;
}) {
  const meta = wcagMetaForRule(issue.id);
  const guide = A11Y_RULE_GUIDE.find((g) => g.id === issue.id);
  const href = meta?.href || WCAG_21_SPEC_URL;
  const details =
    issue.nodeDetails?.length
      ? issue.nodeDetails
      : issue.target || issue.screenshotUrl
        ? [{ target: issue.target || "", failureSummary: issue.failureSummary, screenshotUrl: issue.screenshotUrl }]
        : [];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[12px] border border-[#E5E7EB] bg-white p-4 shadow-xl dark:border-[#333] dark:bg-[#0f0f0f]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded bg-[#EEF2FF] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#4338CA]">
                {issue.id}
              </span>
              {issue.impact ? <ImpactPill impact={issue.impact} /> : null}
              {meta ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded bg-[#ECFDF5] px-1.5 py-0.5 text-[10px] font-medium text-[#047857] hover:underline"
                >
                  WCAG 2.1 · {meta.wcagId} {meta.wcagName} ({meta.wcagLevel}) ↗
                </a>
              ) : null}
            </div>
            <div className="mt-1 text-[14px] font-semibold text-[#111827] dark:text-[#ededed]">{issue.help}</div>
          </div>
          <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-[12px] text-[#6B7280] hover:bg-[#F3F4F6]">
            Close
          </button>
        </div>

        {guide ? (
          <div className="mb-3 rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] p-2.5 text-[12px] text-[#4B5563] dark:border-[#2a2a2a] dark:bg-[#141414] dark:text-[#d1d5db]">
            <p>{guide.definition}</p>
            <p className="mt-1">
              <span className="font-medium text-[#111827] dark:text-[#ededed]">Fix:</span> {guide.fix}
            </p>
          </div>
        ) : null}

        <div className="space-y-3">
          {details.map((d, i) => {
            const src = d.screenshotUrl || (i === 0 ? issue.screenshotUrl || screenShot : undefined);
            return (
              <div key={i} className="rounded-lg border border-[#E5E7EB] p-2.5 dark:border-[#2a2a2a]">
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={atlasUrl(src)}
                    alt=""
                    className="mb-2 max-h-[240px] w-full rounded object-contain object-top"
                  />
                ) : null}
                {d.failureSummary ? <p className="text-[12px] text-[#4B5563]">{d.failureSummary}</p> : null}
                {d.target ? <p className="mt-1 break-all font-mono text-[11px] text-[#6B7280]">{d.target}</p> : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
