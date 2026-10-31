"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { TbLoader2, TbSparkles } from "react-icons/tb";
import type { SitEpic } from "@/app/interfaces/appatlas";
import type { AtlasClient } from "@/app/services/appatlas";

const band = (c: number) =>
  c >= 80
    ? { name: "good", dot: "bg-[#22C55E]", bar: "bg-[#22C55E]", text: "text-[#16A34A]" }
    : c >= 40
      ? { name: "partial", dot: "bg-[#EAB308]", bar: "bg-[#EAB308]", text: "text-[#CA8A04]" }
      : { name: "low", dot: "bg-[#EF4444]", bar: "bg-[#EF4444]", text: "text-[#DC2626]" };

const th =
  "px-4 py-3 text-left text-[11px] font-semibold tracking-[0.08em] text-[#5E6066] uppercase dark:text-[#9ca3af]";

/** Score from type mix: reward Positive+Negative+Boundary coverage. */
function qualityFromTypes(byType: Record<string, number>, tests: number) {
  if (!tests) return 0;
  const kinds = Object.keys(byType).length;
  const hasPos = (byType.Positive || 0) > 0;
  const hasNeg = (byType.Negative || 0) > 0;
  const hasEdge = (byType.Boundary || 0) + (byType.Concurrency || 0) > 0;
  let q = Math.min(100, tests * 6 + kinds * 8);
  if (hasPos && hasNeg) q += 10;
  if (hasEdge) q += 8;
  return Math.min(100, Math.round(q));
}

function coveragePct(tests: number) {
  if (!tests) return 0;
  // Rough until executions exist: 8+ solid cases ≈ well covered for a story.
  return Math.min(100, Math.round((tests / 8) * 100));
}

type Row = {
  key: string;
  name: string;
  tests: number;
  byType: Record<string, number>;
  quality: number;
  coverage: number;
  generator?: string;
};

