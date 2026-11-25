"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  TbCheck,
  TbChevronDown,
  TbChevronRight,
  TbDownload,
  TbPlayerPlay,
  TbRefresh,
  TbShield,
  TbUserCheck,
  TbX,
  TbPlayerStop,
  TbRotate,
} from "react-icons/tb";
import type { AtlasClient } from "@/app/services/appatlas";

type PassInfo = {
  id: string;
  title: string;
  kind: string;
  built: boolean;
  unlockCount: number;
  description: string;
  coverage?: {
    covers: number;
    fullyVerifies: number;
    partiallyObserves: number;
    cannotAutomate: number;
    cannotReasons?: string[];
    byCategory?: Record<string, string[]>;
    checkIds?: string[];
    overlapsWithPass1?: string[];
  } | null;
};

type Job = {
  id: string;
  passId: string;
  status: string;
  progress: Record<string, unknown>;
  summary?: Record<string, unknown>;
  error?: string | null;
  startedAt?: number | null;
  finishedAt?: number | null;
  createdByName?: string | null;
};

type CheckRow = {
  id: string;
  category: string;
  name: string;
  status: string;
  statusLabel: string;
  reason: string;
  severity?: string | null;
  detectors: string[];
  scopeText: string;
  screenIds?: string[];
  screensAffected?: number;
  asvs: string | null;
  cwe: string | null;
  owasp: string | null;
  remediation: string | null;
  automationLevel: string;
  primaryPass?: string | null;
  futurePass: string | null;
  humanStatus: string | null;
  automatedAlso: string | null;
  lastTestedAt?: number | null;
  evidence?: Record<string, unknown>;
  marks?: Record<string, string>;
  box?: string | null;
  automationReason?: string | null;
};

const STATUS_BG: Record<string, string> = {
  fail: "bg-[#FEE2E2] text-[#991B1B] dark:bg-[#3f1212] dark:text-[#fecaca]",
  pass: "bg-[#DCFCE7] text-[#166534] dark:bg-[#0f2418] dark:text-[#86efac]",
  partial: "bg-[#FEF9C3] text-[#854D0E] dark:bg-[#3a2a08] dark:text-[#fde68a]",
  not_tested: "bg-[#F3F4F6] text-[#4B5563] dark:bg-[#1a1a1a] dark:text-[#9ca3af]",
  manual: "bg-[#E0E7FF] text-[#3730A3] dark:bg-[#1e1b4b] dark:text-[#c7d2fe]",
  human_verified_pass: "bg-[#F5D0FE] text-[#86198F]",
  human_verified_fail: "bg-[#F5D0FE] text-[#86198F]",
  human_verified_na: "bg-[#F5D0FE] text-[#86198F]",
};

const TILES = [
  { key: "all", label: "All 143" },
  { key: "fail", label: "Fail" },
  { key: "pass", label: "Pass" },
  { key: "partial", label: "Partial" },
  { key: "not_tested", label: "Not tested" },
  { key: "manual", label: "Manual" },
  { key: "human_verified", label: "Human verified" },
] as const;

function latestJobForPass(jobs: Job[], passId: string): Job | undefined {
  return jobs.find((j) => j.passId === passId);
}

function activeJobForPass(jobs: Job[], passId: string): Job | undefined {
  return jobs.find((j) => j.passId === passId && (j.status === "queued" || j.status === "running"));
}

