"use client";

import { useState } from "react";
import { TbAlertTriangle, TbCheck, TbChevronDown, TbChevronRight, TbMinus, TbX } from "react-icons/tb";
import type { CheckResult, ResultStatus, RunResponse, RunResult } from "@/app/interfaces/api-testing";
import { requestAddAccount } from "@/app/lib/api-testing/identities";
import { plainCause } from "@/app/lib/api-testing/plain-cause";
import { useLayoutMode } from "./layout-mode";
import { box, label, mono, outlineButton, STATUS_STYLE } from "./ui";

export function StatusBadge({ status }: { status: ResultStatus }) {
  return (
    <span className={`inline-block shrink-0 rounded-[4px] border px-2 py-0.5 text-[10.5px] font-bold tracking-wide ${STATUS_STYLE[status] ?? STATUS_STYLE.skipped}`}>
      {status.toUpperCase()}
    </span>
  );
}

const pretty = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v, null, 2));

function CheckRow({ c }: { c: CheckResult }) {
  const icon =
    c.status === "pass" ? <TbCheck size={14} className="text-[#16A34A]" /> : c.status === "fail" ? <TbX size={14} className="text-[#DC2626]" /> : c.status === "warn" ? <TbAlertTriangle size={14} className="text-[#D97706]" /> : <TbMinus size={14} className="text-[#7E7E7E]" />;
  const showBoth = c.status === "fail" || c.status === "warn";
  return (
    <li className="flex items-start gap-2 py-1 text-[12px]">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="text-[#1F1F1F] dark:text-[#ededed]">{c.label}</div>
        {showBoth ? (
          <div className="mt-0.5 grid grid-cols-[64px_1fr] gap-x-2 text-[11.5px] text-[#5E6066] dark:text-[#9ca3af]">
            <span className="font-semibold">Expected</span>
            <span className={`${mono} break-all`}>{c.expected ?? "—"}</span>
            <span className="font-semibold">Actual</span>
            <span className={`${mono} break-all ${c.status === "fail" ? "text-[#DC2626]" : "text-[#D97706]"}`}>{c.actual ?? "—"}</span>
          </div>
        ) : (
          <div className="text-[11.5px] break-all text-[#7E7E7E]">{c.actual ?? c.expected}</div>
        )}
      </div>
    </li>
  );
}