export function CoverageOverview({
  client,
  canvasId,
}: {
  client: AtlasClient;
  canvasId: string | null;
}) {
  const [epics, setEpics] = useState<SitEpic[]>([]);
  const [sit, setSit] = useState<
    Record<string, { tests: number; byType: Record<string, number>; generator: string; updatedAt: number }>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tickets, cov] = await Promise.all([client.listSitTickets(canvasId), client.sitCoverage(canvasId)]);
      setEpics(tickets.epics);
      setSit(cov.tickets);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load coverage");
    } finally {
      setLoading(false);
    }
  }, [client, canvasId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const rowsByEpic = useMemo(() => {
    return epics.map((e) => {
      const tickets: Row[] = e.tickets.map((t) => {
        const s = sit[t.key];
        const tests = s?.tests || 0;
        const byType = s?.byType || {};
        return {
          key: t.key,
          name: t.summary,
          tests,
          byType,
          coverage: coveragePct(tests),
          quality: qualityFromTypes(byType, tests),
          generator: s?.generator,
        };
      });
      return { epic: e, tickets };
    });
  }, [epics, sit]);

  const flat = rowsByEpic.flatMap((x) => x.tickets);
  const overall = flat.length ? Math.round(flat.reduce((n, t) => n + t.coverage, 0) / flat.length) : 0;
  const missing = flat.filter((t) => !t.tests).map((t) => t.key);

  const generateAll = async () => {
    const keys = flat.map((t) => t.key);
    if (!keys.length) return;
    setGenerating(true);
    setError(null);
    try {
      await client.generateSitWorkbook({ issueKeys: keys, canvasId });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generate all failed");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 border-b border-[#EEE] px-6 py-3 text-[12px] text-[#5E6066] dark:border-[#1a1a1a] dark:text-[#9ca3af]">
        <span className="flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 rounded-full bg-[#22C55E]" /> Well covered (80–100%)
        </span>
        <span className="flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 rounded-full bg-[#EAB308]" /> Partial (40–79%)
        </span>
        <span className="flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 rounded-full bg-[#EF4444]" /> Low (&lt;40%)
        </span>
        <span className="ml-auto flex items-center gap-3">
          Overall: <b className={`text-[13px] ${band(overall).text}`}>{overall}%</b>
          <button
            type="button"
            disabled={generating || !flat.length}
            onClick={() => void generateAll()}
            className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#8664F2] px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-40"
          >
            {generating ? <TbLoader2 className="animate-spin" size={14} /> : <TbSparkles size={14} />}
            {missing.length && missing.length < flat.length
              ? `Generate missing (${missing.length})`
              : `Generate SIT for all (${flat.length})`}
          </button>
        </span>
      </header>

      {error && (
        <div className="mx-6 mt-3 rounded-[8px] border border-[#f5c2c7] bg-[#fff5f5] px-3 py-2 text-[12.5px] text-[#b42318]">
          {error}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center gap-2 text-[13px] text-[#8a93a8]">
            <TbLoader2 className="animate-spin" /> Loading coverage…
          </div>
        ) : (
          <>
            <table className="w-full min-w-[820px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-[#E5E7EB] dark:border-[#2a2a2a]">
                  <th className={th}>Epic / Ticket</th>
                  <th className={th}>SIT cases</th>
                  <th className={th}>Types</th>
                  <th className={th}>Coverage</th>
                  <th className={th}>Quality</th>
                  <th className={th}>Source</th>
                </tr>
              </thead>
              <tbody>
                {rowsByEpic.map(({ epic, tickets }) => {
                  const tests = tickets.reduce((n, t) => n + t.tests, 0);
                  const cov = tickets.length
                    ? Math.round(tickets.reduce((n, t) => n + t.coverage, 0) / tickets.length)
                    : 0;
                  const q = tickets.length
                    ? Math.round(tickets.reduce((n, t) => n + t.quality, 0) / tickets.length)
                    : 0;
                  const b = band(cov);
                  return (
                    <Fragment key={epic.key}>
                      <tr className="border-b border-[#E6E1F5] bg-[#F4EFFE]/60 dark:border-[#2a2440] dark:bg-[#1e1a2e]/60">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 font-semibold text-[#1F1F1F] dark:text-[#ededed]">
                            <span className="h-[10px] w-[10px] shrink-0 rounded-[2px] bg-[#8664F2]" />
                            <span className="shrink-0 text-[12px] text-[#8664F2]">
                              {epic.key !== "_unassigned" ? epic.key : "—"}
                            </span>
                            <span className="truncate">{epic.summary}</span>
                            <span className="shrink-0 text-[10.5px] font-medium text-[#7E7E7E]">
                              {tickets.length} tickets
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-semibold">{tests}</td>
                        <td className="px-4 py-3 text-[#7E7E7E]">—</td>
                        <td className="px-4 py-3">
                          <div className="w-[130px]">
                            <div className="h-[6px] overflow-hidden rounded-full bg-[#E5E7EB] dark:bg-[#2a2a2a]">
                              <div className={`h-full ${b.bar}`} style={{ width: `${cov}%` }} />
                            </div>
                            <div className="mt-1 text-[10.5px] text-[#7E7E7E]">{cov}%</div>
                          </div>
                        </td>
                        <td className={`px-4 py-3 font-semibold ${band(q).text}`}>{q}/100</td>
                        <td className="px-4 py-3 text-[#7E7E7E]">roll-up</td>
                      </tr>
                      {tickets.map((t) => {
                        const tb = band(t.coverage);
                        return (
                          <tr
                            key={t.key}
                            className="border-b border-[#EEE] hover:bg-[#F8F9FB] dark:border-[#1a1a1a] dark:hover:bg-[#101010]"
                          >
                            <td className="px-4 py-3 pl-8">
                              <div className="flex items-center gap-2 font-medium text-[#1F1F1F] dark:text-[#ededed]">
                                <i className={`h-2.5 w-2.5 shrink-0 rounded-full ${tb.dot}`} />
                                <span className="shrink-0 text-[12px] font-semibold text-[#2563EB]">{t.key}</span>
                                <span className="truncate">{t.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">{t.tests}</td>
                            <td className="px-4 py-3 text-[11px] text-[#5E6066] dark:text-[#9ca3af]">
                              {Object.entries(t.byType)
                                .map(([k, v]) => `${k} ${v}`)
                                .join(" · ") || "—"}
                            </td>
                            <td className="px-4 py-3">
                              <div className="w-[130px]">
                                <div className="h-[6px] overflow-hidden rounded-full bg-[#E5E7EB] dark:bg-[#2a2a2a]">
                                  <div className={`h-full ${tb.bar}`} style={{ width: `${t.coverage}%` }} />
                                </div>
                                <div className="mt-1 text-[10.5px] text-[#7E7E7E]">{t.coverage}%</div>
                              </div>
                            </td>
                            <td className={`px-4 py-3 font-semibold ${band(t.quality).text}`}>{t.quality}/100</td>
                            <td className="px-4 py-3 text-[11px] text-[#7E7E7E]">{t.generator || "not generated"}</td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-4 text-[11.5px] text-[#7E7E7E]">
              Coverage here is driven by SIT-generated test cases (Positive / Negative / Boundary / …). Run Generate on
              SIT Testing or use Generate for all above. Execution pass/fail can replace the quality heuristic later.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
