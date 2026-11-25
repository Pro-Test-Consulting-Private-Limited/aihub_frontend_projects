"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  TbAlertTriangle,
  TbChevronDown,
  TbChevronRight,
  TbDownload,
  TbExternalLink,
  TbPlayerPlay,
  TbPlayerStop,
  TbRefresh,
  TbShield,
  TbX,
} from "react-icons/tb";
import type { AtlasClient } from "@/app/services/appatlas";
import { ChecklistView } from "@/app/components/app-atlas/posture/checklist-view";
import {
  FILTER_CHIPS,
  StatusChip,
  formatWhen,
  passLabel,
  statusBucket,
} from "@/app/components/app-atlas/posture/status";
import type {
  CheckRow,
  Job,
  JobEvent,
  PassInfo,
  SecurityReport,
} from "@/app/components/app-atlas/posture/types";

type Tab = "checklist" | "failures" | "screens" | "runs" | "evidence";

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-[8px] bg-[#E5E7EB]/60 dark:bg-[#2a2a2a]/60 ${className || "h-20"}`} />;
}

function EmptyPanel({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-[12px] border border-dashed border-[#E5E7EB] px-6 py-14 text-center dark:border-[#2a2a2a]">
      <TbShield className="text-[#8664F2]" size={28} />
      <div className="text-[15px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">{title}</div>
      <p className="max-w-[440px] text-[13.5px] text-[#6B7280]">{body}</p>
      {action}
    </div>
  );
}

function latestJob(jobs: Job[], passId: string) {
  return jobs.find((j) => j.passId === passId);
}
function activeJob(jobs: Job[], passId: string) {
  return jobs.find((j) => j.passId === passId && (j.status === "queued" || j.status === "running"));
}

function CanvasPostureInner({
  client,
  canvasId,
  canvasName,
  appUrl,
  onFocusNode,
}: {
  client: AtlasClient;
  canvasId: string;
  canvasName?: string | null;
  appUrl?: string | null;
  onFocusNode?: (nodeId: string) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = ((searchParams.get("tab") as Tab) || "checklist") satisfies Tab;
  const statusFilter = tab === "runs" || tab === "evidence" ? "all" : searchParams.get("status") || "all";

  const setQuery = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === "" || v === "all") next.delete(k);
        else next.set(k, v);
      }
      // Status filters never apply to Runs / Evidence
      const nextTab = (patch.tab as Tab | undefined) || (next.get("tab") as Tab) || "checklist";
      if (nextTab === "runs" || nextTab === "evidence") next.delete("status");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<SecurityReport | null>(null);
  const [passes, setPasses] = useState<PassInfo[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [overlapNote, setOverlapNote] = useState("");
  const [drawer, setDrawer] = useState<CheckRow | null>(null);
  const [drawerTab, setDrawerTab] = useState<"result" | "screens" | "evidence" | "how" | "remediation" | "history">("result");
  const [runDetail, setRunDetail] = useState<{ passId: string; jobId: string } | null>(null);
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [expandedPassChecks, setExpandedPassChecks] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    const [r, p] = await Promise.all([client.getSecurityReport(canvasId), client.listSecurityPasses(canvasId)]);
    setReport(r as SecurityReport);
    setPasses((p.passes || []) as PassInfo[]);
    setJobs((p.jobs || []) as Job[]);
    setOverlapNote((p as { tooltip?: string }).tooltip || (r as SecurityReport).overlapNote || "");
    return p.jobs as Job[];
  }, [canvasId, client]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await refresh();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load posture");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  // Poll while any job is active; survives tab switches via URL state
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      void refresh().catch(() => undefined);
    }, 1500);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refresh]);

  useEffect(() => {
    if (!runDetail) {
      setEvents([]);
      return;
    }
    let stop = false;
    const load = async () => {
      try {
        const res = await client.listSecurityJobEvents(canvasId, runDetail.jobId, 0);
        if (!stop) setEvents((res.items || []) as JobEvent[]);
      } catch {
        /* ignore */
      }
    };
    void load();
    const t = setInterval(load, 1500);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [canvasId, client, runDetail]);

  const displayName = report?.canvasName || canvasName || "Canvas";
  const displayUrl = report?.appUrl || appUrl || "";
  const tally = report?.tally || {};
  const tested = report?.grade?.progress?.tested ?? 0;
  const passed = report?.grade?.progress?.passAmongTested ?? 0;
  const lastRun = jobs.find((j) => j.finishedAt || j.startedAt);
  const lastRunLabel = lastRun
    ? `Last run ${formatWhen(lastRun.finishedAt || lastRun.startedAt)}`
    : "No runs yet";

  const showingCount = useMemo(() => {
    if (!report) return 0;
    if (statusFilter === "all") return report.total;
    return report.checks.filter((c) => statusBucket(c.status) === statusFilter).length;
  }, [report, statusFilter]);

  const runAll = async () => {
    setError(null);
    try {
      await client.enqueueSecurityRunAll(canvasId);
      await refresh();
      setQuery({ tab: "runs" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start run");
    }
  };

  const runPass = async (passId: string) => {
    setError(null);
    try {
      await client.enqueueSecurityPass(canvasId, passId);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start pass");
    }
  };

  const cancelJob = async (jobId: string) => {
    try {
      await client.cancelSecurityPassJob(canvasId, jobId);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancel failed");
    }
  };

  const exportFmt = async (fmt: "html" | "json" | "xlsx") => {
    const { blob, filename } = await client.exportSecurityReport(canvasId, fmt);
    const url = URL.createObjectURL(blob);
    if (fmt === "html") window.open(url, "_blank");
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  };

  if (loading && !report) {
    return (
      <div className="space-y-3 p-5" data-testid="posture-loading">
        <Skeleton className="h-14" />
        <Skeleton className="h-10" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white text-[#1F1F1F] dark:bg-[#0f0f0f] dark:text-[#ededed]" data-testid="canvas-posture">
      <header className="shrink-0 border-b border-[#E5E7EB] px-5 py-3 dark:border-[#2a2a2a]">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[17px] font-semibold">{displayName}</h2>
            <div className="mt-0.5 truncate text-[13px] text-[#6B7280]">{displayUrl || "Application URL not set"}</div>
            <div className="mt-0.5 text-[12.5px] text-[#6B7280]">{lastRunLabel}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void runAll()}
              className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#8664F2] px-3 py-2 text-[13px] font-medium text-white"
              data-testid="run-all-passes"
            >
              <TbPlayerPlay size={15} /> Run all passes
            </button>
            <details className="relative">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-[8px] border border-[#E5E7EB] px-3 py-2 text-[13px] dark:border-[#2a2a2a]">
                <TbDownload size={15} /> Export
              </summary>
              <div className="absolute right-0 z-20 mt-1 w-40 rounded-[8px] border border-[#E5E7EB] bg-white p-1 text-[12.5px] shadow dark:border-[#2a2a2a] dark:bg-[#141414]">
                <button type="button" className="block w-full rounded px-2 py-1.5 text-left hover:bg-[#F5F1FF]" onClick={() => void exportFmt("html")}>
                  PDF / HTML
                </button>
                <button type="button" className="block w-full rounded px-2 py-1.5 text-left hover:bg-[#F5F1FF]" onClick={() => void exportFmt("json")}>
                  JSON
                </button>
                <button type="button" className="block w-full rounded px-2 py-1.5 text-left hover:bg-[#F5F1FF]" onClick={() => void exportFmt("xlsx")}>
                  XLSX
                </button>
              </div>
            </details>
          </div>
        </div>
        {error && (
          <div className="mt-2 flex items-center gap-2 rounded-[8px] border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[13px] text-[#991B1B]" role="alert">
            <TbAlertTriangle size={14} /> {error}
            <button type="button" className="ml-auto" onClick={() => setError(null)} aria-label="Dismiss">
              <TbX size={14} />
            </button>
          </div>
        )}
      </header>

      {/* Summary strip */}
      <div className="shrink-0 border-b border-[#E5E7EB] px-5 py-3 dark:border-[#2a2a2a]" data-testid="posture-summary-strip">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="text-[14px] font-semibold">
            Tested {tested} of {report?.total || 143}
          </div>
          <div className="text-[14px] font-semibold text-[#166534] dark:text-[#86efac]">
            Passed {passed} of {tested || 0}
          </div>
          {report?.grade?.checkScore?.available && report.grade.checkScore.value != null && (
            <div
              className="text-[13px] text-[#6B7280]"
              title={report.grade.checkScore.formula}
            >
              Check score {report.grade.checkScore.value}/100
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {FILTER_CHIPS.map((chip) => {
              const count = tally[chip.key] || 0;
              const active = statusFilter === chip.key;
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => {
                    const next = active ? "all" : chip.key;
                    setQuery({
                      status: next,
                      tab: tab === "runs" || tab === "evidence" ? "checklist" : tab,
                    });
                  }}
                  className={`rounded-full px-2.5 py-1 text-[12.5px] font-medium ${
                    active
                      ? "bg-[#8664F2] text-white"
                      : "border border-[#E5E7EB] text-[#374151] dark:border-[#2a2a2a] dark:text-[#d1d5db]"
                  }`}
                >
                  {chip.label} {count}
                </button>
              );
            })}
          </div>
        </div>
        {statusFilter !== "all" && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px]">
            <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 dark:bg-[#1a1a1a]">
              Status: {FILTER_CHIPS.find((c) => c.key === statusFilter)?.label} ×
            </span>
            <button type="button" className="text-[#8664F2]" onClick={() => setQuery({ status: null })}>
              Clear
            </button>
            <span className="text-[#6B7280]">
              Showing {showingCount} of {report?.total || 143}
            </span>
          </div>
        )}
      </div>

      <div className="shrink-0 border-b border-[#E5E7EB] px-5 dark:border-[#2a2a2a]">
        <div className="flex gap-1" role="tablist" aria-label="Posture tabs">
          {(
            [
              ["checklist", "Checklist"],
              ["failures", "Failures"],
              ["screens", "Screens"],
              ["runs", "Runs"],
              ["evidence", "Evidence"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setQuery({ tab: id })}
              className={`rounded-t-[8px] px-3 py-2.5 text-[13px] font-medium ${
                tab === id
                  ? "bg-white text-[#8664F2] shadow-[0_-2px_0_#8664F2_inset] dark:bg-[#0f0f0f]"
                  : "text-[#6B7280]"
              }`}
              data-testid={`tab-${id}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {!report ? (
          <EmptyPanel title="No posture data" body="Run all passes to discover the site and evaluate checks." action={
            <button type="button" className="mt-2 rounded-[8px] bg-[#8664F2] px-3 py-2 text-[13px] text-white" onClick={() => void runAll()}>
              Run all passes
            </button>
          } />
        ) : tab === "checklist" ? (
          <ChecklistView
            report={report}
            statusFilter={statusFilter}
            onOpenCheck={(c) => {
              setDrawer(c);
              setDrawerTab("result");
            }}
          />
        ) : tab === "failures" ? (
          <FailuresTab
            report={report}
            onOpen={(id) => {
              const c = report.checks.find((x) => x.id === id);
              if (c) {
                setDrawer(c);
                setDrawerTab("result");
              }
            }}
          />
        ) : tab === "screens" ? (
          <ScreensTab
            report={report}
            onOpenCheck={(id) => {
              const c = report.checks.find((x) => x.id === id);
              if (c) {
                setDrawer(c);
                setDrawerTab("screens");
              }
            }}
            onFocusNode={onFocusNode}
          />
        ) : tab === "runs" ? (
          <RunsTab
            passes={passes}
            jobs={jobs}
            report={report}
            overlapNote={overlapNote}
            expandedPassChecks={expandedPassChecks}
            setExpandedPassChecks={setExpandedPassChecks}
            runDetail={runDetail}
            setRunDetail={setRunDetail}
            events={events}
            onRun={runPass}
            onCancel={cancelJob}
          />
        ) : (
          <EvidenceTab report={report} />
        )}
      </div>

      {drawer && (
        <CheckDrawer
          check={drawer}
          tab={drawerTab}
          setTab={setDrawerTab}
          onClose={() => setDrawer(null)}
          onFocusNode={onFocusNode}
        />
      )}
    </div>
  );
}

function FailuresTab({
  report,
  onOpen,
}: {
  report: SecurityReport;
  onOpen: (id: string) => void;
}) {
  if (!report.failures.length) {
    return <EmptyPanel title="No failures" body="No failed checks in the latest completed results." />;
  }
  return (
    <div className="overflow-x-auto" data-testid="posture-failures">
      <table className="min-w-full text-left text-[13.5px]">
        <thead className="text-[12px] uppercase tracking-wide text-[#6B7280]">
          <tr>
            <th className="px-2 py-2">Severity</th>
            <th className="px-2 py-2">Check</th>
            <th className="px-2 py-2">Why</th>
            <th className="px-2 py-2">Screens</th>
            <th className="px-2 py-2">Expected vs observed</th>
            <th className="px-2 py-2">Fix</th>
          </tr>
        </thead>
        <tbody>
          {report.failures.map((f) => (
            <tr
              key={f.checkId}
              className="cursor-pointer border-t border-[#F3F4F6] hover:bg-[#F5F1FF]/50 dark:border-[#1a1a1a]"
              onClick={() => onOpen(f.checkId)}
            >
              <td className="px-2 py-3">
                <StatusChip status="fail" label={f.severity} />
              </td>
              <td className="px-2 py-3">
                <div className="font-mono text-[12px]">{f.checkId}</div>
                <div className="font-medium">{f.title}</div>
              </td>
              <td className="max-w-[260px] px-2 py-3 text-[#4B5563] dark:text-[#9ca3af]">{f.why || f.reason}</td>
              <td className="px-2 py-3">
                <ul className="space-y-1">
                  {(f.screens || []).map((s) => (
                    <li key={s.id}>
                      <div className="font-medium">{s.name}</div>
                      <div className="text-[12px] text-[#6B7280]">{s.url}</div>
                    </li>
                  ))}
                  {!f.screens?.length && <span className="text-[#6B7280]">No screen mapped</span>}
                </ul>
              </td>
              <td className="max-w-[220px] px-2 py-3 text-[12.5px]">
                <div>
                  <span className="text-[#6B7280]">Expected:</span> {f.expected || "Control present"}
                </div>
                <div>
                  <span className="text-[#6B7280]">Observed:</span> {f.observed || f.why || f.reason}
                </div>
              </td>
              <td className="max-w-[220px] px-2 py-3 text-[12.5px]">{f.fix || f.remediation || "See remediation in drawer"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScreensTab({
  report,
  onOpenCheck,
  onFocusNode,
}: {
  report: SecurityReport;
  onOpenCheck: (id: string) => void;
  onFocusNode?: (nodeId: string) => void;
}) {
  const screens = report.screens || [];
  if (!screens.length) {
    return (
      <EmptyPanel
        title="No screens discovered"
        body="Run Step 0: Site discovery (or Run all passes) to populate screens from the canvas."
      />
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2" data-testid="posture-screens">
      {screens.map((s) => {
        const id = s.nodeId || s.url;
        const related = report.checks.filter((c) => (c.screenIds || []).includes(s.nodeId || ""));
        const fails = related.filter((c) => statusBucket(c.status) === "fail");
        const passes = related.filter((c) => statusBucket(c.status) === "pass");
        return (
          <article
            key={id}
            className="overflow-hidden rounded-[12px] border border-[#E5E7EB] dark:border-[#2a2a2a]"
          >
            <div className="flex gap-3 p-3">
              {s.screenshotUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.screenshotUrl} alt="" className="h-20 w-28 rounded-[8px] object-cover" />
              ) : (
                <div className="flex h-20 w-28 items-center justify-center rounded-[8px] bg-[#F3F4F6] text-[12px] text-[#6B7280] dark:bg-[#1a1a1a]">
                  No shot
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold">{s.name || s.title}</div>
                <div className="truncate text-[12.5px] text-[#6B7280]">{s.url}</div>
                <div className="mt-1 text-[12.5px] text-[#6B7280]">
                  {s.visited ? "Visited in discovery" : "On canvas, not visited"} · Fail {fails.length} · Pass{" "}
                  {passes.length}
                </div>
                {s.nodeId && onFocusNode && (
                  <button
                    type="button"
                    className="mt-1 inline-flex items-center gap-1 text-[12.5px] text-[#8664F2]"
                    onClick={() => onFocusNode(s.nodeId!)}
                  >
                    <TbExternalLink size={13} /> Open on canvas
                  </button>
                )}
              </div>
            </div>
            {(fails.length > 0 || passes.length > 0) && (
              <div className="border-t border-[#F3F4F6] px-3 py-2 text-[12.5px] dark:border-[#1a1a1a]">
                {fails.slice(0, 4).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="mr-2 text-[#991B1B] underline-offset-2 hover:underline"
                    onClick={() => onOpenCheck(c.id)}
                  >
                    {c.id} fail
                  </button>
                ))}
                {passes.slice(0, 3).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="mr-2 text-[#166534] underline-offset-2 hover:underline"
                    onClick={() => onOpenCheck(c.id)}
                  >
                    {c.id} pass
                  </button>
                ))}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

function RunsTab({
  passes,
  jobs,
  report,
  overlapNote,
  expandedPassChecks,
  setExpandedPassChecks,
  runDetail,
  setRunDetail,
  events,
  onRun,
  onCancel,
}: {
  passes: PassInfo[];
  jobs: Job[];
  report: SecurityReport;
  overlapNote: string;
  expandedPassChecks: string | null;
  setExpandedPassChecks: (id: string | null) => void;
  runDetail: { passId: string; jobId: string } | null;
  setRunDetail: (v: { passId: string; jobId: string } | null) => void;
  events: JobEvent[];
  onRun: (passId: string) => void;
  onCancel: (jobId: string) => void;
}) {
  const detailJob = runDetail ? jobs.find((j) => j.id === runDetail.jobId) : null;
  const historyFor = (passId: string) => jobs.filter((j) => j.passId === passId);

  return (
    <div className="space-y-4" data-testid="posture-runs">
      {overlapNote && (
        <p className="rounded-[8px] bg-[#F5F1FF] px-3 py-2 text-[13px] text-[#5B21B6] dark:bg-[#1a1228] dark:text-[#ddd6fe]">
          {overlapNote}
        </p>
      )}
      <div className="grid gap-3">
        {passes.map((p) => {
          const latest = latestJob(jobs, p.id);
          const active = activeJob(jobs, p.id);
          const covers = p.id === "inventory" ? 0 : p.coverage?.covers || 0;
          const resultTally =
            p.id === "inventory"
              ? null
              : report.perPassResults?.[p.id] ||
                (latest?.summary?.tally as Record<string, number> | undefined) ||
                null;
          const prog = active?.progress || latest?.progress || {};
          const duration =
            latest?.startedAt && latest?.finishedAt
              ? `${Math.round((latest.finishedAt - latest.startedAt) / 1000)}s`
              : active?.startedAt
                ? "in progress"
                : "";
          return (
            <article
              key={p.id}
              className="rounded-[12px] border border-[#E5E7EB] p-4 dark:border-[#2a2a2a]"
              data-testid={`pass-card-${p.id}`}
            >
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[15px] font-semibold">{p.title}</h3>
                    <StatusChip status={active?.status || latest?.status || (p.built ? "idle" : "roadmap")} label={active?.status || latest?.status || (p.built ? "idle" : "not built")} />
                  </div>
                  <p className="mt-1 text-[13px] text-[#6B7280]">{p.description}</p>
                  <div className="mt-2 text-[13px]">
                    {p.id === "inventory" ? (
                      <span>Site discovery does not cover checklist checks.</span>
                    ) : (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-[#8664F2]"
                        onClick={() => setExpandedPassChecks(expandedPassChecks === p.id ? null : p.id)}
                      >
                        {expandedPassChecks === p.id ? <TbChevronDown size={14} /> : <TbChevronRight size={14} />}
                        Checks {covers}
                      </button>
                    )}
                    {resultTally && (
                      <span className="ml-3 text-[#6B7280]">
                        Results: Fail {resultTally.fail || 0} · Pass {resultTally.pass || 0} · Partial{" "}
                        {resultTally.partial || 0} · Not tested {resultTally.not_tested || 0}
                      </span>
                    )}
                  </div>
                  {expandedPassChecks === p.id && p.coverage?.byCategory && (
                    <div className="mt-2 grid gap-1 rounded-[8px] bg-[#FAFAFA] p-2 text-[12.5px] dark:bg-[#141414]">
                      {Object.entries(p.coverage.byCategory).map(([cat, ids]) => (
                        <div key={cat}>
                          <strong>{cat}</strong>: {(ids as string[]).join(", ")}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 text-[12.5px] text-[#6B7280]">
                    {latest?.startedAt && <>Started {formatWhen(latest.startedAt)} · </>}
                    {duration && <>Duration {duration} · </>}
                    Triggered by {String(latest?.summary?.triggeredBy || latest?.createdByName || "-")}
                  </div>
                  {active && (
                    <div className="mt-2">
                      <div className="mb-1 text-[13px] font-medium">
                        {String(prog.currentlyDoing || prog.message || "Running")}
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#E5E7EB] dark:bg-[#2a2a2a]">
                        <div
                          className="h-full bg-[#8664F2] transition-all"
                          style={{ width: `${Number(prog.percent) || 5}%` }}
                        />
                      </div>
                      <div className="mt-1 text-[12.5px] text-[#6B7280]">
                        Screens {String(prog.screensVisited ?? "-")}/{String(prog.screensTotal ?? "-")} · Probes{" "}
                        {String(prog.probesSent ?? "-")}/{String(prog.probesTotal ?? "-")} · Detectors{" "}
                        {String(prog.detectorsDone ?? "-")}/{String(prog.detectorsTotal ?? "-")} · Checks{" "}
                        {String(prog.checksEvaluated ?? "-")}/{String(prog.checksTotal ?? "-")}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {p.built && !active && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-[8px] bg-[#8664F2] px-2.5 py-1.5 text-[12.5px] text-white"
                      onClick={() => onRun(p.id)}
                    >
                      <TbPlayerPlay size={14} /> Run
                    </button>
                  )}
                  {active && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-[8px] border border-[#FECACA] px-2.5 py-1.5 text-[12.5px] text-[#991B1B]"
                      onClick={() => onCancel(active.id)}
                    >
                      <TbPlayerStop size={14} /> Cancel
                    </button>
                  )}
                  {latest && (
                    <button
                      type="button"
                      className="rounded-[8px] border border-[#E5E7EB] px-2.5 py-1.5 text-[12.5px] dark:border-[#2a2a2a]"
                      onClick={() => setRunDetail({ passId: p.id, jobId: latest.id })}
                    >
                      View run
                    </button>
                  )}
                </div>
              </div>
              {historyFor(p.id).length > 1 && (
                <div className="mt-3 border-t border-[#F3F4F6] pt-2 text-[12.5px] dark:border-[#1a1a1a]">
                  <div className="mb-1 font-medium">History</div>
                  <ul className="space-y-1 text-[#6B7280]">
                    {historyFor(p.id)
                      .slice(0, 8)
                      .map((j) => (
                        <li key={j.id}>
                          <button type="button" className="text-left hover:text-[#8664F2]" onClick={() => setRunDetail({ passId: p.id, jobId: j.id })}>
                            {formatWhen(j.finishedAt || j.startedAt)} · {j.status}
                            {j.error ? ` · ${j.error}` : ""}
                          </button>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {runDetail && detailJob && (
        <div className="rounded-[12px] border border-[#8664F2]/40 bg-[#FAFAFA] p-4 dark:bg-[#141414]" data-testid="run-detail">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-[15px] font-semibold">
              Run detail · {passes.find((p) => p.id === runDetail.passId)?.title || runDetail.passId}
            </h3>
            <button type="button" onClick={() => setRunDetail(null)} aria-label="Close run detail">
              <TbX size={16} />
            </button>
          </div>
          <p className="text-[13px] text-[#6B7280]">
            Status {detailJob.status} · Started {formatWhen(detailJob.startedAt)} ·{" "}
            {detailJob.summary?.durationMs != null
              ? `Duration ${Math.round(Number(detailJob.summary.durationMs) / 1000)}s`
              : ""}{" "}
            · Triggered by {String(detailJob.summary?.triggeredBy || detailJob.createdByName || "-")}
          </p>
          {detailJob.summary?.message != null ? (
            <p className="mt-1 text-[13.5px]">{String(detailJob.summary.message)}</p>
          ) : null}
          {detailJob.error ? <p className="mt-1 text-[13px] text-[#991B1B]">{detailJob.error}</p> : null}

          {runDetail.passId === "inventory" && detailJob.summary?.discoveryReport != null ? (
            <DiscoveryReportBlock report={detailJob.summary.discoveryReport as Record<string, unknown>} />
          ) : null}

          {Array.isArray(detailJob.summary?.probeOutcomes) && detailJob.summary.probeOutcomes.length > 0 ? (
            <div className="mt-3">
              <h4 className="mb-1 text-[13px] font-semibold">Probe outcomes</h4>
              <div className="max-h-48 overflow-auto rounded-[8px] border border-[#E5E7EB] dark:border-[#2a2a2a]">
                <table className="min-w-full text-[12.5px]">
                  <thead>
                    <tr className="text-left text-[#6B7280]">
                      <th className="px-2 py-1">Path</th>
                      <th className="px-2 py-1">Status</th>
                      <th className="px-2 py-1">Verdict</th>
                      <th className="px-2 py-1">Detector</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detailJob.summary!.probeOutcomes as Array<Record<string, unknown>>).slice(0, 80).map((p, i) => (
                      <tr key={i} className="border-t border-[#F3F4F6] dark:border-[#1a1a1a]">
                        <td className="px-2 py-1 font-mono">{String(p.path)}</td>
                        <td className="px-2 py-1">{String(p.status ?? "-")}</td>
                        <td className="px-2 py-1">{String(p.verdict)}</td>
                        <td className="px-2 py-1">{String(p.detector)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <h4 className="mb-1 mt-3 text-[13px] font-semibold">Step timeline / log</h4>
          <div className="max-h-64 overflow-auto rounded-[8px] border border-[#E5E7EB] dark:border-[#2a2a2a]">
            <table className="min-w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[#6B7280]">
                  <th className="px-2 py-1">Time</th>
                  <th className="px-2 py-1">Step</th>
                  <th className="px-2 py-1">Detail</th>
                  <th className="px-2 py-1">URL / screen</th>
                  <th className="px-2 py-1">Detector</th>
                  <th className="px-2 py-1">Result</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-t border-[#F3F4F6] dark:border-[#1a1a1a]">
                    <td className="whitespace-nowrap px-2 py-1">{formatWhen(e.at)}</td>
                    <td className="px-2 py-1">{e.step}</td>
                    <td className="px-2 py-1">{e.detail}</td>
                    <td className="max-w-[180px] truncate px-2 py-1">{e.url || e.screenId}</td>
                    <td className="px-2 py-1">{e.detector}</td>
                    <td className="px-2 py-1">{e.result}</td>
                  </tr>
                ))}
                {!events.length && (
                  <tr>
                    <td colSpan={6} className="px-2 py-3 text-[#6B7280]">
                      No events stored for this run.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function DiscoveryReportBlock({ report }: { report: Record<string, unknown> }) {
  const screens = (report.screens as Array<Record<string, unknown>>) || [];
  return (
    <div className="mt-3 rounded-[8px] border border-[#E5E7EB] p-3 text-[13px] dark:border-[#2a2a2a]">
      <h4 className="font-semibold">Site discovery report</h4>
      <p className="mt-1 text-[#6B7280]">
        Screens {String(report.screensVisited)}/{String(report.screensTotal)} · Responses{" "}
        {String(report.requestsSeen)} · Storage keys {String(report.storageKeyCount ?? 0)} · JS excerpts{" "}
        {String(report.jsExcerptCount ?? 0)}
      </p>
      <ul className="mt-2 space-y-1">
        {screens.slice(0, 12).map((s, i) => (
          <li key={i}>
            <strong>{String(s.title || s.name || s.nodeId)}</strong> · {String(s.url)}
          </li>
        ))}
      </ul>
      {Array.isArray(report.crawlErrors) && report.crawlErrors.length > 0 && (
        <p className="mt-2 text-[#991B1B]">Errors: {(report.crawlErrors as string[]).join("; ")}</p>
      )}
    </div>
  );
}

function EvidenceTab({ report }: { report: SecurityReport }) {
  const discovery = report.discovery || {};
  const probes = report.probeOutcomes || [];
  const precision = report.precisionEvidence || [];
  return (
    <div className="space-y-4" data-testid="posture-evidence">
      <section className="rounded-[12px] border border-[#E5E7EB] p-4 dark:border-[#2a2a2a]">
        <h3 className="text-[15px] font-semibold">Security headers</h3>
        <p className="mt-1 text-[13px] text-[#6B7280]">
          Header findings come from Pass 1 on discovered responses. Open Failures for BRW-* checks.
        </p>
        {!report.failures.some((f) => f.checkId.startsWith("BRW")) && (
          <p className="mt-2 text-[13px]">No header failures in the latest completed results. Run Pass 1 to populate.</p>
        )}
      </section>
      <section className="rounded-[12px] border border-[#E5E7EB] p-4 dark:border-[#2a2a2a]">
        <h3 className="text-[15px] font-semibold">CSP analyzer</h3>
        <p className="mt-1 text-[13px] text-[#6B7280]">
          {report.failures.find((f) => f.checkId === "BRW-01")?.why ||
            "No CSP failure recorded. Run Pass 1 after site discovery."}
        </p>
      </section>
      <section className="rounded-[12px] border border-[#E5E7EB] p-4 dark:border-[#2a2a2a]">
        <h3 className="text-[15px] font-semibold">Cookie inspector</h3>
        <p className="mt-1 text-[13px] text-[#6B7280]">
          {(discovery.cookies as unknown[])?.length
            ? `${(discovery.cookies as unknown[]).length} cookie records in discovery`
            : "No cookies captured yet. Run Step 0: Site discovery."}
        </p>
      </section>
      <section className="rounded-[12px] border border-[#E5E7EB] p-4 dark:border-[#2a2a2a]">
        <h3 className="text-[15px] font-semibold">Third-party inventory</h3>
        <p className="mt-1 text-[13px] text-[#6B7280]">
          Hosts: {((discovery.hosts as string[]) || []).join(", ") || "None yet. Run site discovery."}
        </p>
      </section>
      <section className="rounded-[12px] border border-[#E5E7EB] p-4 dark:border-[#2a2a2a]">
        <h3 className="text-[15px] font-semibold">Pass 2 probe outcomes</h3>
        {!probes.length ? (
          <p className="mt-1 text-[13px] text-[#6B7280]">No probe log yet. Run Pass 2 after site discovery.</p>
        ) : (
          <div className="mt-2 max-h-56 overflow-auto">
            <table className="min-w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[#6B7280]">
                  <th className="px-2 py-1">Path</th>
                  <th className="px-2 py-1">Status</th>
                  <th className="px-2 py-1">Verdict</th>
                  <th className="px-2 py-1">Detector</th>
                </tr>
              </thead>
              <tbody>
                {probes.slice(0, 100).map((p, i) => (
                  <tr key={i} className="border-t border-[#F3F4F6] dark:border-[#1a1a1a]">
                    <td className="px-2 py-1 font-mono">{p.path}</td>
                    <td className="px-2 py-1">{p.status ?? "-"}</td>
                    <td className="px-2 py-1">{p.verdict}</td>
                    <td className="px-2 py-1">{p.detector}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="rounded-[12px] border border-[#E5E7EB] p-4 dark:border-[#2a2a2a]">
        <h3 className="text-[15px] font-semibold">Precision evidence (harness)</h3>
        <p className="mt-1 text-[13px] text-[#6B7280]">
          Known-positive and known-negative cases per detector. Actual fills in after probes run against the harness.
        </p>
        <div className="mt-2 overflow-auto">
          <table className="min-w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-[#6B7280]">
                <th className="px-2 py-1">Detector</th>
                <th className="px-2 py-1">Case</th>
                <th className="px-2 py-1">Expected</th>
                <th className="px-2 py-1">Actual</th>
                <th className="px-2 py-1">Agreement</th>
              </tr>
            </thead>
            <tbody>
              {precision.map((c, i) => (
                <tr key={i} className="border-t border-[#F3F4F6] dark:border-[#1a1a1a]">
                  <td className="px-2 py-1">{c.detectorId}</td>
                  <td className="px-2 py-1">{c.caseType.replace(/_/g, " ")}</td>
                  <td className="px-2 py-1">{c.expected}</td>
                  <td className="px-2 py-1">{c.actual || "Not run"}</td>
                  <td className="px-2 py-1">{c.agreement || "not_run"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function CheckDrawer({
  check,
  tab,
  setTab,
  onClose,
  onFocusNode,
}: {
  check: CheckRow;
  tab: "result" | "screens" | "evidence" | "how" | "remediation" | "history";
  setTab: (t: typeof tab) => void;
  onClose: () => void;
  onFocusNode?: (nodeId: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" role="dialog" aria-modal="true" data-testid="check-drawer">
      <div className="flex h-full w-full max-w-[560px] flex-col bg-white shadow-xl dark:bg-[#141414]">
        <div className="flex items-start gap-2 border-b border-[#E5E7EB] px-4 py-3 dark:border-[#2a2a2a]">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[12px] text-[#6B7280]">{check.id}</div>
            <h3 className="text-[16px] font-semibold">{check.name}</h3>
            <div className="mt-1">
              <StatusChip status={check.status} label={check.statusLabel} />
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close drawer">
            <TbX size={18} />
          </button>
        </div>
        <div className="flex gap-1 overflow-x-auto border-b border-[#E5E7EB] px-2 dark:border-[#2a2a2a]">
          {(
            [
              ["result", "Result"],
              ["screens", "Screens"],
              ["evidence", "Evidence"],
              ["how", "How we test"],
              ["remediation", "Remediation"],
              ["history", "History"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`whitespace-nowrap px-3 py-2 text-[13px] ${
                tab === id ? "border-b-2 border-[#8664F2] text-[#8664F2]" : "text-[#6B7280]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 text-[13.5px]">
          {tab === "result" && (
            <div className="space-y-3">
              <p>{check.reason}</p>
              <div className="grid grid-cols-2 gap-2 text-[13px]">
                <div>
                  <div className="text-[#6B7280]">Severity</div>
                  <div className="font-medium">{check.severity || "n/a"}</div>
                </div>
                <div>
                  <div className="text-[#6B7280]">Detector</div>
                  <div className="font-medium">{(check.detectors || []).join(", ") || "n/a"}</div>
                </div>
                <div>
                  <div className="text-[#6B7280]">Pass</div>
                  <div className="font-medium">{passLabel(check.primaryPass)}</div>
                </div>
                <div>
                  <div className="text-[#6B7280]">Automation</div>
                  <div className="font-medium">{check.automationLevel}</div>
                </div>
              </div>
              <div>
                <div className="text-[#6B7280]">Expected</div>
                <div>{check.expected || "Control present and correctly configured"}</div>
              </div>
              <div>
                <div className="text-[#6B7280]">Observed</div>
                <div>{check.observed || check.reason}</div>
              </div>
              {check.status === "not_tested" && (
                <p className="rounded-[8px] bg-[#F3F4F6] p-2 text-[13px] dark:bg-[#1a1a1a]">
                  Missing: {check.reason}. Action: run {passLabel(check.primaryPass)}
                  {check.futurePass ? ` (or wait for ${check.futurePass})` : ""}.
                </p>
              )}
              {check.humanByName && (
                <p className="text-[13px] text-[#6B7280]">
                  Human verified by {check.humanByName}
                  {check.humanAt ? ` on ${formatWhen(check.humanAt)}` : ""}
                  {check.humanNotes ? ` · ${check.humanNotes}` : ""}
                </p>
              )}
            </div>
          )}
          {tab === "screens" && (
            <div className="space-y-2">
              {(check.screens || []).length === 0 && (
                <p className="text-[#6B7280]">No screens recorded for this check.</p>
              )}
              {(check.screens || []).map((s) => (
                <div key={s.id} className="rounded-[8px] border border-[#E5E7EB] p-2 dark:border-[#2a2a2a]">
                  <div className="font-medium">{s.name}</div>
                  <div className="text-[12.5px] text-[#6B7280]">{s.url}</div>
                  <div className="mt-1 text-[12.5px]">
                    Verdict: {check.statusLabel} · Observed: {check.observed || check.reason}
                  </div>
                  {s.screenshotUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.screenshotUrl} alt="" className="mt-2 h-24 rounded object-cover" />
                  )}
                  {onFocusNode && (
                    <button
                      type="button"
                      className="mt-1 text-[12.5px] text-[#8664F2]"
                      onClick={() => onFocusNode(s.id)}
                    >
                      Open on canvas
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {tab === "evidence" && (
            <pre className="overflow-auto rounded-[8px] bg-[#FAFAFA] p-2 text-[12px] dark:bg-[#0f0f0f]">
              {JSON.stringify(check.evidence || {}, null, 2)}
            </pre>
          )}
          {tab === "how" && (
            <div className="space-y-2">
              <div>Detectors: {(check.detectors || []).join(", ") || "n/a"}</div>
              <div>Pass: {passLabel(check.primaryPass)}</div>
              <div>Automation: {check.automationLevel}</div>
              <div>Box: {check.box || "n/a"}</div>
              {check.automationReason && <div>Why partial / not tested: {check.automationReason}</div>}
            </div>
          )}
          {tab === "remediation" && (
            <div>
              {(check.status === "fail" || check.status === "partial") && !check.remediation ? (
                <p>Apply the missing control and re-run the covering pass.</p>
              ) : (
                <pre className="whitespace-pre-wrap rounded-[8px] bg-[#FAFAFA] p-2 text-[13px] dark:bg-[#0f0f0f]">
                  {check.remediation || "No remediation required for this status."}
                </pre>
              )}
              <div className="mt-2 text-[12.5px] text-[#6B7280]">
                ASVS {check.asvs || "-"} · CWE {check.cwe || "-"} · OWASP {check.owasp || "-"}
              </div>
            </div>
          )}
          {tab === "history" && (
            <div className="text-[13px] text-[#6B7280]">
              Last tested {formatWhen(check.lastTestedAt)}
              {check.humanByName && (
                <div className="mt-2">
                  Attestation: {check.humanByName} · {formatWhen(check.humanAt)} · {check.humanStatus}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function CanvasPosture({
  client,
  canvasId,
  projectId: _projectId,
  canvasName,
  appUrl,
  onFocusNode,
}: {
  client: AtlasClient;
  canvasId: string | null;
  projectId?: string | null;
  canvasName?: string | null;
  appUrl?: string | null;
  onFocusNode?: (nodeId: string) => void;
}) {
  if (!canvasId) {
    return (
      <EmptyPanel
        title="Open a canvas"
        body="Select a recorded canvas to review security posture."
      />
    );
  }
  return (
    <Suspense fallback={<Skeleton className="m-5 h-40" />}>
      <CanvasPostureInner
        client={client}
        canvasId={canvasId}
        canvasName={canvasName}
        appUrl={appUrl}
        onFocusNode={onFocusNode}
      />
    </Suspense>
  );
}
