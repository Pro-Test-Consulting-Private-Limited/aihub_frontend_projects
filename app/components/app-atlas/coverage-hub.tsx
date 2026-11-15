"use client";

import { useEffect, useMemo, useState } from "react";
import type { Canvas, SitWorkbook } from "@/app/interfaces/appatlas";
import type { SpecEndpoint } from "@/app/interfaces/api-testing";
import type { AtlasClient } from "@/app/services/appatlas";
import {
  a11yRollup,
  blastRadius,
  epicReady,
  liveAcForTickets,
  linkAcToCases,
  openApiGaps,
  smokeDeep,
  suiteDrift,
  undocumentedAndZombie,
  verifiedPct,
  weightedGapScore,
  type LiveAcRow,
} from "@/app/lib/coverage-gaps";

type TicketRow = {
  key: string;
  name: string;
  tests: number;
  depth: number;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
  byExecutionStatus: Record<string, number>;
  workbookId?: string;
  generatedAt: number | null;
};

type EpicBlock = {
  epic: { key: string; summary: string };
  tickets: TicketRow[];
};

type Props = {
  client: AtlasClient;
  canvas: Canvas | null;
  endpoints: SpecEndpoint[];
  rowsByEpic: EpicBlock[];
  onOpenSit?: (opts?: { workbookId?: string; ticketKey?: string }) => void;
  onFocusNode?: (nodeId: string) => void;
};

const CONTROLS = ["OTP", "login", "transfer", "register", "payment", "KYC"];

