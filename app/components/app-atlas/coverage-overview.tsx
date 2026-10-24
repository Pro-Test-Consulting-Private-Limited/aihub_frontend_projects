"use client";

import { Fragment, useMemo, useState } from "react";
import { TbChevronDown, TbChevronRight } from "react-icons/tb";
import { COVERAGE_PAGES, type PageGroup } from "@/app/lib/coverage-pages";

const GROUPS: PageGroup[] = ["Public", "Customer", "Admin"];
// Same bands as the legend: well covered 80-100, partial 40-79, low under 40.
const band = (c: number) => (c >= 80 ? { name: "good", dot: "bg-[#22C55E]", bar: "bg-[#22C55E]", text: "text-[#16A34A]" } : c >= 40 ? { name: "partial", dot: "bg-[#EAB308]", bar: "bg-[#EAB308]", text: "text-[#CA8A04]" } : { name: "low", dot: "bg-[#EF4444]", bar: "bg-[#EF4444]", text: "text-[#DC2626]" });
const qualityTone = (q: number) => (q >= 80 ? "text-[#16A34A]" : q >= 60 ? "text-[#CA8A04]" : "text-[#DC2626]");

const th = "px-4 py-3 text-left text-[11px] font-semibold tracking-[0.08em] text-[#5E6066] uppercase dark:text-[#9ca3af]";

/**
 * Coverage per screen of the app under test: the screens and elements come from the Digital Wallet spec; the test figures are
 * sample data until pages are tested. Rows open to show the elements the spec lists on that page.
 */
export function CoverageOverview() {
  const [open, setOpen] = useState<string | null>(null);
  const overall = useMemo(() => Math.round(COVERAGE_PAGES.reduce((n, p) => n + p.coverage, 0) / COVERAGE_PAGES.length), []);
  const objects = COVERAGE_PAGES.reduce((n, p) => n + p.elements.length, 0);

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
        <table className="w-full min-w-[860px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-[#E5E7EB] dark:border-[#2a2a2a]">
              <th className={th}>Screen</th>
              <th className={th}>URL</th>
              <th className={th}>Page objects</th>
              <th className={th}>Tests</th>
              <th className={th}>Passed</th>
              <th className={th}>Failed</th>
              <th className={th}>Coverage</th>
              <th className={th}>Quality score</th>
            </tr>
          </thead>
          <tbody>
            {GROUPS.map((g) => (
              <Fragment key={g}>
                <tr>
                  <td colSpan={8} className="pt-4 pb-1.5 pl-4 text-[10.5px] font-semibold tracking-[0.1em] text-[#8664F2] uppercase">{g}</td>
                </tr>
                {COVERAGE_PAGES.filter((p) => p.group === g).map((p) => {
                  const b = band(p.coverage);
                  const isOpen = open === p.url;
                  return (
                    <Fragment key={p.url}>
                      <tr className="cursor-pointer border-b border-[#EEE] hover:bg-[#F8F9FB] dark:border-[#1a1a1a] dark:hover:bg-[#101010]" onClick={() => setOpen(isOpen ? null : p.url)}>
                        <td className="px-4 py-3">
                          <button type="button" aria-expanded={isOpen} aria-label={`${isOpen ? "Hide" : "Show"} the elements of ${p.screen}`} className="flex items-center gap-2 text-left font-medium text-[#1F1F1F] dark:text-[#ededed]">
                            {isOpen ? <TbChevronDown size={13} className="text-[#7E7E7E]" /> : <TbChevronRight size={13} className="text-[#7E7E7E]" />}
                            <i className={`h-2.5 w-2.5 shrink-0 rounded-full ${b.dot}`} /> {p.screen}
                          </button>
                        </td>
                        <td className="px-4 py-3 font-mono text-[12px] text-[#7E7E7E]">{p.url}</td>
                        <td className="px-4 py-3 font-semibold text-[#2563EB]">{p.elements.length}</td>
                        <td className="px-4 py-3 text-[#1F1F1F] dark:text-[#ededed]">{p.tests}</td>
                        <td className="px-4 py-3 font-semibold text-[#1F1F1F] dark:text-[#ededed]">{p.passed}</td>
                        <td className={`px-4 py-3 font-semibold ${p.tests - p.passed ? "text-[#DC2626]" : "text-[#7E7E7E]"}`}>{p.tests - p.passed}</td>
                        <td className="px-4 py-3">
                          <div className="w-[130px]">
                            <div className="h-[6px] overflow-hidden rounded-full bg-[#E5E7EB] dark:bg-[#2a2a2a]"><div className={`h-full ${b.bar}`} style={{ width: `${p.coverage}%` }} /></div>
                            <div className="mt-1 text-[10.5px] text-[#7E7E7E]">{p.coverage}%</div>
                          </div>
                        </td>
                        <td className={`px-4 py-3 font-semibold ${qualityTone(p.quality)}`}>{p.quality}/100</td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b border-[#EEE] bg-[#F8F9FB] dark:border-[#1a1a1a] dark:bg-[#101010]">
                          <td colSpan={8} className="px-10 py-3">
                            <div className="mb-1.5 text-[10.5px] font-semibold tracking-wide text-[#5E6066] uppercase dark:text-[#9ca3af]">Elements on this page (from the spec)</div>
                            <ul className="grid gap-x-8 gap-y-1 text-[12.5px] text-[#1F1F1F] sm:grid-cols-2 dark:text-[#ededed]">
                              {p.elements.map((e) => (
                                <li key={e} className="flex items-start gap-2"><span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#8664F2]" />{e}</li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
        <p className="mt-4 text-[11.5px] text-[#7E7E7E]">
          {COVERAGE_PAGES.length} screens · {objects} page objects, taken from the Digital Wallet specification. Tests, passed, coverage and quality are sample figures until these pages are tested.
        </p>
      </div>
    </div>
  );
}
