"use client";

import { useEffect, useMemo, useState } from "react";
import { TbLoader2, TbReportSearch } from "react-icons/tb";
import type { SitEpic } from "@/app/interfaces/appatlas";
import {
  EISENHOWER_CHIP,
  EISENHOWER_LABEL,
  EISENHOWER_MEANING,
  type EisenhowerQ,
} from "@/app/lib/sit-eisenhower";
import type { AtlasClient } from "@/app/services/appatlas";

const CASE_TARGET = 8;
const DEPTH_TYPES = ["Positive", "Negative", "Boundary", "Validation", "Business Rule", "Concurrency"] as const;
const TYPE_COUNT = DEPTH_TYPES.length;

type SitCov = {
  tests: number;
  byType: Record<string, number>;
  byPriority?: Record<string, number>;
  bySeverity?: Record<string, number>;
  byQuadrant?: Record<string, number>;
  byExecutionStatus?: Record<string, number>;
  notAssessed?: number;
  deadFlags?: number;
  workbookId?: string;
  summary?: string | null;
};

type TicketRow = {
  key: string;
  name: string;
  tests: number;
  depth: number;
  byPriority: Record<string, number>;
  bySeverity: Record<string, number>;
  byQuadrant: Record<string, number>;
  byExecutionStatus: Record<string, number>;
  deadFlags: number;
};

const card = "rounded-[10px] border border-[#E5E7EB] bg-white dark:border-[#2a2a2a] dark:bg-[#0f0f0f]";
const label = "text-[11px] font-semibold tracking-[0.08em] text-[#5E6066] uppercase dark:text-[#9ca3af]";

function testDepthPct(tests: number, byType: Record<string, number>) {
  if (!tests) return 0;
  const present = DEPTH_TYPES.filter((t) => (byType[t] || 0) > 0).length;
  return Math.round(40 * Math.min(1, tests / CASE_TARGET) + 60 * (present / TYPE_COUNT));
}

function band(depth: number) {
  if (depth >= 70) return { text: "text-[#16A34A]", bar: "bg-[#22C55E]" };
  if (depth >= 40) return { text: "text-[#CA8A04]", bar: "bg-[#EAB308]" };
  return { text: "text-[#DC2626]", bar: "bg-[#EF4444]" };
}

function sumMap(m: Record<string, number> | undefined) {
  return Object.values(m || {}).reduce((a, b) => a + b, 0);
}

function Kpi({ value, name, note, tone }: { value: string; name: string; note: string; tone?: string }) {
  return (
    <div className={`${card} px-4 py-3`}>
      <div className={`text-[26px] leading-none font-semibold ${tone || "text-[#1F1F1F] dark:text-[#ededed]"}`}>{value}</div>
      <div className={`${label} mt-2`}>{name}</div>
      <div className="mt-1 text-[11.5px] text-[#7E7E7E]">{note}</div>
    </div>
  );
}

/**
 * Reports strip v0 — same numbers as Coverage (Test depth, Prio/Sev, Eisenhower, status).
 * No new engine; read-only rollup for stakeholders / release glance.
 */