function elapsedLabel(startedAt?: number | null) {
  if (!startedAt) return "";
  const s = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export function SecurityCoveragePanel({
  client,
  canvasId,
  onOpenNode,
}: {
  client: AtlasClient;
  canvasId: string;
  onOpenNode?: (nodeId: string) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status") || "all";
  const q = searchParams.get("q") || "";
  const groupBy = (searchParams.get("group") as "category" | "pass" | "owasp") || "category";
  const view = (searchParams.get("view") as "matrix" | "report" | "activity" | "byscreen") || "matrix";

  const setQuery = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === "" || v === "all") next.delete(k);
        else next.set(k, v);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [passes, setPasses] = useState<PassInfo[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [roadmap, setRoadmap] = useState<Record<string, number>>({});
  const [overlaps, setOverlaps] = useState<string[]>([]);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [tooltip, setTooltip] = useState("");
  const [report, setReport] = useState<{
    tally: Record<string, number>;
    grade: {
      eligible: boolean;
      label: string;
      testedCount: number;
      unlockHint?: string;
      progress?: {
        tested: number;
        total: number;
        passAmongTested: number;
        passRateLabel: string;
        tally: Record<string, number>;
      };
    };
    coverage: { screensVisited: number; screensOnCanvas: number; percent: number; requestsSeen: number } | null;
    checks: CheckRow[];
    failures: Array<{ severity: string; title: string; checkId: string; reason?: string; screenIds?: string[] }>;
    screens?: Array<{ nodeId: string | null; url: string; title: string; visited: boolean }>;
  } | null>(null);
  const [expandedPass, setExpandedPass] = useState<string | null>(null);
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const [drawer, setDrawer] = useState<CheckRow | null>(null);
  const [drawerTab, setDrawerTab] = useState<"result" | "screens" | "evidence" | "how" | "remediation" | "history" | "attest">("result");
  const [attestNotes, setAttestNotes] = useState("");
  const [attesting, setAttesting] = useState(false);
  const [activityJobId, setActivityJobId] = useState<string | null>(null);
  const [events, setEvents] = useState<Array<{ id: number; at: number; step: string; detail: string | null; url: string | null; detector: string | null; result: string | null }>>([]);
  const afterEventRef = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshJobs = useCallback(async () => {
    const p = await client.listSecurityPasses(canvasId);
    setPasses(p.passes || []);
    setJobs((p.jobs || []) as Job[]);
    setRoadmap(p.roadmap || {});
    setOverlaps(p.overlaps || []);
    setTotals(p.totals || {});
    setTooltip(p.tooltip || "");
    return p.jobs as Job[];
  }, [canvasId, client]);

  const refreshReport = useCallback(async () => {
    const r = await client.getSecurityReport(canvasId);
    setReport(r as typeof report);
  }, [canvasId, client]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([refreshJobs(), refreshReport()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load coverage");
    } finally {
      setLoading(false);
    }
  }, [refreshJobs, refreshReport]);

  // Mount + resume polling from server state only
  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      void (async () => {
        try {
          const j = await refreshJobs();
          const active = (j || []).some((x) => x.status === "queued" || x.status === "running");
          if (active) {
            // Keep report slightly cooler while running so queued/running never blanks the matrix
          } else {
            await refreshReport().catch(() => undefined);
          }
        } catch {
          /* ignore poll errors */
        }
      })();
    }, 1500);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refreshJobs, refreshReport]);

  // Activity log poll
  useEffect(() => {
    if (!activityJobId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await client.listSecurityJobEvents(canvasId, activityJobId, afterEventRef.current);
        if (cancelled) return;
        if (res.items?.length) {
          setEvents((prev) => [...prev, ...res.items]);
          afterEventRef.current = res.items[res.items.length - 1]!.id;
        }
      } catch {
        /* ignore */
      }
    };
    void tick();
    const t = setInterval(() => void tick(), 1500);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [activityJobId, canvasId, client]);

  const tally = report?.tally || {};
  const checks = report?.checks || [];

  const filtered = useMemo(() => {
    let rows = checks;
    if (statusFilter !== "all") {
      rows = rows.filter((c) =>
        statusFilter === "human_verified" ? String(c.status).startsWith("human_verified") : c.status === statusFilter,
      );
    }
    if (q.trim()) {
      const n = q.toLowerCase();
      rows = rows.filter(
        (c) =>
          c.id.toLowerCase().includes(n) ||
          c.name.toLowerCase().includes(n) ||
          c.category.toLowerCase().includes(n) ||
          (c.reason || "").toLowerCase().includes(n),
      );
    }
    return rows;
  }, [checks, statusFilter, q]);

  const grouped = useMemo(() => {
    const map = new Map<string, CheckRow[]>();
    for (const c of filtered) {
      const key =
        groupBy === "pass"
          ? c.primaryPass || c.futurePass || "other"
          : groupBy === "owasp"
            ? c.owasp || "Other"
            : c.category;
      (map.get(key) || map.set(key, []).get(key)!).push(c);
    }
    return [...map.entries()];
  }, [filtered, groupBy]);

  const toggleTile = (key: string) => {
    setQuery({ status: statusFilter === key ? "all" : key });
  };

  const runPass = async (passId: string) => {
    try {
      const job = (await client.enqueueSecurityPass(canvasId, passId)) as { id?: string };
      if (job?.id) {
        setActivityJobId(job.id);
        afterEventRef.current = 0;
        setEvents([]);
      }
      await refreshJobs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start pass");
    }
  };

  const runAll = async () => {
    try {
      const res = await client.enqueueSecurityRunAll(canvasId);
      const first = res.jobs?.[0] as { id?: string } | undefined;
      if (first?.id) {
        setActivityJobId(first.id);
        afterEventRef.current = 0;
        setEvents([]);
      }
      await refreshJobs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start run all");
    }
  };

  const cancelJob = async (jobId: string) => {
    try {
      await client.cancelSecurityPassJob(canvasId, jobId);
      await refreshJobs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancel failed");
    }
  };

  const retryPass = async (passId: string) => {
    try {
      await client.retrySecurityPass(canvasId, passId);
      await refreshJobs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Retry failed");
    }
  };

  const attest = async (status: "pass" | "fail" | "na") => {
    if (!drawer) return;
    setAttesting(true);
    try {
      await client.attestSecurityCheck(canvasId, drawer.id, { humanStatus: status, notes: attestNotes });
      setDrawer(null);
      setAttestNotes("");
      await refreshReport();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Attestation failed");
    } finally {
      setAttesting(false);
    }
  };

  const download = async (format: "json" | "html" | "xlsx") => {
    try {
      const { blob, filename } = await client.exportSecurityReport(canvasId, format);
      const url = URL.createObjectURL(blob);
      if (format === "html") window.open(url, "_blank", "noopener,noreferrer");
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    }
  };

  const grade = report?.grade;
  const progress = grade?.progress;

  if (loading && !report) {
    return <div className="animate-pulse h-40 rounded-[12px] bg-[#E5E7EB]/50 dark:bg-[#2a2a2a]/50" aria-busy="true" />;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-[8px] border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[12px] text-[#991B1B]" role="alert">
          {error}
          <button type="button" className="ml-auto" onClick={() => setError(null)} aria-label="Dismiss">
            <TbX size={14} />
          </button>
        </div>
      )}

      {/* Progress card (score gate) */}
      <section className="grid grid-cols-12 gap-3" aria-label="Testing progress">
        <div className="col-span-12 rounded-[12px] border border-[#E5E7EB] bg-white p-4 dark:border-[#2a2a2a] dark:bg-[#141414] md:col-span-5">
          <div className="text-[12px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">Testing progress</div>
          <div className="mt-1 text-[22px] font-bold text-[#8664F2]">{grade?.label || "0 of 143 checks tested"}</div>
          {grade && !grade.eligible && <p className="mt-1 text-[11px] text-[#7E7E7E]">{grade.unlockHint}</p>}
          {grade?.eligible && <p className="mt-1 text-[11px] text-[#7E7E7E]">Letter grade unlocked by the testing gate.</p>}
          <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-[#F3F4F6] dark:bg-[#1a1a1a]">
            {[
              ["fail", "#DC2626", tally.fail],
              ["pass", "#16A34A", tally.pass],
              ["partial", "#D97706", tally.partial],
              ["not_tested", "#9CA3AF", tally.not_tested],
              ["manual", "#6366F1", tally.manual],
              ["human_verified", "#A855F7", tally.human_verified],
            ].map(([k, color, n]) => (
              <div key={String(k)} style={{ width: `${((Number(n) || 0) / 143) * 100}%`, background: String(color) }} title={`${k}: ${n}`} />
            ))}
          </div>
          <p className="mt-2 text-[11px] text-[#5E6066]">
            {progress?.passRateLabel || "0 of 0 passed"}
            {report?.coverage
              ? ` · Crawl ${report.coverage.screensVisited}/${report.coverage.screensOnCanvas} screens · ${report.coverage.requestsSeen} responses`
              : ""}
          </p>
        </div>
        <div className="col-span-12 grid grid-cols-3 gap-2 sm:grid-cols-4 md:col-span-7 md:grid-cols-7">
          {TILES.map((t) => {
            const n =
              t.key === "all"
                ? 143
                : t.key === "human_verified"
                  ? tally.human_verified || 0
                  : tally[t.key] || 0;
            const active = statusFilter === t.key || (t.key === "all" && statusFilter === "all");
            return (
              <button
                key={t.key}
                type="button"
                aria-pressed={active}
                onClick={() => toggleTile(t.key)}
                className={`rounded-[10px] border px-2 py-2 text-left transition ${
                  active
                    ? "border-[#8664F2] bg-[#F5F1FF] ring-1 ring-[#8664F2] dark:bg-[#1c1530]"
                    : "border-[#E5E7EB] dark:border-[#2a2a2a]"
                }`}
              >
                <div className="text-[10px] text-[#7E7E7E]">{t.label}</div>
                <div className="text-[18px] font-semibold">{n}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Coverage roadmap */}
      <section className="rounded-[12px] border border-[#E5E7EB] p-3 dark:border-[#2a2a2a]" aria-label="Coverage roadmap">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-[13px] font-semibold" title={tooltip}>
            Coverage roadmap
          </h3>
          <span className="text-[10.5px] text-[#7E7E7E]" title={tooltip}>
            Primary pass assignment · overlaps counted once
          </span>
        </div>
        <div className="flex h-3 overflow-hidden rounded-full">
          {[
            ["pass1_passive", "#8664F2", "Pass 1"],
            ["pass2_light_probes", "#6366F1", "Pass 2"],
            ["pass3_mutation", "#94A3B8", "Pass 3"],
            ["pass4_identity", "#64748B", "Pass 4"],
            ["pass5_guided", "#A855F7", "Pass 5"],
            ["connector", "#F59E0B", "Connector"],
            ["manual", "#EF4444", "Manual"],
          ].map(([k, color, label]) => (
            <div
              key={k}
              style={{ width: `${((roadmap[k] || 0) / 143) * 100}%`, background: color }}
              title={`${label}: ${roadmap[k] || 0}`}
            />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-[10.5px] text-[#5E6066]">
          <span>Pass 1 {totals.pass1 ?? roadmap.pass1_passive ?? 0}</span>
          <span>Pass 2 new {totals.pass2New ?? roadmap.pass2_light_probes ?? 0}</span>
          <span>Pass 3 {totals.pass3 ?? 0}</span>
          <span>Pass 4 {totals.pass4 ?? 0}</span>
          <span>Pass 5 {totals.pass5 ?? 0}</span>
          <span>Connector {totals.connector ?? 0}</span>
          <span>Manual {totals.manual ?? 0}</span>
          {overlaps.length > 0 && <span title={overlaps.join(", ")}>Overlaps (Pass1∩Pass2): {overlaps.length}</span>}
        </div>
      </section>

      {/* Pass cards */}
      <section aria-label="Scan passes">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h3 className="text-[13px] font-semibold">Scan passes</h3>
          <button type="button" onClick={() => void refresh()} className="text-[#8664F2]" aria-label="Refresh">
            <TbRefresh size={14} />
          </button>
          <button
            type="button"
            onClick={() => void runAll()}
            className="ml-auto inline-flex items-center gap-1 rounded-[7px] bg-[#8664F2] px-3 py-1.5 text-[12px] font-medium text-white"
          >
            <TbPlayerPlay size={14} /> Run all passes
          </button>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {passes
            .filter((p) => p.id !== "inventory" || true)
            .map((p) => {
              const active = activeJobForPass(jobs, p.id);
              const latest = latestJobForPass(jobs, p.id);
              const status = active?.status || latest?.status || "idle";
              const prog = active?.progress || latest?.progress || {};
              const summary = latest?.summary || {};
              const cov = p.coverage;
              const pct = Number(prog.percent) || (status === "done" ? 100 : status === "running" ? 20 : 0);
              return (
                <div key={p.id} className="rounded-[12px] border border-[#E5E7EB] p-3 dark:border-[#2a2a2a]">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[12px] font-semibold">{p.title}</div>
                      {cov ? (
                        <div className="mt-0.5 text-[11px] text-[#5E6066]" title={tooltip}>
                          Covers {cov.covers} checks · fully {cov.fullyVerifies} · partial {cov.partiallyObserves}
                          {cov.cannotAutomate ? ` · cannot automate ${cov.cannotAutomate}` : ""}
                        </div>
                      ) : (
                        <div className="mt-0.5 text-[11px] text-[#5E6066]">{p.description}</div>
                      )}
                    </div>
                    <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[10px] font-medium capitalize dark:bg-[#1a1a1a]">
                      {status}
                    </span>
                  </div>
                  {!p.built && (
                    <div className="mt-2 text-[10.5px] font-medium text-[#854D0E]">
                      Not built yet · unlocks {cov?.covers ?? p.unlockCount} checks
                    </div>
                  )}
                  {(status === "queued" || status === "running") && (
                    <div className="mt-2 space-y-1">
                      <div className="h-1.5 overflow-hidden rounded-full bg-[#F3F4F6] dark:bg-[#1a1a1a]">
                        <div className="h-full bg-[#8664F2] transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-[10.5px] text-[#5E6066]">
                        {String(prog.currentlyDoing || prog.message || "Working...")}
                        {prog.screensVisited != null && ` · screens ${prog.screensVisited}/${prog.screensTotal ?? "?"}`}
                        {prog.probesSent != null && ` · probes ${prog.probesSent}/${prog.probesTotal ?? "?"}`}
                        {active?.startedAt ? ` · ${elapsedLabel(active.startedAt)}` : ""}
                      </div>
                      <div className="flex gap-2">
                        {active && (
                          <button
                            type="button"
                            onClick={() => void cancelJob(active.id)}
                            className="inline-flex items-center gap-1 rounded-[6px] border border-[#E5E7EB] px-2 py-1 text-[11px] dark:border-[#2a2a2a]"
                          >
                            <TbPlayerStop size={12} /> Cancel
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (active?.id || latest?.id) {
                              setActivityJobId(active?.id || latest!.id);
                              afterEventRef.current = 0;
                              setEvents([]);
                              setQuery({ view: "activity" });
                            }
                          }}
                          className="text-[11px] text-[#8664F2]"
                        >
                          Activity log
                        </button>
                      </div>
                    </div>
                  )}
                  {status === "done" && (
                    <div className="mt-2 text-[10.5px] text-[#5E6066]">
                      {String(summary.message || prog.message || "Completed")}
                      {summary.durationMs != null && ` · ${Math.round(Number(summary.durationMs) / 1000)}s`}
                      {summary.triggeredBy ? ` · ${String(summary.triggeredBy)}` : ""}
                      {summary.tally != null && typeof summary.tally === "object" ? (
                        <div className="mt-0.5">
                          Results: Fail {(summary.tally as Record<string, number>).fail || 0} · Pass{" "}
                          {(summary.tally as Record<string, number>).pass || 0} · Partial{" "}
                          {(summary.tally as Record<string, number>).partial || 0} · Not tested{" "}
                          {(summary.tally as Record<string, number>).not_tested || 0}
                        </div>
                      ) : null}
                    </div>
                  )}
                  {status === "failed" && (
                    <div className="mt-2 text-[10.5px] text-[#991B1B]">
                      {latest?.error || String(prog.message) || "Failed"}
                      <button type="button" className="ml-2 inline-flex items-center gap-1 text-[#8664F2]" onClick={() => void retryPass(p.id)}>
                        <TbRotate size={12} /> Retry
                      </button>
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {p.built && !active && (
                      <button
                        type="button"
                        onClick={() => void runPass(p.id)}
                        className="inline-flex items-center gap-1 rounded-[6px] bg-[#8664F2] px-2 py-1 text-[11px] text-white"
                      >
                        <TbPlayerPlay size={12} /> {status === "failed" ? "Retry" : status === "done" ? "Run again" : "Run"}
                      </button>
                    )}
                    {cov && cov.checkIds && cov.checkIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setExpandedPass(expandedPass === p.id ? null : p.id)}
                        className="inline-flex items-center gap-1 text-[11px] text-[#8664F2]"
                      >
                        {expandedPass === p.id ? <TbChevronDown size={12} /> : <TbChevronRight size={12} />} Checks
                      </button>
                    )}
                  </div>
                  {expandedPass === p.id && cov?.byCategory && (
                    <div className="mt-2 max-h-40 overflow-auto rounded-[8px] bg-[#F9FAFB] p-2 text-[10.5px] dark:bg-[#1a1a1a]">
                      {Object.entries(cov.byCategory).map(([cat, ids]) => (
                        <div key={cat} className="mb-1">
                          <div className="font-medium">{cat}</div>
                          <div className="text-[#5E6066]">{ids.join(", ")}</div>
                        </div>
                      ))}
                      {cov.cannotReasons?.length ? (
                        <div className="mt-1 text-[#854D0E]">Cannot automate: {cov.cannotReasons.join("; ")}</div>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </section>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-[8px] border border-[#E5E7EB] dark:border-[#2a2a2a]">
          {(["matrix", "report", "activity", "byscreen"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setQuery({ view: v })}
              className={`px-3 py-1.5 text-[12px] capitalize ${view === v ? "bg-[#8664F2] text-white" : ""}`}
            >
              {v === "byscreen" ? "By screen" : v}
            </button>
          ))}
        </div>
        <input
          value={q}
          onChange={(e) => setQuery({ q: e.target.value || null })}
          placeholder="Search checks..."
          className="rounded-[7px] border border-[#E5E7EB] px-2 py-1 text-[12px] dark:border-[#2a2a2a] dark:bg-transparent"
        />
        <select
          value={groupBy}
          onChange={(e) => setQuery({ group: e.target.value })}
          className="rounded-[7px] border border-[#E5E7EB] px-2 py-1 text-[12px] dark:border-[#2a2a2a] dark:bg-transparent"
        >
          <option value="category">Group: category</option>
          <option value="pass">Group: pass</option>
          <option value="owasp">Group: OWASP</option>
        </select>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={() => void download("html")} className="inline-flex items-center gap-1 rounded-[7px] border border-[#E5E7EB] px-2 py-1 text-[11px] dark:border-[#2a2a2a]">
            <TbDownload size={12} /> PDF / HTML
          </button>
          <button type="button" onClick={() => void download("json")} className="rounded-[7px] border border-[#E5E7EB] px-2 py-1 text-[11px] dark:border-[#2a2a2a]">
            JSON
          </button>
          <button type="button" onClick={() => void download("xlsx")} className="rounded-[7px] border border-[#E5E7EB] px-2 py-1 text-[11px] dark:border-[#2a2a2a]">
            XLSX
          </button>
        </div>
      </div>

      {/* Filter chips */}
      {statusFilter !== "all" && (
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="rounded-full bg-[#F5F1FF] px-2 py-0.5 text-[#8664F2]">
            Status: {TILES.find((t) => t.key === statusFilter)?.label || statusFilter} ×
            <button type="button" className="ml-1" onClick={() => setQuery({ status: "all" })} aria-label="Clear status filter">
              clear
            </button>
          </span>
          <span className="text-[#7E7E7E]">
            Showing {filtered.length} of 143 checks
          </span>
          <button type="button" className="text-[#8664F2]" onClick={() => setQuery({ status: "all", q: null })}>
            Clear all
          </button>
        </div>
      )}

      {view === "activity" && (
        <section className="rounded-[12px] border border-[#E5E7EB] p-3 dark:border-[#2a2a2a]">
          <h3 className="text-[13px] font-semibold">Activity log {activityJobId ? `(job ${activityJobId})` : ""}</h3>
          <div className="mt-2 max-h-72 overflow-auto font-mono text-[11px]">
            {events.map((e) => (
              <div key={e.id} className="border-b border-[#F3F4F6] py-1 dark:border-[#2a2a2a]">
                <span className="text-[#7E7E7E]">{new Date(e.at).toISOString().slice(11, 19)}</span>{" "}
                <strong>{e.step}</strong> {e.detail || ""} {e.detector ? `· ${e.detector}` : ""} {e.url || ""}
              </div>
            ))}
            {!events.length && <div className="text-[#7E7E7E]">No events yet. Start a pass to stream activity.</div>}
          </div>
        </section>
      )}

      {view === "report" && report && (
        <section className="rounded-[12px] border border-[#E5E7EB] p-4 dark:border-[#2a2a2a]">
          <h3 className="text-[13px] font-semibold">Failures by severity</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-[12px]">
            {report.failures.map((f, i) => (
              <li key={`${f.checkId}-${i}`}>
                <button type="button" className="text-left" onClick={() => setDrawer(checks.find((c) => c.id === f.checkId) || null)}>
                  <strong className="uppercase">{f.severity}</strong> {f.checkId} - {f.title}
                  {f.screenIds?.length ? ` · screens: ${f.screenIds.slice(0, 3).join(", ")}` : ""}
                </button>
              </li>
            ))}
            {!report.failures.length && <li className="text-[#7E7E7E]">None</li>}
          </ol>
        </section>
      )}

      {view === "byscreen" && (
        <section className="rounded-[12px] border border-[#E5E7EB] p-3 dark:border-[#2a2a2a]">
          <h3 className="mb-2 text-[13px] font-semibold">By screen</h3>
          <div className="space-y-2">
            {(report?.screens || []).map((s) => {
              const sid = s.nodeId || s.url;
              const related = checks.filter((c) => (c.screenIds || []).includes(s.nodeId || "") || (c.status === "fail" && s.visited));
              const fails = related.filter((c) => c.status === "fail");
              return (
                <div key={sid} className="rounded-[10px] border border-[#E5E7EB] p-2 dark:border-[#2a2a2a]">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[12px] font-medium">{s.title || s.url}</div>
                      <div className="text-[10.5px] text-[#7E7E7E]">{s.url}</div>
                    </div>
                    {s.nodeId && onOpenNode && (
                      <button type="button" className="text-[11px] text-[#8664F2]" onClick={() => onOpenNode(s.nodeId!)}>
                        Open on canvas
                      </button>
                    )}
                  </div>
                  <div className="mt-1 text-[11px] text-[#5E6066]">
                    Failed {fails.length} · related {related.length} · {s.visited ? "visited" : "not visited"}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {fails.slice(0, 8).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setDrawer(c)}
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_BG.fail}`}
                      >
                        {c.id}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            {!report?.screens?.length && (
              <div className="text-[12px] text-[#7E7E7E]">
                No inventory screens yet.{" "}
                <button type="button" className="text-[#8664F2]" onClick={() => void runPass("inventory")}>
                  Run inventory crawl
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {(view === "matrix" || view === "report") && (
        <div className="overflow-auto rounded-[12px] border border-[#E5E7EB] dark:border-[#2a2a2a]">
          <table className="min-w-full text-left text-[11px]">
            <thead className="sticky top-0 bg-[#F9FAFB] dark:bg-[#1a1a1a]">
              <tr>
                <th className="px-2 py-2">ID</th>
                <th className="px-2 py-2">Name</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Severity</th>
                <th className="px-2 py-2">Reason</th>
                <th className="px-2 py-2">Screens</th>
                <th className="px-2 py-2">Pass</th>
                <th className="px-2 py-2">Level</th>
                <th className="px-2 py-2">Last tested</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map(([group, rows]) => {
                const collapsed = collapsedCats.has(group);
                const gFail = rows.filter((r) => r.status === "fail").length;
                const gPass = rows.filter((r) => r.status === "pass").length;
                return (
                  <Fragment key={`g-${group}`}>
                    <tr className="bg-[#F5F1FF]/40 dark:bg-[#1c1530]/40">
                      <td colSpan={9} className="px-2 py-1.5">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 font-semibold"
                          onClick={() => {
                            const next = new Set(collapsedCats);
                            if (next.has(group)) next.delete(group);
                            else next.add(group);
                            setCollapsedCats(next);
                          }}
                        >
                          {collapsed ? <TbChevronRight size={14} /> : <TbChevronDown size={14} />}
                          {group}
                          <span className="ml-2 font-normal text-[#7E7E7E]">
                            {rows.length} · Fail {gFail} · Pass {gPass}
                          </span>
                          <span className="ml-2 inline-block h-1.5 w-24 overflow-hidden rounded-full bg-[#E5E7EB] dark:bg-[#2a2a2a]">
                            <span
                              className="block h-full bg-[#16A34A]"
                              style={{ width: `${rows.length ? (gPass / rows.length) * 100 : 0}%` }}
                            />
                          </span>
                        </button>
                      </td>
                    </tr>
                    {!collapsed &&
                      rows.map((c) => (
                        <tr
                          key={c.id}
                          tabIndex={0}
                          className="cursor-pointer border-t border-[#E5E7EB] hover:bg-[#F5F3FF]/40 dark:border-[#2a2a2a]"
                          onClick={() => {
                            setDrawer(c);
                            setDrawerTab("result");
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              setDrawer(c);
                              setDrawerTab("result");
                            }
                          }}
                        >
                          <td className="px-2 py-1.5 font-mono">{c.id}</td>
                          <td className="px-2 py-1.5">{c.name}</td>
                          <td className="px-2 py-1.5">
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_BG[c.status] || STATUS_BG.not_tested}`}>
                              {c.statusLabel}
                            </span>
                            {c.scopeText ? <div className="mt-0.5 text-[10px] text-[#7E7E7E]">{c.scopeText}</div> : null}
                          </td>
                          <td className="px-2 py-1.5 capitalize">{c.severity || "-"}</td>
                          <td className="max-w-[240px] truncate px-2 py-1.5 text-[#5E6066]" title={c.reason}>
                            {c.reason}
                          </td>
                          <td className="px-2 py-1.5">
                            {c.screensAffected || 0}
                            {(c.screenIds || []).slice(0, 3).map((s) => (
                              <span key={s} className="ml-1 rounded bg-[#F3F4F6] px-1 text-[9px] dark:bg-[#1a1a1a]">
                                {s.slice(0, 8)}
                              </span>
                            ))}
                          </td>
                          <td className="px-2 py-1.5 text-[#5E6066]">{c.primaryPass || c.futurePass || "-"}</td>
                          <td className="px-2 py-1.5">{c.automationLevel}</td>
                          <td className="px-2 py-1.5 text-[#7E7E7E]">
                            {c.lastTestedAt ? new Date(c.lastTestedAt).toLocaleString() : "-"}
                          </td>
                        </tr>
                      ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {drawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" role="dialog" aria-modal="true">
          <div className="flex h-full w-full max-w-xl flex-col bg-white shadow-xl dark:bg-[#141414]">
            <div className="flex items-center gap-2 border-b border-[#E5E7EB] px-4 py-3 dark:border-[#2a2a2a]">
              <TbShield size={16} className="text-[#8664F2]" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold">
                  {drawer.id} · {drawer.name}
                </div>
                <div className="text-[11px] text-[#7E7E7E]">{drawer.category}</div>
              </div>
              <button type="button" onClick={() => setDrawer(null)} aria-label="Close">
                <TbX size={16} />
              </button>
            </div>
            <div className="flex gap-1 overflow-x-auto border-b border-[#E5E7EB] px-2 dark:border-[#2a2a2a]">
              {(["result", "screens", "evidence", "how", "remediation", "history", "attest"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setDrawerTab(t)}
                  className={`px-2 py-2 text-[11px] capitalize ${drawerTab === t ? "border-b-2 border-[#8664F2] text-[#8664F2]" : "text-[#7E7E7E]"}`}
                >
                  {t === "how" ? "How we test" : t === "attest" ? "Attestation" : t}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 text-[12px]">
              {drawerTab === "result" && (
                <>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_BG[drawer.status] || ""}`}>
                    {drawer.statusLabel}
                  </span>
                  {drawer.severity && <span className="ml-2 capitalize text-[#7E7E7E]">{drawer.severity}</span>}
                  <p className="leading-relaxed">{drawer.reason}</p>
                  {drawer.automatedAlso && (
                    <p className="rounded-[8px] bg-[#F3F4F6] px-2 py-1.5 text-[11px] dark:bg-[#1a1a1a]">{drawer.automatedAlso}</p>
                  )}
                  {drawer.status === "not_tested" && (
                    <div className="rounded-[8px] border border-[#E5E7EB] p-2 dark:border-[#2a2a2a]">
                      <div className="font-semibold">What is missing</div>
                      <p className="text-[#5E6066]">{drawer.reason}</p>
                      {drawer.primaryPass?.startsWith("pass") && (
                        <button
                          type="button"
                          className="mt-2 rounded-[6px] bg-[#8664F2] px-2 py-1 text-[11px] text-white"
                          onClick={() => void runPass(drawer.primaryPass!)}
                        >
                          Run {drawer.primaryPass}
                        </button>
                      )}
                    </div>
                  )}
                  <div className="text-[11px] text-[#5E6066]">
                    Detectors: {(drawer.detectors || []).join(", ") || "—"}
                    <br />
                    Pass: {drawer.primaryPass || drawer.futurePass || "—"} · Level: {drawer.automationLevel}
                  </div>
                </>
              )}
              {drawerTab === "screens" && (
                <div>
                  <p className="mb-2 text-[#5E6066]">
                    {(drawer.screensAffected || 0) > 0
                      ? `This result references ${drawer.screensAffected} screen(s).`
                      : "No per-screen breakdown stored for this result yet. Failures from header detectors usually attach to the document screen of the response."}
                  </p>
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-left text-[#7E7E7E]">
                        <th className="py-1">Screen</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(drawer.screenIds || []).map((sid) => (
                        <tr key={sid} className="border-t border-[#F3F4F6] dark:border-[#2a2a2a]">
                          <td className="py-1 font-mono">{sid}</td>
                          <td>
                            {onOpenNode && (
                              <button type="button" className="text-[#8664F2]" onClick={() => onOpenNode(sid)}>
                                Open on canvas
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {drawerTab === "evidence" && (
                <pre className="overflow-auto rounded-[8px] bg-[#F9FAFB] p-2 text-[10.5px] dark:bg-[#1a1a1a]">
                  {JSON.stringify(drawer.evidence || {}, null, 2)}
                </pre>
              )}
              {drawerTab === "how" && (
                <div className="space-y-1 text-[11px] text-[#5E6066]">
                  <div>Detectors: {(drawer.detectors || []).join(", ") || "—"}</div>
                  <div>Primary pass: {drawer.primaryPass || "—"}</div>
                  <div>Automation: {drawer.automationLevel} — {drawer.automationReason || ""}</div>
                  <div>Box: {drawer.box || "—"}</div>
                  <div>
                    Workbook marks:{" "}
                    {drawer.marks
                      ? Object.entries(drawer.marks)
                          .map(([k, v]) => `${k}=${v}`)
                          .join(", ")
                      : "—"}
                  </div>
                </div>
              )}
              {drawerTab === "remediation" && (
                <div>
                  <p className="whitespace-pre-wrap text-[#5E6066]">{drawer.remediation || "No remediation text."}</p>
                  <div className="mt-2 text-[11px] text-[#7E7E7E]">
                    ASVS {drawer.asvs || "—"} · {drawer.cwe || "—"} · {drawer.owasp || "—"}
                  </div>
                  {drawer.remediation && (
                    <button
                      type="button"
                      className="mt-2 rounded-[6px] border border-[#E5E7EB] px-2 py-1 text-[11px] dark:border-[#2a2a2a]"
                      onClick={() => void navigator.clipboard.writeText(drawer.remediation || "")}
                    >
                      Copy remediation
                    </button>
                  )}
                </div>
              )}
              {drawerTab === "history" && (
                <p className="text-[#7E7E7E]">
                  Last tested: {drawer.lastTestedAt ? new Date(drawer.lastTestedAt).toLocaleString() : "never"}. Attestation history is listed under Attestation.
                </p>
              )}
              {drawerTab === "attest" && (
                <div className="rounded-[10px] border border-[#E5E7EB] p-3 dark:border-[#2a2a2a]">
                  <div className="mb-2 flex items-center gap-1 text-[12px] font-semibold">
                    <TbUserCheck size={14} /> Human attestation
                  </div>
                  <p className="mb-2 text-[10.5px] text-[#7E7E7E]">
                    Automated results stay visible alongside. Evidence uploads capped at 2 MiB; redact PANs, passwords, and tokens.
                  </p>
                  <textarea
                    value={attestNotes}
                    onChange={(e) => setAttestNotes(e.target.value)}
                    rows={3}
                    placeholder="Notes..."
                    className="w-full rounded-[7px] border border-[#E5E7EB] px-2 py-1 text-[12px] dark:border-[#2a2a2a] dark:bg-transparent"
                  />
                  <div className="mt-2 flex gap-2">
                    <button type="button" disabled={attesting} onClick={() => void attest("pass")} className="inline-flex items-center gap-1 rounded-[6px] bg-[#16A34A] px-2 py-1 text-[11px] text-white">
                      <TbCheck size={12} /> Pass
                    </button>
                    <button type="button" disabled={attesting} onClick={() => void attest("fail")} className="rounded-[6px] bg-[#DC2626] px-2 py-1 text-[11px] text-white">
                      Fail
                    </button>
                    <button type="button" disabled={attesting} onClick={() => void attest("na")} className="rounded-[6px] border border-[#E5E7EB] px-2 py-1 text-[11px] dark:border-[#2a2a2a]">
                      N/A
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