/** One run: request sent (masked), response received, duration and the check or assertion results. */
export function ResultCard({ r, defaultOpen }: { r: RunResult; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? (r.status === "failed" || r.status === "blocked"));
  const fails = r.checks.filter((c) => c.status === "fail").length;
  return (
    <div className={`${box} overflow-hidden`}>
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-3 py-2 text-left" aria-expanded={open}>
        {open ? <TbChevronDown size={14} className="shrink-0 text-[#7E7E7E]" /> : <TbChevronRight size={14} className="shrink-0 text-[#7E7E7E]" />}
        <StatusBadge status={r.status} />
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-[#1F1F1F] dark:text-[#ededed]" title={r.name}>
          {r.name}
        </span>
        {r.ranAs && <span className="shrink-0 text-[11px] text-[#7E7E7E]">ran as <span className={mono}>{r.ranAs}</span></span>}
        {r.fromCache && <span className="shrink-0 text-[11px] text-[#7E7E7E]">from session</span>}
        {r.response && <span className={`${mono} shrink-0 text-[11.5px] text-[#5E6066] dark:text-[#9ca3af]`}>{r.response.status}</span>}
        {r.request && <span className="shrink-0 text-[11.5px] text-[#7E7E7E]">{r.durationMs} ms</span>}
        {fails > 0 && <span className="shrink-0 text-[11px] font-semibold text-[#DC2626]">{fails} failed</span>}
      </button>
      {open && (
        <div className="space-y-3 border-t border-[#EEE] px-3 py-3 dark:border-[#1a1a1a]">
          {plainCause(r) && <div className="rounded-[6px] bg-[#FEF2F2] px-2.5 py-2 text-[12px] leading-snug text-[#991B1B] dark:bg-[#2a1212] dark:text-[#FCA5A5]">{plainCause(r)}</div>}
          {r.hint && <div className="rounded-[6px] bg-[#FFFBEB] px-2.5 py-2 text-[12px] leading-snug text-[#92400E] dark:bg-[#2a2210] dark:text-[#FCD34D]">{r.hint}</div>}
          {r.note && <div className="rounded-[6px] bg-[#F5F1FF] px-2.5 py-1.5 text-[12px] leading-snug text-[#5B3FC4] dark:bg-[#1c1530] dark:text-[#C4B5FD]">{r.note.charAt(0).toUpperCase() + r.note.slice(1)}</div>}
          {r.action?.type === "add-account" && (
            <button type="button" className={`${outlineButton} !px-2.5 !py-1 !text-[11.5px]`} onClick={() => requestAddAccount(r.action!.role)}>Add account</button>
          )}
          {r.error && !r.hint && <div className="text-[12px] text-[#DC2626]">{r.error}</div>}
          {r.extracted && r.extracted.length > 0 && (
            <div>
              <div className={label}>Saved for later steps</div>
              <div className="flex flex-wrap gap-1.5">
                {r.extracted.map((e) => (
                  <span key={e.name} className={`${box} ${mono} px-2 py-0.5 text-[11.5px] text-[#1F1F1F] dark:text-[#ededed]`} title={e.auto ? "Saved automatically from the response" : "Saved by your rule"}>
                    {`{{${e.name}}}`} = {e.masked}
                    {e.auto ? <span className="ml-1 text-[#7E7E7E]">auto</span> : null}
                  </span>
                ))}
              </div>
            </div>
          )}
          {r.checks.length > 0 && (
            <div>
              <div className={label}>Checks</div>
              <ul className="divide-y divide-[#EEE] dark:divide-[#1a1a1a]">
                {r.checks.map((c) => (
                  <CheckRow key={c.id} c={c} />
                ))}
              </ul>
            </div>
          )}
          {r.request && (
            <div>
              <div className={label}>Request sent (secrets masked)</div>
              <pre className={`${box} overflow-x-auto px-3 py-2 ${mono} text-[11.5px] leading-relaxed text-[#1F1F1F] dark:text-[#ededed]`}>
                {`${r.request.method} ${r.request.url}\n${Object.entries(r.request.headers)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join("\n")}${r.request.body !== undefined ? `\n\n${pretty(r.request.body)}` : ""}`}
              </pre>
            </div>
          )}
          {r.response && (
            <div>
              <div className={label}>
                Response received · {r.response.status}
                {r.response.contentType ? ` · ${r.response.contentType.split(";")[0]}` : ""} · {r.durationMs} ms
              </div>
              <pre className={`${box} max-h-[240px] overflow-auto px-3 py-2 ${mono} text-[11.5px] leading-relaxed text-[#1F1F1F] dark:text-[#ededed]`}>
                {r.response.body === null || r.response.body === undefined || r.response.body === "" ? "(empty body)" : pretty(r.response.body)}
              </pre>
            </div>
          )}
          {!r.request && !r.hint && r.status !== "blocked" && <div className="text-[12px] text-[#7E7E7E]">Nothing was sent.</div>}
        </div>
      )}
    </div>
  );
}

const chip = "rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium";

export function ResultsPanel({ run, rowOrder }: { run: RunResponse; rowOrder?: string[] }) {
  const s = run.summary;
  // In the data-driven table the order of the rows matters, so only the other tabs reorder and fold.
  const layout = useLayoutMode() === "new" && !rowOrder ? "new" : "classic";
  const [showPassed, setShowPassed] = useState(false);
  const ordered = rowOrder ? [...run.results].sort((a, b) => rowOrder.indexOf(a.id) - rowOrder.indexOf(b.id)) : run.results;
  // New layout: what needs attention first, passed ones folded away (unless everything passed).
  const rank = (r: RunResult) => (r.status === "failed" ? 0 : r.status === "blocked" ? 1 : r.status === "passed" ? 3 : 2);
  const attention = layout === "new" ? [...ordered].filter((r) => r.status !== "passed").sort((a, b) => rank(a) - rank(b)) : [];
  const passed = layout === "new" ? ordered.filter((r) => r.status === "passed") : [];
  const fold = layout === "new" && attention.length > 0 && passed.length > 0;
  const results = layout === "new" ? (fold ? attention : ordered) : ordered;
  return (
    <div className="space-y-3">
      {run.status === "blocked" && (
        <div className="rounded-[8px] border border-[#D97706] bg-[#FFFBEB] px-3 py-2 text-[12.5px] text-[#92400E] dark:bg-[#2a2210] dark:text-[#FCD34D]">
          {run.blockedReason ? (
            <>
              <b>BLOCKED: {run.blockedReason.title}.</b> {run.blockedReason.message} Nothing was sent, so these are not failures.
              {run.blockedReason.action?.type === "add-account" && (
                <div className="mt-1.5">
                  <button type="button" className={`${outlineButton} !px-2.5 !py-1 !text-[11.5px]`} onClick={() => requestAddAccount(run.blockedReason!.action!.role)}>Add account</button>
                </div>
              )}
            </>
          ) : (
            <>
              <b>BLOCKED.</b> A prerequisite failed, so the tests below did not run. They are not counted as failures.
            </>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`${chip} border-[#E5E7EB] bg-[#F5F6F6] text-[#1F1F1F] dark:border-[#2a2a2a] dark:bg-[#141414] dark:text-[#ededed]`}>{s.total} test{s.total === 1 ? "" : "s"}</span>
        <span className={`${chip} ${STATUS_STYLE.passed}`}>{s.passed} passed</span>
        <span className={`${chip} ${STATUS_STYLE.failed}`}>{s.failed} failed</span>
        {s.blocked > 0 && <span className={`${chip} ${STATUS_STYLE.blocked}`}>{s.blocked} blocked</span>}
        {s.skipped > 0 && <span className={`${chip} ${STATUS_STYLE.skipped}`}>{s.skipped} skipped</span>}
        {s.passRate !== null && <span className="ml-1 text-[12px] text-[#5E6066] dark:text-[#9ca3af]">{s.passRate}% pass rate</span>}
      </div>
      {run.notes.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-4 text-[11.5px] text-[#7E7E7E]">
          {run.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      {run.prerequisites.length > 0 && (
        <div>
          <div className={label}>Prerequisites</div>
          <div className="space-y-1.5">
            {run.prerequisites.map((p) => (
              <ResultCard key={p.id} r={p} />
            ))}
          </div>
        </div>
      )}
      <div>
        <div className={label}>Results</div>
        <div className="space-y-1.5">
          {results.map((r) => (
            <ResultCard key={r.id} r={r} />
          ))}
          {fold && (
            <button type="button" onClick={() => setShowPassed(!showPassed)} aria-expanded={showPassed} className="flex w-full items-center gap-1.5 rounded-[8px] border border-dashed border-[#D9D9D9] px-3 py-2 text-left text-[12px] text-[#5E6066] hover:border-[#8664F2] dark:border-[#2a2a2a] dark:text-[#9ca3af]">
              {showPassed ? <TbChevronDown size={13} /> : <TbChevronRight size={13} />} {passed.length} passed
            </button>
          )}
          {fold && showPassed && passed.map((r) => <ResultCard key={r.id} r={r} />)}
        </div>
      </div>
    </div>
  );
}
