"use client";

import { Fragment, useMemo } from "react";
import { COVERAGE_EPICS, type CoverageTicket } from "@/app/lib/coverage-tickets";

// Same bands as the legend: well covered 80-100, partial 40-79, low under 40.
const band = (c: number) => (c >= 80 ? { name: "good", dot: "bg-[#22C55E]", bar: "bg-[#22C55E]", text: "text-[#16A34A]" } : c >= 40 ? { name: "partial", dot: "bg-[#EAB308]", bar: "bg-[#EAB308]", text: "text-[#CA8A04]" } : { name: "low", dot: "bg-[#EF4444]", bar: "bg-[#EF4444]", text: "text-[#DC2626]" });
const qualityTone = (q: number) => (q >= 80 ? "text-[#16A34A]" : q >= 60 ? "text-[#CA8A04]" : "text-[#DC2626]");
const avg = (xs: number[]) => Math.round(xs.reduce((n, x) => n + x, 0) / xs.length);

const th = "px-4 py-3 text-left text-[11px] font-semibold tracking-[0.08em] text-[#5E6066] uppercase dark:text-[#9ca3af]";

function Row({ t }: { t: CoverageTicket }) {
  const b = band(t.coverage);
  return (
    <tr className="border-b border-[#EEE] hover:bg-[#F8F9FB] dark:border-[#1a1a1a] dark:hover:bg-[#101010]">
      <td className="px-4 py-3 pl-8">
        <div className="flex items-center gap-2 font-medium text-[#1F1F1F] dark:text-[#ededed]">
          <i className={`h-2.5 w-2.5 shrink-0 rounded-full ${b.dot}`} />
          <span className="shrink-0 text-[12px] font-semibold text-[#2563EB]">{t.key}</span>
          <span className="truncate">{t.name}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-[#1F1F1F] dark:text-[#ededed]">{t.tests}</td>
      <td className="px-4 py-3 font-semibold text-[#1F1F1F] dark:text-[#ededed]">{t.passed}</td>
      <td className={`px-4 py-3 font-semibold ${t.tests - t.passed ? "text-[#DC2626]" : "text-[#7E7E7E]"}`}>{t.tests - t.passed}</td>
      <td className="px-4 py-3">
        <div className="w-[130px]">
          <div className="h-[6px] overflow-hidden rounded-full bg-[#E5E7EB] dark:bg-[#2a2a2a]"><div className={`h-full ${b.bar}`} style={{ width: `${t.coverage}%` }} /></div>
          <div className="mt-1 text-[10.5px] text-[#7E7E7E]">{t.coverage}%</div>
        </div>
      </td>
      <td className={`px-4 py-3 font-semibold ${qualityTone(t.quality)}`}>{t.quality}/100</td>
    </tr>
  );
}

/**
 * Coverage per Jira epic and ticket of the Digital Wallet project (hardcoded). Figures are sample data until tests are run.
 * Each epic row is a roll-up of its tickets.
 */
export function CoverageOverview() {
  const tickets = useMemo(() => COVERAGE_EPICS.flatMap((e) => e.tickets), []);
  const overall = useMemo(() => avg(tickets.map((t) => t.coverage)), [tickets]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1 border-b border-[#EEE] px-6 py-3 text-[12px] text-[#5E6066] dark:border-[#1a1a1a] dark:text-[#9ca3af]">
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#22C55E]" /> Well covered (80–100%)</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#EAB308]" /> Partial (40–79%)</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#EF4444]" /> Low (&lt;40%)</span>
        <span className="ml-auto">
          Overall: <b className={`text-[13px] ${band(overall).text}`}>{overall}%</b>
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
        <table className="w-full min-w-[760px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-[#E5E7EB] dark:border-[#2a2a2a]">
              <th className={th}>Epic / Ticket</th>
              <th className={th}>Tests</th>
              <th className={th}>Passed</th>
              <th className={th}>Failed</th>
              <th className={th}>Coverage</th>
              <th className={th}>Quality score</th>
            </tr>
          </thead>
          <tbody>
            {COVERAGE_EPICS.map((e) => {
              const tests = e.tickets.reduce((n, t) => n + t.tests, 0);
              const passed = e.tickets.reduce((n, t) => n + t.passed, 0);
              const cov = avg(e.tickets.map((t) => t.coverage));
              const q = avg(e.tickets.map((t) => t.quality));
              const b = band(cov);
              return (
                <Fragment key={e.key}>
                  <tr className="border-b border-[#E6E1F5] bg-[#F4EFFE]/60 dark:border-[#2a2440] dark:bg-[#1e1a2e]/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 font-semibold text-[#1F1F1F] dark:text-[#ededed]">
                        <span className="h-[10px] w-[10px] shrink-0 rounded-[2px] bg-[#8664F2]" />
                        <span className="shrink-0 text-[12px] text-[#8664F2]">{e.key}</span>
                        <span className="truncate">{e.name}</span>
                        <span className="shrink-0 text-[10.5px] font-medium text-[#7E7E7E]">{e.tickets.length} {e.tickets.length === 1 ? "ticket" : "tickets"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-[#1F1F1F] dark:text-[#ededed]">{tests}</td>
                    <td className="px-4 py-3 font-semibold text-[#1F1F1F] dark:text-[#ededed]">{passed}</td>
                    <td className={`px-4 py-3 font-semibold ${tests - passed ? "text-[#DC2626]" : "text-[#7E7E7E]"}`}>{tests - passed}</td>
                    <td className="px-4 py-3">
                      <div className="w-[130px]">
                        <div className="h-[6px] overflow-hidden rounded-full bg-[#E5E7EB] dark:bg-[#2a2a2a]"><div className={`h-full ${b.bar}`} style={{ width: `${cov}%` }} /></div>
                        <div className="mt-1 text-[10.5px] text-[#7E7E7E]">{cov}%</div>
                      </div>
                    </td>
                    <td className={`px-4 py-3 font-semibold ${qualityTone(q)}`}>{q}/100</td>
                  </tr>
                  {e.tickets.map((t) => (
                    <Row key={t.key} t={t} />
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        <p className="mt-4 text-[11.5px] text-[#7E7E7E]">
          {COVERAGE_EPICS.length} epics · {tickets.length} tickets, from the Digital Wallet Jira project (DW). Tests, passed, coverage and quality are sample figures until these tickets are tested.
        </p>
      </div>
    </div>
  );
}