export function CoverageHub({ client, canvas, endpoints, rowsByEpic, onOpenSit, onFocusNode }: Props) {
  const [blastControl, setBlastControl] = useState("OTP");
  const [caseIndex, setCaseIndex] = useState<Record<string, Array<{ id: string; scenario: string; steps?: string }>>>({});
  const [deviceRows, setDeviceRows] = useState<Array<{ key: string; label: string; screens: number; canvases: number }>>([]);
  const [driftMsg, setDriftMsg] = useState("Loading suite history…");
  const [expandedAc, setExpandedAc] = useState<string | null>(null);

  const flat = useMemo(() => rowsByEpic.flatMap((e) => e.tickets), [rowsByEpic]);
  const jira = canvas?.jira ?? null;
  const nodes = canvas?.nodes ?? [];

  const liveRows: LiveAcRow[] = useMemo(() => {
    if (!jira) return [];
    return liveAcForTickets({
      issues: jira.issues.filter((i) => i.level !== 1),
      coverage: jira.coverage || {},
      nodeMatches: jira.nodes || {},
      nodes: nodes.map((n) => ({ id: n.id, title: n.title, path: n.path })),
    });
  }, [jira, nodes]);

  const liveByKey = useMemo(() => new Map(liveRows.map((r) => [r.key, r])), [liveRows]);

  const ops = useMemo(
    () =>
      endpoints.map((e) => ({
        key: `${e.method.toUpperCase()} ${e.path}`,
        method: e.method.toUpperCase(),
        path: e.path,
      })),
    [endpoints],
  );

  const apiGaps = useMemo(() => {
    if (!ops.length) return null;
    return openApiGaps({
      tickets: flat.map((t) => ({
        key: t.key,
        summary: t.name,
        acs: (jira?.issues.find((i) => i.key === t.key)?.acceptanceCriteria || []) as string[],
      })),
      ops,
    });
  }, [flat, ops, jira]);

  const surface = useMemo(() => {
    if (!jira) return null;
    return undocumentedAndZombie({
      nodes: nodes.map((n) => ({
        id: n.id,
        title: n.title,
        path: n.path,
        stateCount: n.stateCount,
        screenshotUrl: n.screenshotUrl,
      })),
      nodeMatches: jira.nodes || {},
      coverage: jira.coverage || {},
      issueKeys: jira.issues.filter((i) => i.level !== 1).map((i) => i.key),
    });
  }, [jira, nodes]);

  const a11y = useMemo(() => a11yRollup(nodes), [nodes]);

  const blast = useMemo(
    () =>
      blastRadius({
        control: blastControl,
        ops,
        tickets: flat.map((t) => ({
          key: t.key,
          summary: t.name,
          acs: (jira?.issues.find((i) => i.key === t.key)?.acceptanceCriteria || []) as string[],
        })),
        nodes: nodes.map((n) => ({ id: n.id, title: n.title, path: n.path })),
        dependsOn: Object.fromEntries(
          ((canvas as { swaggerChain?: { dependencies?: { endpoints?: Array<{ key: string; dependsOn?: string[] }> } } })?.swaggerChain
            ?.dependencies?.endpoints || []).map((e) => [e.key, e.dependsOn || []]),
        ),
      }),
    [blastControl, ops, flat, jira, nodes, canvas],
  );

  const kpis = useMemo(() => {
    const withTests = flat.filter((t) => t.tests > 0);
    const verifiedAvg = withTests.length
      ? Math.round(withTests.reduce((n, t) => n + verifiedPct(t.byExecutionStatus, t.tests), 0) / withTests.length)
      : 0;
    const smokeCovered = flat.filter((t) => smokeDeep(t.byType).smokeCovered).length;
    const missingAc = liveRows.filter((r) => r.total > 0 && r.observed < r.total).length;
    const noScreen = liveRows.filter((r) => !r.screenIds.length).length;
    const weighted = flat
      .map((t) => {
        const live = liveByKey.get(t.key);
        const miss = live && live.total ? (live.total - live.observed) / live.total : 0;
        return weightedGapScore({ byPriority: t.byPriority, depth: t.depth, missingAcRatio: miss });
      })
      .sort((a, b) => b - a);
    return {
      verifiedAvg,
      smokePct: flat.length ? Math.round((100 * smokeCovered) / flat.length) : 0,
      missingAc,
      noScreen,
      topWeighted: weighted[0] ?? 0,
      apiTicketGaps: apiGaps?.ticketNoOp.length ?? 0,
      apiOpGaps: apiGaps?.opNoTicket.length ?? 0,
    };
  }, [flat, liveRows, liveByKey, apiGaps]);

  const epicBadges = useMemo(() => {
    return rowsByEpic
      .filter((e) => e.epic.key !== "_saved" && e.epic.key !== "_unassigned")
      .map((e) => {
        const children = e.tickets.map((t) => {
          const live = liveByKey.get(t.key);
          return {
            depth: t.depth,
            acObserved: live?.observed ?? 0,
            acTotal: live?.total ?? 0,
          };
        });
        const r = epicReady({ children });
        return { key: e.epic.key, summary: e.epic.summary, ...r };
      });
  }, [rowsByEpic, liveByKey]);

  useEffect(() => {
    let cancelled = false;
    void client
      .listCanvases({ limit: 200 })
      .then((list) => {
        if (cancelled) return;
        const host = canvas?.host;
        const by: Record<string, { key: string; label: string; screens: number; canvases: number }> = {};
        for (const c of list || []) {
          if (host && c.host && c.host !== host) continue;
          const dp = c.deviceProfile;
          if (!dp?.key) continue;
          const cur = by[dp.key] || {
            key: dp.key,
            label: `${dp.label} · ${dp.width}×${dp.height}`,
            screens: 0,
            canvases: 0,
          };
          cur.screens += Number(c.screens || 0);
          cur.canvases += 1;
          by[dp.key] = cur;
        }
        setDeviceRows(Object.values(by).sort((a, b) => b.screens - a.screens));
      })
      .catch(() => {
        if (!cancelled) setDeviceRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [client, canvas?.host]);

  useEffect(() => {
    if (!canvas?.id) {
      setDriftMsg("Select a canvas for suite drift.");
      return;
    }
    let cancelled = false;
    void client
      .listSitWorkbooks(canvas.id)
      .then(async (res) => {
        const items = res.items || [];
        const detailed: Array<{ id: string; generatedAt?: number | null; createdAt: number; caseCount: number; issueKeys: string[] }> = [];
        const byKeyAll: Record<string, Array<{ id: string; scenario: string; steps?: string }>> = {};
        for (const w of items.slice(0, 8)) {
          let caseCount = 0;
          try {
            const full = await client.getSitWorkbook(w.id);
            const sheet = full.sheets.find((s) => s.kind === "test-cases") || full.sheets[0];
            caseCount = sheet?.rows.length || 0;
            for (const r of sheet?.rows || []) {
              const req = r.cells.requirementId || r.cells.issueKey || "";
              if (!req) continue;
              (byKeyAll[req] ||= []).push({
                id: r.cells.tcId || r.id,
                scenario: r.cells.scenario || "",
                steps: r.cells.steps || r.cells.expected || "",
              });
            }
          } catch {
            /* ignore */
          }
          detailed.push({
            id: w.id,
            generatedAt: w.generatedAt,
            createdAt: w.createdAt,
            caseCount,
            issueKeys: w.sourceIssueKeys || [],
          });
        }
        if (!cancelled) {
          setCaseIndex(byKeyAll);
          setDriftMsg(suiteDrift(detailed).message);
        }
      })
      .catch(() => {
        if (!cancelled) setDriftMsg("Suite history unavailable.");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per canvas
  }, [client, canvas?.id]);

  const missingLive = liveRows.filter((r) => r.missing.length > 0).slice(0, 12);
  const noScreen = liveRows.filter((r) => !r.screenIds.length).slice(0, 8);

  return (
    <div className="mb-6 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {[
          {
            label: "Verified %",
            value: `${kpis.verifiedAvg}%`,
            tip: "Share of cases marked Passed (manual SIT status until Verify-lite walk).",
          },
          { label: "Smoke-covered tickets", value: `${kpis.smokePct}%`, tip: "Tickets with ≥1 Positive (smoke) case." },
          { label: "AC gaps", value: String(kpis.missingAc), tip: "Tickets with acceptance criteria missing on mapped screens." },
          { label: "No screen", value: String(kpis.noScreen), tip: "Tickets with no canvas screen mapping." },
          {
            label: "API ticket gaps",
            value: String(kpis.apiTicketGaps),
            tip: ops.length ? "Tickets with no matched OpenAPI operation (token join)." : "Connect Swagger to enable.",
          },
          { label: "Top weighted gap", value: String(kpis.topWeighted), tip: "Priority × (missing AC + thin test depth)." },
        ].map((c) => (
          <div
            key={c.label}
            title={c.tip}
            className="rounded-[10px] border border-[#e2e6ef] bg-white px-3 py-2.5 dark:border-[#1a1a1a] dark:bg-[#101010]"
          >
            <div className="text-[10px] font-semibold uppercase tracking-wide text-[#9ca3af]">{c.label}</div>
            <div className="mt-0.5 text-[18px] font-semibold tabular-nums text-[#1F1F1F] dark:text-[#ededed]">{c.value}</div>
          </div>
        ))}
      </div>

      <p className="rounded-[8px] border border-[#e8e4f8] bg-[#f8f6ff] px-3 py-2 text-[12px] text-[#5b4a9a] dark:border-[#2a2440] dark:bg-[#14101f] dark:text-[#c4b5fd]">
        Suite drift: {driftMsg}
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[10px] border border-[#e2e6ef] bg-white p-3 dark:border-[#1a1a1a] dark:bg-[#101010]">
          <h3 className="text-[13px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">Live coverage · missing ACs</h3>
          <p className="mt-0.5 text-[11px] text-[#8a93a8]">
            Jira acceptance criteria vs observed on mapped screens. Click a screen to focus the canvas.
          </p>
          {!jira ? (
            <p className="mt-2 text-[12px] text-[#8a93a8]">Connect Jira on this canvas to see Live coverage.</p>
          ) : !missingLive.length ? (
            <p className="mt-2 text-[12px] text-[#16A34A]">No missing ACs on mapped tickets (or no ACs yet).</p>
          ) : (
            <ul className="mt-2 max-h-[220px] space-y-2 overflow-auto text-[12px]">
              {missingLive.map((r) => (
                <li key={r.key} className="rounded-[8px] border border-[#f3f4f6] px-2 py-1.5 dark:border-[#222]">
                  <button
                    type="button"
                    className="font-semibold text-[#8664F2]"
                    onClick={() => onOpenSit?.({ ticketKey: r.key, workbookId: flat.find((t) => t.key === r.key)?.workbookId })}
                  >
                    {r.key}
                  </button>{" "}
                  <span className="text-[#6b7280]">
                    {r.observed}/{r.total} AC · {r.screenLabels.slice(0, 2).join(", ") || "no screens"}
                  </span>
                  <ul className="mt-1 space-y-1 pl-2">
                    {r.missing.slice(0, 4).map((m) => {
                      const links = linkAcToCases(
                        [m.text],
                        caseIndex[r.key] || [],
                      )[0];
                      return (
                        <li key={m.text} className="text-[#4b5563] dark:text-[#d1d5db]">
                          <button
                            type="button"
                            className="text-left hover:text-[#8664F2]"
                            onClick={() => setExpandedAc(expandedAc === `${r.key}:${m.text}` ? null : `${r.key}:${m.text}`)}
                          >
                            · {m.text}
                          </button>
                          {m.nodeId ? (
                            <button
                              type="button"
                              className="ml-2 text-[11px] text-[#8664F2]"
                              onClick={() => onFocusNode?.(m.nodeId!)}
                              title={m.via || "evidence"}
                            >
                              {m.nodePath || m.nodeTitle || "screen"}
                              {m.via ? ` · ${m.via}` : ""}
                            </button>
                          ) : null}
                          {expandedAc === `${r.key}:${m.text}` ? (
                            <div className="mt-0.5 pl-3 text-[11px] text-[#6b7280]">
                              {links?.caseIds.length
                                ? links.caseIds.map((id, i) => (
                                    <button
                                      key={id}
                                      type="button"
                                      className="mr-2 text-[#8664F2]"
                                      onClick={() => onOpenSit?.({ ticketKey: r.key })}
                                    >
                                      {id}
                                      {links.scenarios[i] ? ` (${links.scenarios[i]})` : ""}
                                    </button>
                                  ))
                                : "no linked SIT case (token join)"}
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          )}
          {noScreen.length ? (
            <div className="mt-3 border-t border-[#f3f4f6] pt-2 dark:border-[#222]">
              <div className="text-[11px] font-semibold uppercase text-[#9ca3af]">Ticket has no screen</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {noScreen.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    className="rounded-full border border-[#fecaca] bg-[#fef2f2] px-2 py-0.5 text-[11px] text-[#b91c1c]"
                    onClick={() => onOpenSit?.({ ticketKey: r.key })}
                  >
                    {r.key}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="rounded-[10px] border border-[#e2e6ef] bg-white p-3 dark:border-[#1a1a1a] dark:bg-[#101010]">
          <h3 className="text-[13px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">OpenAPI vs Jira</h3>
          <p className="mt-0.5 text-[11px] text-[#8a93a8]">Token join on summary/AC ↔ method path. Not a live crawl.</p>
          {!ops.length ? (
            <p className="mt-2 text-[12px] text-[#8a93a8]">Connect Swagger on this canvas to compare operations.</p>
          ) : (
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div>
                <div className="text-[11px] font-semibold text-[#9ca3af]">Ticket · no op ({apiGaps?.ticketNoOp.length ?? 0})</div>
                <ul className="mt-1 max-h-[160px] overflow-auto text-[12px]">
                  {(apiGaps?.ticketNoOp || []).slice(0, 20).map((t) => (
                    <li key={t.key}>
                      <button type="button" className="text-[#8664F2]" onClick={() => onOpenSit?.({ ticketKey: t.key })}>
                        {t.key}
                      </button>{" "}
                      <span className="text-[#6b7280]">{t.summary.slice(0, 40)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-[11px] font-semibold text-[#9ca3af]">Op · no ticket ({apiGaps?.opNoTicket.length ?? 0})</div>
                <ul className="mt-1 max-h-[160px] overflow-auto font-mono text-[11px] text-[#4b5563]">
                  {(apiGaps?.opNoTicket || []).slice(0, 20).map((o) => (
                    <li key={o.key}>{o.key}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-[10px] border border-[#e2e6ef] bg-white p-3 dark:border-[#1a1a1a] dark:bg-[#101010]">
          <h3 className="text-[13px] font-semibold">Epic readiness</h3>
          <p className="text-[11px] text-[#8a93a8]">Green when every child has depth ≥40% and Live AC ≥50%.</p>
          <ul className="mt-2 max-h-[140px] space-y-1 overflow-auto text-[12px]">
            {epicBadges.length ? (
              epicBadges.map((e) => (
                <li key={e.key} className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    <b>{e.key}</b> {e.summary}
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${e.ready ? "bg-[#dcfce7] text-[#166534]" : "bg-[#fef3c7] text-[#92400e]"}`}>
                    {e.ready ? "Ready" : `${e.readyCount}/${e.total}`}
                  </span>
                </li>
              ))
            ) : (
              <li className="text-[#8a93a8]">No epics on this map.</li>
            )}
          </ul>
        </section>

        <section className="rounded-[10px] border border-[#e2e6ef] bg-white p-3 dark:border-[#1a1a1a] dark:bg-[#101010]">
          <h3 className="text-[13px] font-semibold">Undocumented / zombie</h3>
          {!surface ? (
            <p className="mt-2 text-[12px] text-[#8a93a8]">Needs Jira map.</p>
          ) : (
            <div className="mt-2 space-y-2 text-[12px]">
              <div>
                <span className="text-[11px] font-semibold text-[#9ca3af]">Screen · no ticket ({surface.undocumentedScreens.length})</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {surface.undocumentedScreens.slice(0, 10).map((s) => (
                    <button key={s.id} type="button" className="rounded border border-[#e5e7eb] px-1.5 py-0.5 text-[11px]" onClick={() => onFocusNode?.(s.id)}>
                      {s.path || s.title}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-[#9ca3af]">Zombie screens ({surface.zombieScreens.length})</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {surface.zombieScreens.slice(0, 8).map((s) => (
                    <span key={s.id} className="rounded border border-[#fecaca] px-1.5 py-0.5 text-[11px] text-[#b91c1c]">
                      {s.path || s.title}
                    </span>
                  ))}
                  {!surface.zombieScreens.length ? <span className="text-[#8a93a8]">None</span> : null}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-[10px] border border-[#e2e6ef] bg-white p-3 dark:border-[#1a1a1a] dark:bg-[#101010]">
          <h3 className="text-[13px] font-semibold">Blast radius</h3>
          <div className="mt-1 flex flex-wrap gap-1">
            {CONTROLS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setBlastControl(c)}
                className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                  blastControl === c ? "border-[#8664F2] bg-[#F4EFFE] text-[#5B3FD1]" : "border-[#e5e7eb] text-[#6b7280]"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="mt-2 max-h-[120px] overflow-auto text-[11px] text-[#4b5563]">
            <div>
              <b>Tickets</b>: {blast.tickets.map((t) => t.key).join(", ") || "—"}
            </div>
            <div>
              <b>Screens</b>: {blast.screens.map((s) => s.path || s.title).join(", ") || "—"}
            </div>
            <div className="font-mono">
              <b>Ops</b>: {blast.ops.map((o) => o.key).join(", ") || "—"}
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[10px] border border-[#e2e6ef] bg-white p-3 dark:border-[#1a1a1a] dark:bg-[#101010]">
          <h3 className="text-[13px] font-semibold">Device coverage matrix</h3>
          <p className="text-[11px] text-[#8a93a8]">Same host as this canvas · from saved canvas device profiles.</p>
          {!deviceRows.length ? (
            <p className="mt-2 text-[12px] text-[#8a93a8]">No device-tagged canvases yet. Record with a named preset.</p>
          ) : (
            <table className="mt-2 w-full text-left text-[12px]">
              <thead>
                <tr className="text-[10px] uppercase text-[#9ca3af]">
                  <th className="py-1">Device</th>
                  <th>Canvases</th>
                  <th>Screens</th>
                </tr>
              </thead>
              <tbody>
                {deviceRows.map((d) => (
                  <tr key={d.key} className="border-t border-[#f3f4f6] dark:border-[#222]">
                    <td className="py-1.5">{d.label}</td>
                    <td className="tabular-nums">{d.canvases}</td>
                    <td className="tabular-nums">{d.screens}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="rounded-[10px] border border-[#e2e6ef] bg-white p-3 dark:border-[#1a1a1a] dark:bg-[#101010]">
          <h3 className="text-[13px] font-semibold">A11y gap rollup</h3>
          <p className="text-[11px] text-[#8a93a8]">From recorded screen health on this canvas.</p>
          {!a11y.length ? (
            <p className="mt-2 text-[12px] text-[#8a93a8]">No a11y violations stored. Re-record with health capture enabled.</p>
          ) : (
            <ul className="mt-2 max-h-[160px] space-y-1 overflow-auto text-[12px]">
              {a11y.map((s) => (
                <li key={s.id}>
                  <button type="button" className="text-[#8664F2]" onClick={() => onFocusNode?.(s.id)}>
                    {s.path || s.title}
                  </button>{" "}
                  <span className={s.level === "bad" ? "text-[#DC2626]" : "text-[#CA8A04]"}>
                    {s.violations} violation{s.violations === 1 ? "" : "s"} · {s.level}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

/** Exported for table column helpers in coverage-overview. */
export function ticketCoverageMeta(
  t: TicketRow,
  live: LiveAcRow | undefined,
): { verified: number; smoke: boolean; weighted: number; acLabel: string } {
  const miss = live && live.total ? (live.total - live.observed) / live.total : 0;
  return {
    verified: verifiedPct(t.byExecutionStatus, t.tests),
    smoke: smokeDeep(t.byType).smokeCovered,
    weighted: weightedGapScore({ byPriority: t.byPriority, depth: t.depth, missingAcRatio: miss }),
    acLabel: live ? (live.total ? `${live.observed}/${live.total}` : "—") : "—",
  };
}