export function ReportsView({
  client,
  canvasId,
  onOpenCoverage,
  onOpenSit,
}: {
  client: AtlasClient;
  canvasId: string | null;
  onOpenCoverage?: () => void;
  onOpenSit?: (opts?: { workbookId?: string; ticketKey?: string }) => void;
}) {
  const [epics, setEpics] = useState<SitEpic[]>([]);
  const [sit, setSit] = useState<Record<string, SitCov>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void Promise.all([
      client.listSitTickets(canvasId),
      client.sitCoverage(canvasId).catch(() => ({ tickets: {} as Record<string, SitCov> })),
    ])
      .then(([tickets, cov]) => {
        if (cancelled) return;
        setEpics(tickets.epics || []);
        setSit((cov.tickets || {}) as Record<string, SitCov>);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load reports");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client, canvasId]);

  const rows: TicketRow[] = useMemo(() => {
    const known = new Set<string>();
    const out: TicketRow[] = [];
    for (const e of epics) {
      for (const t of e.tickets) {
        known.add(t.key);
        const s = sit[t.key];
        const byType = s?.byType || {};
        const tests = s?.tests || 0;
        out.push({
          key: t.key,
          name: t.summary,
          tests,
          depth: testDepthPct(tests, byType),
          byPriority: s?.byPriority || {},
          bySeverity: s?.bySeverity || {},
          byQuadrant: s?.byQuadrant || {},
          byExecutionStatus: s?.byExecutionStatus || {},
          deadFlags: s?.deadFlags || 0,
        });
      }
    }
    for (const [key, s] of Object.entries(sit)) {
      if (known.has(key)) continue;
      const byType = s.byType || {};
      out.push({
        key,
        name: s.summary || key,
        tests: s.tests || 0,
        depth: testDepthPct(s.tests || 0, byType),
        byPriority: s.byPriority || {},
        bySeverity: s.bySeverity || {},
        byQuadrant: s.byQuadrant || {},
        byExecutionStatus: s.byExecutionStatus || {},
        deadFlags: s.deadFlags || 0,
      });
    }
    return out;
  }, [epics, sit]);

  const totals = useMemo(() => {
    const cases = rows.reduce((n, r) => n + r.tests, 0);
    const withCases = rows.filter((r) => r.tests > 0);
    const avgDepth = withCases.length
      ? Math.round(withCases.reduce((n, r) => n + r.depth, 0) / withCases.length)
      : 0;
    const prio: Record<string, number> = {};
    const sev: Record<string, number> = {};
    const quad: Record<string, number> = {};
    const status: Record<string, number> = {};
    let dead = 0;
    let notAssessed = 0;
    for (const r of rows) {
      for (const [k, v] of Object.entries(r.byPriority)) prio[k] = (prio[k] || 0) + v;
      for (const [k, v] of Object.entries(r.bySeverity)) sev[k] = (sev[k] || 0) + v;
      for (const [k, v] of Object.entries(r.byQuadrant)) quad[k] = (quad[k] || 0) + v;
      for (const [k, v] of Object.entries(r.byExecutionStatus)) status[k] = (status[k] || 0) + v;
      dead += r.deadFlags;
    }
    for (const s of Object.values(sit)) notAssessed += s.notAssessed || 0;
    return { cases, avgDepth, prio, sev, quad, status, dead, notAssessed, tickets: rows.length, covered: withCases.length };
  }, [rows, sit]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-[13px] text-[#7E7E7E]">
        <TbLoader2 className="animate-spin" size={16} /> Loading reports…
      </div>
    );
  }

  if (error) {
    return <div className="p-6 text-[13px] text-[#DC2626]">{error}</div>;
  }

  const qKeys = (["Q1", "Q2", "Q3", "Q4"] as const).filter((q) => (totals.quad[q] || 0) > 0 || true);

  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[15px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">
            <TbReportSearch size={18} className="text-[#8664F2]" />
            Reports
          </div>
          <p className="mt-1 max-w-[640px] text-[12.5px] text-[#5E6066] dark:text-[#9ca3af]">
            Strip from Coverage — Test depth, Priority / Severity, Eisenhower, and case status. No new
            engine; open Coverage for the full matrix.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onOpenCoverage && (
            <button
              type="button"
              onClick={onOpenCoverage}
              className="rounded-[8px] border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12px] font-medium text-[#1F1F1F] hover:border-[#8664F2] dark:border-[#2a2a2a] dark:bg-[#141414] dark:text-[#ededed]"
            >
              Open Coverage
            </button>
          )}
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          value={String(totals.cases)}
          name="Cases"
          note={`${totals.covered} of ${totals.tickets} mapped tickets have suites`}
        />
        <Kpi
          value={totals.covered ? `${totals.avgDepth}%` : "—"}
          name="Avg test depth"
          note={`Volume + type mix vs ${CASE_TARGET} cases / ${TYPE_COUNT} types`}
          tone={band(totals.avgDepth).text}
        />
        <Kpi
          value={String(totals.prio.High || 0)}
          name="High priority"
          note={`Med ${totals.prio.Medium || 0} · Low ${totals.prio.Low || 0}${totals.notAssessed ? ` · ${totals.notAssessed} not assessed` : ""}`}
          tone="text-[#B91C1C]"
        />
        <Kpi
          value={String(totals.sev.High || 0)}
          name="High severity"
          note={`Med ${totals.sev.Medium || 0} · Low ${totals.sev.Low || 0}`}
          tone="text-[#B91C1C]"
        />
      </div>

      <div className="mb-5 grid gap-3 lg:grid-cols-2">
        <section className={`${card} p-4`}>
          <div className={label}>Eisenhower (from Prio × Sev)</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {qKeys.map((q) => (
              <div
                key={q}
                className={`min-w-[120px] flex-1 rounded-[8px] border px-3 py-2 ${EISENHOWER_CHIP[q as EisenhowerQ]}`}
                title={EISENHOWER_MEANING[q]}
              >
                <div className="text-[11px] font-semibold">
                  {q} · {EISENHOWER_LABEL[q]}
                </div>
                <div className="mt-0.5 text-[20px] font-semibold tabular-nums">{totals.quad[q] || 0}</div>
                <div className="text-[10.5px] opacity-80">{EISENHOWER_MEANING[q]}</div>
              </div>
            ))}
          </div>
          {(totals.quad.Untriaged || 0) > 0 && (
            <p className="mt-2 text-[11.5px] text-[#7E7E7E]">{totals.quad.Untriaged} untriaged (not assessed)</p>
          )}
        </section>

        <section className={`${card} p-4`}>
          <div className={label}>Execution status</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {["Draft", "Passed", "Failed", "Blocked", "Skipped"].map((s) => (
              <div
                key={s}
                className="rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-2.5 py-1 text-[12px] dark:border-[#2a2a2a] dark:bg-[#141414]"
              >
                <span className="font-semibold text-[#1F1F1F] dark:text-[#ededed]">{totals.status[s] || 0}</span>
                <span className="ml-1 text-[#7E7E7E]">{s}</span>
              </div>
            ))}
          </div>
          {totals.dead > 0 && (
            <p className="mt-3 text-[12px] text-[#92400E]">
              Dead Test Finder flagged <b>{totals.dead}</b> case{totals.dead === 1 ? "" : "s"} — open SIT Results to filter.
            </p>
          )}
          {sumMap(totals.status) === 0 && (
            <p className="mt-3 text-[12px] text-[#7E7E7E]">No manual status set yet. Mark cases on SIT Testing.</p>
          )}
        </section>
      </div>

      <section className={`${card} overflow-hidden`}>
        <div className="border-b border-[#EEE] px-4 py-3 dark:border-[#1a1a1a]">
          <div className={label}>By ticket</div>
          <p className="mt-1 text-[11.5px] text-[#7E7E7E]">Test depth and Priority / Severity counts from the current canvas suites.</p>
        </div>
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-[13px] text-[#7E7E7E]">
            No mapped Jira tickets on this canvas yet. Connect Jira, map tickets, generate SIT suites, then return here.
          </p>
        ) : (
          <div className="max-h-[420px] overflow-auto">
            <table className="min-w-full border-collapse text-[12.5px]">
              <thead className="sticky top-0 bg-[#F8F9FB] text-left text-[11px] text-[#5E6066] dark:bg-[#141414] dark:text-[#9ca3af]">
                <tr>
                  <th className="px-4 py-2 font-semibold">Ticket</th>
                  <th className="px-3 py-2 font-semibold">Cases</th>
                  <th className="px-3 py-2 font-semibold">Test depth</th>
                  <th className="px-3 py-2 font-semibold">Priority</th>
                  <th className="px-3 py-2 font-semibold">Severity</th>
                  <th className="px-3 py-2 font-semibold">Dead</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const b = band(r.depth);
                  return (
                    <tr key={r.key} className="border-t border-[#EEE] dark:border-[#1a1a1a]">
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          className="text-left"
                          onClick={() => onOpenSit?.({ ticketKey: r.key, workbookId: sit[r.key]?.workbookId })}
                          disabled={!onOpenSit || !r.tests}
                          title={r.tests ? "Open in SIT" : undefined}
                        >
                          <span className="font-semibold text-[#2563EB]">{r.key}</span>
                          <span className="ml-2 text-[#1F1F1F] dark:text-[#ededed]">{r.name}</span>
                        </button>
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">{r.tests || "—"}</td>
                      <td className="px-3 py-2.5">
                        {r.tests ? (
                          <div className="flex items-center gap-2">
                            <div className="h-[6px] w-[72px] overflow-hidden rounded-full bg-[#E5E7EB] dark:bg-[#2a2a2a]">
                              <div className={`h-full ${b.bar}`} style={{ width: `${r.depth}%` }} />
                            </div>
                            <span className={`tabular-nums font-semibold ${b.text}`}>{r.depth}%</span>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-[11.5px] text-[#5E6066]">
                        {r.tests
                          ? `H ${r.byPriority.High || 0} · M ${r.byPriority.Medium || 0} · L ${r.byPriority.Low || 0}`
                          : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-[11.5px] text-[#5E6066]">
                        {r.tests
                          ? `H ${r.bySeverity.High || 0} · M ${r.bySeverity.Medium || 0} · L ${r.bySeverity.Low || 0}`
                          : "—"}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {r.deadFlags > 0 ? (
                          <span className="rounded border border-[#fcd34d] bg-[#fffbeb] px-1.5 py-0.5 text-[11px] font-semibold text-[#92400e]">
                            {r.deadFlags}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
