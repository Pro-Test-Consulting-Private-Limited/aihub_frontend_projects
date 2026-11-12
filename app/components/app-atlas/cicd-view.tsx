"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  TbAlertTriangle,
  TbArrowsDiff,
  TbCheck,
  TbCopy,
  TbFlame,
  TbLoader2,
  TbPlayerPlay,
  TbPlus,
  TbRefresh,
  TbShieldCheck,
  TbTrash,
  TbTrendingUp,
  TbX,
} from "react-icons/tb";
import type { AtlasClient } from "@/app/services/appatlas";
import type {
  CaseResult,
  CicdPipeline,
  CicdSnippets,
  PipelineRun,
  SuiteCase,
  SuiteLayer,
} from "@/app/interfaces/appatlas";
import { useApiSpec, useApiSpecView } from "@/app/hooks/use-api-spec";

function statusColor(s: string) {
  if (s === "passed") return "text-[#15803D] bg-[#ECFDF5] border-[#BBF7D0]";
  if (s === "failed") return "text-[#991B1B] bg-[#FEF2F2] border-[#FECACA]";
  if (s === "running" || s === "queued") return "text-[#1D4ED8] bg-[#EFF6FF] border-[#BFDBFE]";
  return "text-[#5E6066] bg-[#F4F4F5] border-[#E5E7EB]";
}

const LAYER_LABEL: Record<SuiteLayer, string> = {
  contract: "Contract",
  functional: "Functional",
  data_driven: "Data-driven",
  schema: "Schema",
  chain: "API chain",
};

const LAYER_HELP: Record<SuiteLayer, string> = {
  contract: "Status + shape vs OpenAPI",
  functional: "Business happy paths",
  data_driven: "Examples & param matrix",
  schema: "Response schema (API unit)",
  chain: "Cross-module flows",
};

const LAYERS = Object.keys(LAYER_LABEL) as SuiteLayer[];

type Panel = "dashboard" | "suites" | "quality" | "runs" | "trends" | "connect";

function caseKey(c: { method: string; path: string; layer: string }) {
  return `${c.layer}|${c.method}|${c.path}`;
}

function ago(ts: number) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

type PassPoint = {
  runId: string;
  pct: number;
  title: string;
  sha: string | null;
  branch: string | null;
  status: string;
  createdAt: number;
  failed: number;
  passed: number;
};

function LayerMiniSpark({ values }: { values: number[] }) {
  if (values.length < 2) return <div className="mt-1.5 h-6" />;
  const w = 120;
  const h = 24;
  const pad = 2;
  const pts = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (w - pad * 2);
      const y = h - pad - (Math.min(100, Math.max(0, v)) / 100) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");
  const last = values[values.length - 1] ?? 100;
  const stroke = last >= 95 ? "#16A34A" : last >= 80 ? "#CA8A04" : "#DC2626";
  return (
    <svg width={w} height={h} className="mt-1.5" viewBox={`0 0 ${w} ${h}`}>
      <polyline fill="none" stroke={stroke} strokeWidth="1.5" points={pts} />
    </svg>
  );
}

function PassRateChart({
  points,
  selectedId,
  onSelect,
  wide,
}: {
  points: PassPoint[];
  selectedId: string | null;
  onSelect: (runId: string) => void;
  wide?: boolean;
}) {
  if (points.length < 2) return <div className="h-10 text-[11px] text-[#9CA3AF]">Need more runs</div>;
  const w = wide ? 520 : 160;
  const h = wide ? 88 : 40;
  const pad = wide ? 10 : 4;
  const max = 100;
  const coords = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (w - pad * 2);
    const y = h - pad - (p.pct / max) * (h - pad * 2);
    return { ...p, x, y };
  });
  const pts = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const selected = coords.find((c) => c.runId === selectedId) ?? coords[coords.length - 1];
  return (
    <div className={wide ? "w-full" : ""}>
      <svg width={wide ? "100%" : w} height={h} viewBox={`0 0 ${w} ${h}`} className="max-w-full cursor-pointer">
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#E5E7EB" strokeWidth="1" />
        <line
          x1={pad}
          y1={h - pad - 0.95 * (h - pad * 2)}
          x2={w - pad}
          y2={h - pad - 0.95 * (h - pad * 2)}
          stroke="#BBF7D0"
          strokeWidth="1"
          strokeDasharray="4 3"
        />
        <polyline fill="none" stroke="#6D4AE8" strokeWidth="2" points={pts} />
        {coords.map((c) => (
          <g key={c.runId} onClick={() => onSelect(c.runId)} className="cursor-pointer">
            <circle
              cx={c.x}
              cy={c.y}
              r={c.runId === selected?.runId ? 5.5 : 3.5}
              fill={c.pct >= 95 ? "#16A34A" : c.pct >= 80 ? "#CA8A04" : "#DC2626"}
              stroke={c.runId === selected?.runId ? "#1F1F1F" : "white"}
              strokeWidth={c.runId === selected?.runId ? 1.5 : 1}
            />
            <title>
              {c.pct}% · {c.title}
              {c.sha ? ` · ${c.sha.slice(0, 7)}` : ""}
            </title>
          </g>
        ))}
      </svg>
      {selected && (
        <button
          type="button"
          onClick={() => onSelect(selected.runId)}
          className={`mt-1 w-full rounded-[8px] border border-[#E8E4F0] bg-[#FAFAFC] px-2.5 py-1.5 text-left transition hover:border-[#D4C4FF] ${
            wide ? "text-[12px]" : "text-[10.5px]"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold tabular-nums text-[#1F1F1F]">{selected.pct}%</span>
            <span className={`rounded-full border px-1.5 py-0.5 text-[9px] uppercase ${statusColor(selected.status)}`}>
              {selected.status}
            </span>
          </div>
          <div className="mt-0.5 truncate font-medium text-[#374151]">{selected.title}</div>
          <div className="truncate font-mono text-[10px] text-[#6D4AE8]">
            {selected.sha ? selected.sha.slice(0, 7) : "—"}
            {selected.branch ? <span className="ml-1.5 font-sans text-[#9CA3AF]">{selected.branch}</span> : null}
            <span className="ml-1.5 font-sans text-[#9CA3AF]">
              · {selected.passed}✓ {selected.failed}✗ · {ago(selected.createdAt)}
            </span>
          </div>
        </button>
      )}
    </div>
  );
}

export function CicdView({ client, canvasId = null }: { client: AtlasClient; canvasId?: string | null }) {
  const [pipelines, setPipelines] = useState<CicdPipeline[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [runs, setRuns] = useState<PipelineRun[] | null>(null);
  const [openRunId, setOpenRunId] = useState<string | null>(null);
  const [snippets, setSnippets] = useState<CicdSnippets | null>(null);
  const [secretOnce, setSecretOnce] = useState<string | null>(null);
  const [snippetTab, setSnippetTab] = useState<"jenkins" | "githubActions" | "curl">("jenkins");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [panel, setPanel] = useState<Panel>("dashboard");
  const [suiteFilter, setSuiteFilter] = useState<SuiteLayer | "all">("all");
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [swaggerUrl, setSwaggerUrl] = useState("");
  const [chartRunId, setChartRunId] = useState<string | null>(null);
  const [sitGate, setSitGate] = useState<{ q1Open: number; highOpen: number; q1: number; high: number } | null>(null);

  const selected = pipelines.find((p) => p.id === selectedId) ?? null;
  const openRun = runs?.find((r) => r.id === openRunId) ?? null;
  const latest = runs?.[0] ?? null;
  const previous = runs?.[1] ?? null;

  const spec = useApiSpec(selected?.swaggerUrl ?? null);
  const { modules, rows, passScore } = useApiSpecView(spec);

  const loadPipelines = useCallback(async () => {
    setError(null);
    try {
      const r = await client.listCicdPipelines();
      setPipelines(r.items);
      setSelectedId((prev) => (prev && r.items.some((p) => p.id === prev) ? prev : r.items[0]?.id ?? null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load pipelines.");
    }
  }, [client]);

  const loadRuns = useCallback(async () => {
    if (!selectedId) {
      setRuns([]);
      return;
    }
    try {
      const r = await client.listPipelineRuns(selectedId);
      setRuns(r.items);
      if (r.items[0] && (r.items[0].status === "running" || r.items[0].status === "queued")) {
        setOpenRunId(r.items[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load runs.");
      setRuns([]);
    }
  }, [client, selectedId]);

  useEffect(() => {
    void loadPipelines();
  }, [loadPipelines]);

  useEffect(() => {
    void loadRuns();
    if (!selectedId) return;
    const t = setInterval(() => void loadRuns(), 5000);
    return () => clearInterval(t);
  }, [loadRuns, selectedId]);

  useEffect(() => {
    if (!canvasId) {
      setSitGate(null);
      return;
    }
    let cancelled = false;
    void client
      .sitCoverage(canvasId)
      .then((cov) => {
        if (cancelled) return;
        let q1 = 0;
        let high = 0;
        let q1Open = 0;
        let highOpen = 0;
        for (const t of Object.values(cov.tickets || {})) {
          const q1n = Number(t.byQuadrant?.Q1 || 0);
          const highN =
            Number(t.bySeverity?.High || 0) +
            Number(t.bySeverity?.Critical || 0) +
            Number(t.bySeverity?.Highest || 0);
          const passed = Number(t.byExecutionStatus?.Passed || 0);
          const tests = Number(t.tests || 0);
          const open = Math.max(0, tests - passed);
          q1 += q1n;
          high += highN;
          if (q1n > 0 && open > 0) q1Open += q1n;
          if (highN > 0 && open > 0) highOpen += highN;
        }
        setSitGate({ q1, high, q1Open, highOpen });
      })
      .catch(() => {
        if (!cancelled) setSitGate(null);
      });
    return () => {
      cancelled = true;
    };
  }, [client, canvasId]);

  const passPoints = useMemo((): PassPoint[] => {
    return (runs ?? [])
      .filter((r) => r.results?.length)
      .slice(0, 12)
      .reverse()
      .map((r) => {
        const passed = r.results!.filter((c) => c.status === "passed").length;
        const failed = r.results!.filter((c) => c.status === "failed").length;
        const t = r.results!.length;
        return {
          runId: r.id,
          pct: Math.round((passed / t) * 100),
          title: r.title,
          sha: r.sha,
          branch: r.branch,
          status: r.status,
          createdAt: r.createdAt,
          passed,
          failed,
        };
      });
  }, [runs]);

  useEffect(() => {
    if (!passPoints.length) {
      setChartRunId(null);
      return;
    }
    setChartRunId((prev) => (prev && passPoints.some((p) => p.runId === prev) ? prev : passPoints[passPoints.length - 1].runId));
  }, [passPoints]);

  const topFailures = useMemo(() => {
    const map = new Map<string, { label: string; layer: SuiteLayer; count: number }>();
    for (const r of runs ?? []) {
      for (const c of r.results ?? []) {
        if (c.status !== "failed") continue;
        const k = caseKey(c);
        const cur = map.get(k) ?? { label: `${c.method} ${c.path}`, layer: c.layer, count: 0 };
        cur.count++;
        map.set(k, cur);
      }
    }
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 8);
  }, [runs]);

  const layerTrend = useMemo(() => {
    return LAYERS.map((layer) => {
      const series = (runs ?? [])
        .filter((r) => r.results?.length)
        .slice(0, 10)
        .reverse()
        .map((r) => {
          const rs = r.results!.filter((c) => c.layer === layer);
          if (!rs.length) return 100;
          return Math.round((rs.filter((c) => c.status === "passed").length / rs.length) * 100);
        });
      const latestPct = series[series.length - 1] ?? 100;
      const fails = latest?.results?.filter((c) => c.layer === layer && c.status === "failed").length ?? 0;
      return { layer, series, latestPct, fails };
    });
  }, [runs, latest]);

  const timeToGreen = useMemo(() => {
    const list = runs ?? [];
    if (list.length < 2) return null;
    // newest first: find latest fail, then next older pass after it chronologically = time between
    const newestFail = list.find((r) => r.status === "failed");
    if (!newestFail) return { label: "Currently green", hours: 0 };
    const after = list.filter((r) => r.createdAt > newestFail.createdAt && r.status === "passed");
    if (!after.length) return { label: "Still red since last fail", hours: (Date.now() - newestFail.createdAt) / 3600000 };
    const green = after[after.length - 1];
    return {
      label: "Last recovery",
      hours: Math.max(0.1, (green.createdAt - newestFail.createdAt) / 3600000),
      from: newestFail.title,
      to: green.title,
    };
  }, [runs]);

  const flaky = useMemo(() => {
    const map = new Map<string, { key: string; label: string; pass: number; fail: number }>();
    for (const r of runs ?? []) {
      for (const c of r.results ?? []) {
        const k = caseKey(c);
        const cur = map.get(k) ?? { key: k, label: `${c.method} ${c.path}`, pass: 0, fail: 0 };
        if (c.status === "passed") cur.pass++;
        if (c.status === "failed") cur.fail++;
        map.set(k, cur);
      }
    }
    return [...map.values()].filter((x) => x.pass > 0 && x.fail > 0).sort((a, b) => b.fail - a.fail).slice(0, 8);
  }, [runs]);

  const compare = useMemo(() => {
    if (!latest?.results || !previous?.results) return null;
    const prev = new Map(previous.results.map((c) => [caseKey(c), c]));
    const regressed: CaseResult[] = [];
    const fixed: CaseResult[] = [];
    for (const c of latest.results) {
      const p = prev.get(caseKey(c));
      if (!p) continue;
      if (p.status === "passed" && c.status === "failed") regressed.push(c);
      if (p.status === "failed" && c.status === "passed") fixed.push(c);
    }
    return { regressed, fixed };
  }, [latest, previous]);

  const layerStats = useMemo(() => {
    const results = latest?.results;
    return LAYERS.map((layer) => {
      const rs = results?.filter((c) => c.layer === layer) ?? [];
      return {
        layer,
        total: selected?.suite?.counts[layer] ?? rs.length,
        passed: rs.filter((c) => c.status === "passed").length,
        failed: rs.filter((c) => c.status === "failed").length,
        avgMs: rs.length ? Math.round(rs.reduce((a, b) => a + b.ms, 0) / rs.length) : 0,
      };
    });
  }, [latest, selected]);

  const gate = useMemo(() => {
    const qualityBlocked = rows.filter((r) => !r.pass).length;
    const sitBlocked = (sitGate?.q1Open || 0) > 0 || (sitGate?.highOpen || 0) > 0;
    const runOk = latest?.status === "passed";
    const runFail = latest?.status === "failed";
    const live = latest?.status === "running" || latest?.status === "queued";
    if (live) return { state: "running" as const, label: "Run in progress", detail: latest?.title ?? "" };
    if (!latest && !sitGate) return { state: "idle" as const, label: "No gate yet", detail: "Run a suite or wait for CI" };
    if (runFail || qualityBlocked > 0 || sitBlocked) {
      const sitDetail =
        sitBlocked && sitGate
          ? [
              sitGate.q1Open > 0 ? `${sitGate.q1Open} Q1 case(s) not Passed` : null,
              sitGate.highOpen > 0 ? `${sitGate.highOpen} High/Critical case(s) not Passed` : null,
            ]
              .filter(Boolean)
              .join(" · ")
          : null;
      return {
        state: "blocked" as const,
        label: "Release gate blocked",
        detail: runFail
          ? latest?.summary || "Suite failures"
          : qualityBlocked > 0
            ? `${qualityBlocked} endpoints below spec quality bar`
            : sitDetail || "SIT promote gate",
      };
    }
    if (runOk || (!latest && sitGate && !sitBlocked)) {
      const sitOk =
        sitGate && sitGate.q1 + sitGate.high > 0
          ? ` · SIT Q1 ${sitGate.q1} / High ${sitGate.high} clear`
          : sitGate
            ? " · SIT clear"
            : "";
      return {
        state: "green" as const,
        label: "Release gate green",
        detail: (latest?.summary || "All suite layers passed") + sitOk,
      };
    }
    return { state: "idle" as const, label: "Waiting", detail: "" };
  }, [latest, rows, sitGate]);

  const suiteCases: SuiteCase[] = useMemo(() => {
    const cases = selected?.suite?.cases ?? [];
    if (suiteFilter === "all") return cases;
    return cases.filter((c) => c.layer === suiteFilter);
  }, [selected, suiteFilter]);

  const envBadge = useMemo(() => {
    const u = selected?.baseUrl ?? "";
    if (/demo|localhost|127\.0\.0\.1/i.test(u)) return { label: "Demo / local", tone: "bg-[#FEF3C7] text-[#92400E]" };
    if (/staging|sit|uat|preview/i.test(u)) return { label: "Staging", tone: "bg-[#DBEAFE] text-[#1E40AF]" };
    if (/prod|api\./i.test(u)) return { label: "Production target", tone: "bg-[#FCE7F3] text-[#9D174D]" };
    return { label: "Custom target", tone: "bg-[#F3F4F6] text-[#374151]" };
  }, [selected]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  const createWalletDemo = async () => {
    setBusy("demo");
    setError(null);
    try {
      const r = await client.createWalletCicdDemo();
      setSecretOnce(r.triggerSecret);
      setSnippets(r.snippets);
      await loadPipelines();
      setSelectedId(r.pipeline.id);
      setRuns(r.runs);
      setShowCreate(false);
      setPanel("dashboard");
      setOpenRunId(r.runs.find((x) => x.status === "failed")?.id ?? r.runs[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create Digital Wallet demo.");
    } finally {
      setBusy(null);
    }
  };

  const createCustom = async () => {
    setBusy("create");
    setError(null);
    try {
      const r = await client.createCicdPipeline({
        name: name.trim() || "API pipeline",
        baseUrl: baseUrl.trim(),
        swaggerUrl: swaggerUrl.trim(),
      });
      setSecretOnce(r.triggerSecret);
      setSnippets(r.snippets);
      await loadPipelines();
      setSelectedId(r.pipeline.id);
      setShowCreate(false);
      setPanel("connect");
      setName("");
      setBaseUrl("");
      setSwaggerUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create pipeline.");
    } finally {
      setBusy(null);
    }
  };

  const runNow = async (event: "manual" | "pull_request" | "push" = "manual") => {
    if (!selectedId) return;
    setBusy("run");
    setError(null);
    setPanel("runs");
    try {
      const titles = {
        manual: "Manual suite run",
        pull_request: "PR opened / updated",
        push: "Push / merge to main",
      };
      const run = await client.startPipelineRun(selectedId, {
        title: titles[event],
        event,
        branch: event === "push" ? "main" : "feat/demo",
      });
      setOpenRunId(run.id);
      await loadRuns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start run.");
    } finally {
      setBusy(null);
    }
  };

  const rotate = async () => {
    if (!selectedId) return;
    setBusy("rotate");
    try {
      const r = await client.rotatePipelineSecret(selectedId);
      setSecretOnce(r.triggerSecret);
      setSnippets(r.snippets);
      setPanel("connect");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rotate secret.");
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!selectedId) return;
    setBusy("delete");
    try {
      await client.deleteCicdPipeline(selectedId);
      setSelectedId(null);
      setSnippets(null);
      setSecretOnce(null);
      await loadPipelines();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete.");
    } finally {
      setBusy(null);
    }
  };

  const panels: { id: Panel; label: string }[] = [
    { id: "dashboard", label: "Dashboard" },
    { id: "suites", label: "Suites" },
    { id: "quality", label: "Spec quality" },
    { id: "runs", label: "Live runs" },
    { id: "trends", label: "Trends" },
    { id: "connect", label: "Connect CI" },
  ];

  const selectChartRun = (runId: string) => {
    setChartRunId(runId);
    setOpenRunId(runId);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#F4F2F8] dark:bg-[#0a0a0a]">
      <div className="shrink-0 border-b border-[#E8E4F0] bg-white px-5 py-3 dark:border-[#1a1a1a] dark:bg-[#101010]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[18px] font-semibold tracking-tight text-[#1F1F1F] dark:text-[#ededed]">CI/CD · API control room</h2>
              <span className="rounded-full bg-[#F4EFFE] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#5B3FD1]">
                Trial
              </span>
            </div>
            <p className="mt-0.5 max-w-2xl text-[12.5px] leading-relaxed text-[#5E6066] dark:text-[#9ca3af]">
              Their runner executes. App Atlas owns the suite truth — contract, functional, data-driven, schema, chain —
              with gates, flaky detection, and spec quality in one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!!busy}
              onClick={() => void createWalletDemo()}
              className="rounded-[9px] bg-[#6D4AE8] px-3.5 py-2 text-[12.5px] font-medium text-white shadow-sm shadow-[#6D4AE8]/25 disabled:opacity-60"
            >
              {busy === "demo" ? "Seeding…" : "Digital Wallet demo"}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate((v) => !v)}
              className="inline-flex items-center gap-1 rounded-[9px] border border-[#E5E7EB] bg-white px-3 py-2 text-[12.5px] dark:border-[#2a2a2a]"
            >
              <TbPlus size={14} /> New pipeline
            </button>
          </div>
        </div>

        {error && <div className="mt-2 rounded-[8px] bg-[#FDF1F1] px-3 py-2 text-[12px] text-[#991B1B]">{error}</div>}
        {secretOnce && (
          <div className="mt-2 rounded-[8px] border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-2 text-[12px] text-[#166534]">
            Trigger secret (copy once): <code className="break-all">{secretOnce}</code>
            <button type="button" className="ml-2 underline" onClick={() => void copy(secretOnce)}>
              Copy
            </button>
          </div>
        )}

        {showCreate && (
          <div className="mt-3 grid gap-2 rounded-[12px] border border-[#E8E4F0] bg-[#FAFAFC] p-3 sm:grid-cols-3 dark:border-[#2a2a2a] dark:bg-[#141414]">
            <input
              className="rounded-[8px] border border-[#E5E7EB] px-3 py-2 text-[13px] dark:border-[#2a2a2a] dark:bg-[#101010]"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="rounded-[8px] border border-[#E5E7EB] px-3 py-2 text-[13px] dark:border-[#2a2a2a] dark:bg-[#101010]"
              placeholder="Base URL https://…"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
            <input
              className="rounded-[8px] border border-[#E5E7EB] px-3 py-2 text-[13px] dark:border-[#2a2a2a] dark:bg-[#101010]"
              placeholder="Swagger / OpenAPI URL"
              value={swaggerUrl}
              onChange={(e) => setSwaggerUrl(e.target.value)}
            />
            <button
              type="button"
              disabled={!!busy || !baseUrl.trim() || !swaggerUrl.trim()}
              onClick={() => void createCustom()}
              className="rounded-[8px] bg-[#6D4AE8] px-3 py-2 text-[13px] font-medium text-white disabled:opacity-60 sm:col-span-3 sm:w-fit"
            >
              {busy === "create" ? "Generating suites…" : "Create pipeline"}
            </button>
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="w-[228px] shrink-0 overflow-y-auto border-r border-[#E8E4F0] bg-white p-3 dark:border-[#1a1a1a] dark:bg-[#101010]">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">Pipelines</div>
          {!pipelines.length && <p className="text-[12px] text-[#7E7E7E]">Seed Digital Wallet demo to explore the control room.</p>}
          <ul className="space-y-1">
            {pipelines.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(p.id);
                    setOpenRunId(null);
                    setPanel("dashboard");
                  }}
                  className={`w-full rounded-[10px] px-2.5 py-2.5 text-left text-[12.5px] transition ${
                    selectedId === p.id
                      ? "bg-[#F3EEFF] text-[#4C2FC9] ring-1 ring-[#D4C4FF]"
                      : "hover:bg-[#F7F7FA] dark:hover:bg-[#141414]"
                  }`}
                >
                  <div className="font-medium">{p.name}</div>
                  <div className="mt-0.5 truncate text-[11px] opacity-70">
                    {p.mode === "demo" ? "demo · " : ""}
                    {p.suite ? `${Object.values(p.suite.counts).reduce((a, b) => a + b, 0)} cases` : "no suite"}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {selected ? (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b border-[#E8E4F0] bg-white px-4 py-2.5 dark:border-[#1a1a1a] dark:bg-[#101010]">
                <div className="mr-2 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[13px] font-semibold">{selected.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${envBadge.tone}`}>{envBadge.label}</span>
                  </div>
                  <div className="truncate text-[11px] text-[#7E7E7E]">
                    {selected.baseUrl} · {selected.swaggerUrl}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => void runNow("pull_request")}
                  className="inline-flex items-center gap-1 rounded-[8px] bg-[#6D4AE8] px-2.5 py-1.5 text-[12px] font-medium text-white"
                >
                  {busy === "run" ? <TbLoader2 className="animate-spin" size={14} /> : <TbPlayerPlay size={14} />}
                  Run as PR
                </button>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => void runNow("push")}
                  className="rounded-[8px] border border-[#E5E7EB] px-2.5 py-1.5 text-[12px] dark:border-[#2a2a2a]"
                >
                  Run as merge
                </button>
                <button type="button" onClick={() => void loadRuns()} className="rounded-[8px] border border-[#E5E7EB] p-1.5 dark:border-[#2a2a2a]">
                  <TbRefresh size={14} />
                </button>
                <button type="button" onClick={() => void rotate()} className="rounded-[8px] border border-[#E5E7EB] px-2.5 py-1.5 text-[12px] dark:border-[#2a2a2a]">
                  Rotate secret
                </button>
                <button type="button" onClick={() => void remove()} className="rounded-[8px] border border-[#FECACA] p-1.5 text-[#991B1B]">
                  <TbTrash size={14} />
                </button>
              </div>

              <div className="flex gap-1 overflow-x-auto border-b border-[#E8E4F0] bg-white px-3 py-1.5 dark:border-[#1a1a1a] dark:bg-[#101010]">
                {panels.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPanel(p.id)}
                    className={`rounded-[7px] px-3 py-1.5 text-[12.5px] ${
                      panel === p.id ? "bg-[#1F1F1F] font-medium text-white dark:bg-[#ededed] dark:text-[#111]" : "text-[#5E6066] hover:bg-[#F4F4F5]"
                    }`}
                  >
                    {p.label}
                    {p.id === "runs" && latest && (latest.status === "running" || latest.status === "queued") ? (
                      <span className="ml-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#22C55E]" />
                    ) : null}
                  </button>
                ))}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {panel === "dashboard" && (
                  <div className="space-y-4">
                    <div
                      className={`flex flex-wrap items-center justify-between gap-3 rounded-[14px] border px-4 py-3 ${
                        gate.state === "green"
                          ? "border-[#BBF7D0] bg-gradient-to-r from-[#F0FDF4] to-white"
                          : gate.state === "blocked"
                            ? "border-[#FECACA] bg-gradient-to-r from-[#FEF2F2] to-white"
                            : gate.state === "running"
                              ? "border-[#BFDBFE] bg-gradient-to-r from-[#EFF6FF] to-white"
                              : "border-[#E5E7EB] bg-white"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-full ${
                            gate.state === "green"
                              ? "bg-[#16A34A] text-white"
                              : gate.state === "blocked"
                                ? "bg-[#DC2626] text-white"
                                : gate.state === "running"
                                  ? "bg-[#2563EB] text-white"
                                  : "bg-[#E5E7EB] text-[#6B7280]"
                          }`}
                        >
                          {gate.state === "green" ? <TbCheck size={18} /> : gate.state === "blocked" ? <TbX size={18} /> : <TbShieldCheck size={18} />}
                        </div>
                        <div>
                          <div className="text-[15px] font-semibold">{gate.label}</div>
                          <div className="text-[12.5px] text-[#5E6066]">{gate.detail}</div>
                          {latest && (
                            <div className="mt-1.5 text-[12px] text-[#374151]">
                              <span className="font-medium">{latest.title}</span>
                              {latest.sha && (
                                <span className="ml-2 font-mono text-[11px] text-[#6D4AE8]">{latest.sha.slice(0, 7)}</span>
                              )}
                              {latest.branch && <span className="ml-2 text-[#9CA3AF]">{latest.branch}</span>}
                            </div>
                          )}
                          {latest && (
                            <div className="mt-0.5 text-[11px] text-[#9CA3AF]">
                              {latest.summary || "…"} · {ago(latest.updatedAt)}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="min-w-[200px] rounded-[10px] border border-[#E8E4F0] bg-white/90 px-3 py-2">
                        <div className="text-[10px] font-medium uppercase tracking-wide text-[#9CA3AF]">Pass rate · click a point</div>
                        <PassRateChart points={passPoints} selectedId={chartRunId} onSelect={selectChartRun} />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                      {layerStats.map((s) => {
                        const pct = s.passed + s.failed ? Math.round((s.passed / (s.passed + s.failed)) * 100) : null;
                        return (
                          <button
                            key={s.layer}
                            type="button"
                            onClick={() => {
                              setSuiteFilter(s.layer);
                              setPanel("suites");
                            }}
                            className="rounded-[14px] border border-[#E8E4F0] bg-white p-3.5 text-left shadow-sm shadow-black/[0.02] transition hover:border-[#D4C4FF] dark:border-[#2a2a2a] dark:bg-[#101010]"
                          >
                            <div className="text-[11px] font-medium text-[#7E7E7E]">{LAYER_LABEL[s.layer]}</div>
                            <div className="mt-1 flex items-baseline gap-2">
                              <span className="text-[24px] font-semibold tabular-nums tracking-tight">{s.total}</span>
                              {pct != null && <span className="text-[11px] text-[#9CA3AF]">{pct}%</span>}
                            </div>
                            <div className="mt-1 text-[11px] leading-snug text-[#6B7280]">{LAYER_HELP[s.layer]}</div>
                            {s.failed > 0 ? (
                              <div className="mt-2 text-[11px] font-medium text-[#B91C1C]">{s.failed} failing</div>
                            ) : s.passed > 0 ? (
                              <div className="mt-2 text-[11px] font-medium text-[#15803D]">{s.passed} passed</div>
                            ) : null}
                            {s.avgMs > 0 && <div className="mt-0.5 text-[10px] text-[#9CA3AF]">~{s.avgMs} ms avg</div>}
                          </button>
                        );
                      })}
                    </div>

                    <div className="grid gap-3 lg:grid-cols-2">
                      <div className="rounded-[14px] border border-[#E8E4F0] bg-white p-4 dark:border-[#2a2a2a] dark:bg-[#101010]">
                        <div className="flex items-center gap-2 text-[13px] font-semibold">
                          <TbArrowsDiff size={16} className="text-[#6D4AE8]" /> vs previous run
                        </div>
                        {!compare ? (
                          <p className="mt-2 text-[12px] text-[#7E7E7E]">Need two finished runs to diff regressions / fixes.</p>
                        ) : (
                          <div className="mt-3 grid grid-cols-2 gap-3">
                            <div className="rounded-[10px] bg-[#FEF2F2] px-3 py-2">
                              <div className="text-[11px] text-[#991B1B]">Regressed</div>
                              <div className="text-[22px] font-semibold tabular-nums">{compare.regressed.length}</div>
                            </div>
                            <div className="rounded-[10px] bg-[#F0FDF4] px-3 py-2">
                              <div className="text-[11px] text-[#15803D]">Fixed</div>
                              <div className="text-[22px] font-semibold tabular-nums">{compare.fixed.length}</div>
                            </div>
                            <ul className="col-span-2 max-h-[100px] space-y-1 overflow-y-auto text-[11.5px] text-[#5E6066]">
                              {compare.regressed.slice(0, 4).map((c) => (
                                <li key={caseKey(c)}>
                                  <span className="text-[#B91C1C]">↓</span> {c.method} {c.path}
                                </li>
                              ))}
                              {compare.fixed.slice(0, 3).map((c) => (
                                <li key={caseKey(c)}>
                                  <span className="text-[#15803D]">↑</span> {c.method} {c.path}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      <div className="rounded-[14px] border border-[#E8E4F0] bg-white p-4 dark:border-[#2a2a2a] dark:bg-[#101010]">
                        <div className="flex items-center gap-2 text-[13px] font-semibold">
                          <TbFlame size={16} className="text-[#EA580C]" /> Flaky endpoints
                        </div>
                        {!flaky.length ? (
                          <p className="mt-2 text-[12px] text-[#7E7E7E]">No pass/fail flip-flops across recent runs.</p>
                        ) : (
                          <ul className="mt-3 space-y-2">
                            {flaky.map((f) => (
                              <li key={f.key} className="flex justify-between gap-2 text-[12.5px]">
                                <span className="truncate font-medium">{f.label}</span>
                                <span className="shrink-0 text-[11px] text-[#9CA3AF]">
                                  {f.pass}✓ {f.fail}✗
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <button type="button" className="mt-3 text-[12px] font-medium text-[#6D4AE8]" onClick={() => setPanel("trends")}>
                          Open trends →
                        </button>
                      </div>
                    </div>

                    {modules.length > 0 && (
                      <div className="rounded-[14px] border border-[#E8E4F0] bg-white p-4 dark:border-[#2a2a2a] dark:bg-[#101010]">
                        <div className="flex items-center gap-2 text-[13px] font-semibold">
                          <TbTrendingUp size={16} className="text-[#6D4AE8]" /> Module chain
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {modules.map((m, i) => (
                            <span key={m.name} className="inline-flex items-center gap-2">
                              {i > 0 && <span className="text-[#C4B5E8]">→</span>}
                              <span className="rounded-[8px] border border-[#E5E7EB] bg-[#FAFAFC] px-3 py-1.5 text-[12px] dark:border-[#2a2a2a]">
                                {m.name} <span className="text-[#9CA3AF]">({m.endpoints})</span>
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {panel === "suites" && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => setSuiteFilter("all")}
                        className={`rounded-[6px] px-2.5 py-1 text-[12px] ${suiteFilter === "all" ? "bg-[#1F1F1F] text-white" : "bg-white border border-[#E5E7EB]"}`}
                      >
                        All
                      </button>
                      {LAYERS.map((l) => (
                        <button
                          key={l}
                          type="button"
                          onClick={() => setSuiteFilter(l)}
                          className={`rounded-[6px] px-2.5 py-1 text-[12px] ${
                            suiteFilter === l ? "bg-[#1F1F1F] text-white" : "bg-white border border-[#E5E7EB]"
                          }`}
                        >
                          {LAYER_LABEL[l]} ({selected.suite?.counts[l] ?? 0})
                        </button>
                      ))}
                    </div>
                    <div className="overflow-hidden rounded-[14px] border border-[#E8E4F0] bg-white dark:border-[#2a2a2a] dark:bg-[#101010]">
                      <ul className="max-h-[520px] divide-y divide-[#F3F0F8] overflow-y-auto dark:divide-[#222]">
                        {suiteCases.map((c) => (
                          <li key={c.id} className="flex items-start justify-between gap-2 px-3.5 py-2.5 text-[12.5px]">
                            <div className="min-w-0">
                              <span className="mr-2 rounded bg-[#F3EEFF] px-1.5 py-0.5 text-[10px] font-medium uppercase text-[#5B3FD1]">
                                {LAYER_LABEL[c.layer]}
                              </span>
                              <span className="font-semibold">{c.method}</span> {c.path}
                              <div className="text-[11.5px] text-[#7E7E7E]">{c.name}</div>
                            </div>
                          </li>
                        ))}
                        {!suiteCases.length && (
                          <li className="px-3 py-8 text-center text-[12px] text-[#7E7E7E]">No cases in this layer.</li>
                        )}
                      </ul>
                    </div>
                  </div>
                )}

                {panel === "quality" && (
                  <SpecQualityPanel spec={spec} rows={rows} passScore={passScore} onReload={spec.reload} />
                )}

                {panel === "runs" && (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-[14px] border border-[#E8E4F0] bg-white p-3 dark:border-[#2a2a2a] dark:bg-[#101010]">
                      <div className="mb-2 text-[13px] font-semibold">History · live</div>
                      <ul className="max-h-[480px] space-y-2 overflow-y-auto">
                        {runs === null && (
                          <li className="flex items-center gap-2 text-[12px] text-[#7E7E7E]">
                            <TbLoader2 className="animate-spin" size={14} /> Loading…
                          </li>
                        )}
                        {runs?.length === 0 && <li className="text-[12px] text-[#7E7E7E]">Waiting for CI or a manual run…</li>}
                        {runs?.map((run) => (
                          <li key={run.id}>
                            <button
                              type="button"
                              onClick={() => setOpenRunId(run.id)}
                              className={`w-full rounded-[10px] border px-3 py-2.5 text-left transition ${
                                openRunId === run.id ? "border-[#6D4AE8] bg-[#F3EEFF]" : "border-[#F0F0F0] hover:border-[#D4C4FF] dark:border-[#222]"
                              }`}
                            >
                              <div className="flex justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="truncate text-[12.5px] font-semibold">{run.title}</div>
                                  <div className="text-[11px] text-[#7E7E7E]">
                                    {run.event}
                                    {run.branch ? ` · ${run.branch}` : ""}
                                    {run.prNumber != null ? ` · #${run.prNumber}` : ""} · {ago(run.createdAt)}
                                  </div>
                                  {run.sha && (
                                    <div className="mt-0.5 font-mono text-[10.5px] text-[#6D4AE8]" title={run.sha}>
                                      {run.sha.slice(0, 7)}
                                      <span className="ml-1.5 font-sans text-[#9CA3AF]">commit</span>
                                    </div>
                                  )}
                                </div>
                                <span className={`h-fit rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase ${statusColor(run.status)}`}>
                                  {run.status}
                                </span>
                              </div>
                              {(run.summary || run.error) && (
                                <div className="mt-1 text-[11.5px] text-[#5E6066]">{run.error || run.summary}</div>
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-[14px] border border-[#E8E4F0] bg-white p-3 dark:border-[#2a2a2a] dark:bg-[#101010]">
                      <div className="mb-2 text-[13px] font-semibold">
                        Case results{openRun ? ` · ${openRun.title}` : ""}
                      </div>
                      {!openRun?.results?.length && (
                        <p className="text-[12px] text-[#7E7E7E]">Select a finished run to inspect every layer.</p>
                      )}
                      <CaseResultsList results={openRun?.results ?? []} />
                    </div>
                  </div>
                )}

                {panel === "trends" && (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-[14px] border border-[#E8E4F0] bg-white p-3.5 dark:border-[#2a2a2a] dark:bg-[#101010]">
                        <div className="text-[10px] font-medium uppercase tracking-wide text-[#9CA3AF]">Runs analyzed</div>
                        <div className="mt-1 text-[22px] font-semibold tabular-nums">{passPoints.length}</div>
                        <div className="text-[11px] text-[#7E7E7E]">with case results</div>
                      </div>
                      <div className="rounded-[14px] border border-[#E8E4F0] bg-white p-3.5 dark:border-[#2a2a2a] dark:bg-[#101010]">
                        <div className="text-[10px] font-medium uppercase tracking-wide text-[#9CA3AF]">Latest pass rate</div>
                        <div className="mt-1 text-[22px] font-semibold tabular-nums">
                          {passPoints.length ? `${passPoints[passPoints.length - 1].pct}%` : "—"}
                        </div>
                        <div className="text-[11px] text-[#7E7E7E]">
                          {passPoints.length
                            ? `${passPoints[passPoints.length - 1].passed} passed · ${passPoints[passPoints.length - 1].failed} failed`
                            : "No finished runs"}
                        </div>
                      </div>
                      <div className="rounded-[14px] border border-[#E8E4F0] bg-white p-3.5 dark:border-[#2a2a2a] dark:bg-[#101010]">
                        <div className="text-[10px] font-medium uppercase tracking-wide text-[#9CA3AF]">
                          {timeToGreen?.label ?? "Time to green"}
                        </div>
                        <div className="mt-1 text-[22px] font-semibold tabular-nums">
                          {timeToGreen == null
                            ? "—"
                            : timeToGreen.hours === 0
                              ? "Green"
                              : timeToGreen.hours < 1
                                ? `${Math.round(timeToGreen.hours * 60)}m`
                                : `${timeToGreen.hours.toFixed(1)}h`}
                        </div>
                        <div className="truncate text-[11px] text-[#7E7E7E]">
                          {timeToGreen && "from" in timeToGreen && timeToGreen.from
                            ? `${timeToGreen.from} → ${timeToGreen.to}`
                            : "Across recent commits"}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[14px] border border-[#E8E4F0] bg-white p-4 dark:border-[#2a2a2a] dark:bg-[#101010]">
                      <div className="flex flex-wrap items-end justify-between gap-2">
                        <div>
                          <div className="text-[14px] font-semibold">Pass rate by commit</div>
                          <p className="text-[12px] text-[#7E7E7E]">Click a point to open that run · SHA + message below</p>
                        </div>
                        <button
                          type="button"
                          className="text-[12px] font-medium text-[#6D4AE8]"
                          onClick={() => {
                            if (chartRunId) {
                              setOpenRunId(chartRunId);
                              setPanel("runs");
                            }
                          }}
                        >
                          Inspect in Live runs →
                        </button>
                      </div>
                      <div className="mt-3">
                        <PassRateChart points={passPoints} selectedId={chartRunId} onSelect={selectChartRun} wide />
                      </div>
                    </div>

                    <div className="rounded-[14px] border border-[#E8E4F0] bg-white p-4 dark:border-[#2a2a2a] dark:bg-[#101010]">
                      <div className="text-[14px] font-semibold">Layer health (last 10 runs)</div>
                      <p className="text-[12px] text-[#7E7E7E]">Contract → functional → data → schema → chain</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {layerTrend.map((lt) => (
                          <button
                            key={lt.layer}
                            type="button"
                            onClick={() => {
                              setSuiteFilter(lt.layer);
                              setPanel("suites");
                            }}
                            className="rounded-[10px] border border-[#F0F0F0] px-3 py-2.5 text-left transition hover:border-[#D4C4FF] dark:border-[#222]"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[12px] font-semibold">{LAYER_LABEL[lt.layer]}</span>
                              <span
                                className={`text-[12px] font-semibold tabular-nums ${
                                  lt.latestPct >= 95 ? "text-[#16A34A]" : lt.latestPct >= 80 ? "text-[#CA8A04]" : "text-[#DC2626]"
                                }`}
                              >
                                {lt.latestPct}%
                              </span>
                            </div>
                            <LayerMiniSpark values={lt.series} />
                            <div className="mt-1 text-[10.5px] text-[#9CA3AF]">
                              {lt.fails ? `${lt.fails} fail in latest` : "Clean in latest"} · open suite →
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-2">
                      <div className="rounded-[14px] border border-[#E8E4F0] bg-white p-4 dark:border-[#2a2a2a] dark:bg-[#101010]">
                        <div className="text-[14px] font-semibold">Top failing cases</div>
                        <p className="text-[12px] text-[#7E7E7E]">Across the window of stored runs</p>
                        {!topFailures.length ? (
                          <p className="mt-3 text-[12px] text-[#7E7E7E]">No failures in recent history.</p>
                        ) : (
                          <ul className="mt-3 space-y-1.5">
                            {topFailures.map((f) => (
                              <li
                                key={`${f.layer}-${f.label}`}
                                className="flex items-center justify-between gap-2 rounded-[8px] border border-[#F5F5F5] px-2.5 py-1.5 dark:border-[#222]"
                              >
                                <div className="min-w-0">
                                  <span className="mr-1.5 rounded bg-[#F3EEFF] px-1 py-0.5 text-[10px] uppercase text-[#5B3FD1]">
                                    {LAYER_LABEL[f.layer]}
                                  </span>
                                  <span className="font-mono text-[11.5px] text-[#374151]">{f.label}</span>
                                </div>
                                <span className="shrink-0 text-[12px] font-semibold tabular-nums text-[#DC2626]">{f.count}×</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className="rounded-[14px] border border-[#E8E4F0] bg-white p-4 dark:border-[#2a2a2a] dark:bg-[#101010]">
                        <div className="text-[14px] font-semibold">Flaky quarantine</div>
                        <p className="text-[12px] text-[#7E7E7E]">Endpoints that both pass and fail in this window</p>
                        {!flaky.length ? (
                          <p className="mt-3 text-[12px] text-[#7E7E7E]">No flaky cases detected.</p>
                        ) : (
                          <ul className="mt-3 space-y-1.5">
                            {flaky.map((f) => (
                              <li
                                key={f.key}
                                className="flex items-center justify-between gap-2 rounded-[8px] border border-[#F5F5F5] px-2.5 py-1.5 dark:border-[#222]"
                              >
                                <span className="truncate font-mono text-[11.5px] text-[#374151]">{f.label}</span>
                                <span className="shrink-0 text-[11px] tabular-nums text-[#CA8A04]">
                                  {f.pass}✓ / {f.fail}✗
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>

                    <div className="rounded-[14px] border border-[#E8E4F0] bg-white p-4 dark:border-[#2a2a2a] dark:bg-[#101010]">
                      <div className="text-[14px] font-semibold">Recent commits</div>
                      <p className="text-[12px] text-[#7E7E7E]">Demo / webhook runs with SHA + message</p>
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full min-w-[520px] text-left text-[12px]">
                          <thead>
                            <tr className="border-b border-[#F0F0F0] text-[10px] uppercase tracking-wide text-[#9CA3AF]">
                              <th className="pb-2 pr-3 font-medium">Status</th>
                              <th className="pb-2 pr-3 font-medium">Commit</th>
                              <th className="pb-2 pr-3 font-medium">Message</th>
                              <th className="pb-2 pr-3 font-medium">Pass</th>
                              <th className="pb-2 font-medium">When</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(runs ?? []).slice(0, 10).map((r) => {
                              const total = r.results?.length ?? 0;
                              const passed = r.results?.filter((c) => c.status === "passed").length ?? 0;
                              const pct = total ? Math.round((passed / total) * 100) : null;
                              return (
                                <tr
                                  key={r.id}
                                  className="cursor-pointer border-b border-[#F8F8F8] hover:bg-[#FAFAFC] dark:border-[#1a1a1a]"
                                  onClick={() => {
                                    selectChartRun(r.id);
                                    setPanel("runs");
                                  }}
                                >
                                  <td className="py-2 pr-3">
                                    <span className={`rounded-full border px-1.5 py-0.5 text-[10px] uppercase ${statusColor(r.status)}`}>
                                      {r.status}
                                    </span>
                                  </td>
                                  <td className="py-2 pr-3 font-mono text-[#6D4AE8]">{r.sha ? r.sha.slice(0, 7) : "—"}</td>
                                  <td className="max-w-[220px] truncate py-2 pr-3 font-medium text-[#374151]">{r.title}</td>
                                  <td className="py-2 pr-3 tabular-nums">{pct != null ? `${pct}%` : "—"}</td>
                                  <td className="py-2 text-[#9CA3AF]">{ago(r.createdAt)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {panel === "connect" && (
                  <ConnectCiPanel
                    snippets={snippets}
                    snippetTab={snippetTab}
                    setSnippetTab={setSnippetTab}
                    onCopy={copy}
                    onRotate={() => void rotate()}
                    hasSecret={!!snippets || !!selected}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <p className="max-w-md text-[14px] leading-relaxed text-[#5E6066]">
                Start with <strong>Digital Wallet demo</strong> to see gates, layered suites, flaky insights and CI snippets —
                all in this tab, not on the canvas.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CaseResultsList({ results }: { results: CaseResult[] }) {
  const [filter, setFilter] = useState<SuiteLayer | "all" | "failed">("all");
  const shown = results.filter((c) => {
    if (filter === "all") return true;
    if (filter === "failed") return c.status === "failed";
    return c.layer === filter;
  });
  return (
    <>
      <div className="mb-2 flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`rounded px-2 py-0.5 text-[11px] ${filter === "all" ? "bg-[#1F1F1F] text-white" : "bg-[#F4F4F5]"}`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setFilter("failed")}
          className={`rounded px-2 py-0.5 text-[11px] ${filter === "failed" ? "bg-[#1F1F1F] text-white" : "bg-[#F4F4F5]"}`}
        >
          Failed
        </button>
        {LAYERS.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setFilter(l)}
            className={`rounded px-2 py-0.5 text-[11px] ${filter === l ? "bg-[#1F1F1F] text-white" : "bg-[#F4F4F5]"}`}
          >
            {LAYER_LABEL[l]}
          </button>
        ))}
      </div>
      <ul className="max-h-[440px] space-y-1 overflow-y-auto">
        {shown.map((c) => (
          <li key={c.id} className="flex items-start justify-between gap-2 rounded-[6px] px-2 py-1.5 text-[12px] hover:bg-[#F7F7FA]">
            <div className="min-w-0">
              <span className="mr-1.5 rounded bg-[#F3EEFF] px-1 py-0.5 text-[10px] uppercase text-[#5B3FD1]">{LAYER_LABEL[c.layer]}</span>
              <span className="font-semibold">{c.method}</span> {c.path}
              <div className="text-[11px] text-[#7E7E7E]">{c.detail}</div>
            </div>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase ${statusColor(c.status)}`}>{c.status}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function SpecQualityPanel({
  spec,
  rows,
  passScore,
  onReload,
}: {
  spec: ReturnType<typeof useApiSpec>;
  rows: ReturnType<typeof useApiSpecView>["rows"];
  passScore: number;
  onReload: () => void;
}) {
  if (spec.status === "loading" || spec.status === "idle") {
    return (
      <div className="flex items-center gap-2 text-[13px] text-[#7E7E7E]">
        <TbLoader2 className="animate-spin" size={16} /> Reading OpenAPI for quality gate…
      </div>
    );
  }
  if (spec.status === "error") {
    return (
      <div className="rounded-[12px] border border-[#FECACA] bg-[#FEF2F2] p-4 text-[13px] text-[#991B1B]">
        <TbAlertTriangle className="mb-1 inline" /> {spec.error}
        <button type="button" className="ml-3 underline" onClick={onReload}>
          Retry
        </button>
      </div>
    );
  }
  const lint = spec.data!.lint;
  const blocked = rows.filter((r) => !r.pass).length;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { l: "Overall score", v: `${lint.score}`, s: lint.grade },
          { l: "Endpoints", v: String(lint.summary.endpoints) },
          { l: "Errors / warnings", v: `${lint.summary.errors}`, s: `/ ${lint.summary.warnings}` },
          { l: `Blocked (< ${passScore})`, v: String(blocked), bad: blocked > 0 },
        ].map((x) => (
          <div key={x.l} className="rounded-[14px] border border-[#E8E4F0] bg-white p-3 dark:border-[#2a2a2a] dark:bg-[#101010]">
            <div className="text-[11px] text-[#7E7E7E]">{x.l}</div>
            <div className={`text-[22px] font-semibold ${x.bad ? "text-[#991B1B]" : ""}`}>
              {x.v} {x.s && <span className="text-[14px] font-normal text-[#7E7E7E]">{x.s}</span>}
            </div>
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-[14px] border border-[#E8E4F0] bg-white dark:border-[#2a2a2a] dark:bg-[#101010]">
        <ul className="max-h-[420px] divide-y divide-[#F3F0F8] overflow-y-auto dark:divide-[#222]">
          {rows.map((r) => (
            <li key={r.key} className="flex items-start justify-between gap-2 px-3 py-2 text-[12.5px]">
              <div>
                <span className="font-semibold">{r.method}</span> {r.path}
                <div className="text-[11px] text-[#7E7E7E]">
                  {r.module} · score {r.score} ({r.grade})
                  {r.reasons[0] ? ` · ${r.reasons[0].title}` : ""}
                </div>
              </div>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${r.pass ? statusColor("passed") : statusColor("failed")}`}>
                {r.pass ? "pass" : "block"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ConnectCiPanel({
  snippets,
  snippetTab,
  setSnippetTab,
  onCopy,
  onRotate,
  hasSecret,
}: {
  snippets: CicdSnippets | null;
  snippetTab: "jenkins" | "githubActions" | "curl";
  setSnippetTab: (t: "jenkins" | "githubActions" | "curl") => void;
  onCopy: (t: string) => void;
  onRotate: () => void;
  hasSecret: boolean;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-3 rounded-[14px] border border-[#E8E4F0] bg-white p-5 dark:border-[#2a2a2a] dark:bg-[#101010]">
      <div className="text-[15px] font-semibold">Drop App Atlas into their pipeline</div>
      <p className="text-[12.5px] leading-relaxed text-[#5E6066]">
        One snippet in <strong>Jenkins</strong>, <strong>GitHub Actions</strong>, or <strong>curl</strong>. Their secrets stay
        in their CI. App Atlas becomes the live dashboard for every PR / merge.
      </p>
      {!snippets && (
        <button
          type="button"
          onClick={onRotate}
          disabled={!hasSecret}
          className="rounded-[8px] bg-[#6D4AE8] px-3 py-2 text-[12.5px] text-white disabled:opacity-50"
        >
          Generate / rotate secret & snippets
        </button>
      )}
      {snippets && (
        <>
          <div className="flex gap-2">
            {(["jenkins", "githubActions", "curl"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSnippetTab(t)}
                className={`rounded-[6px] px-2.5 py-1 text-[12px] ${
                  snippetTab === t ? "bg-[#1F1F1F] text-white" : "bg-[#F4F4F5] text-[#5E6066]"
                }`}
              >
                {t === "githubActions" ? "GitHub Actions" : t === "jenkins" ? "Jenkins" : "curl"}
              </button>
            ))}
            <button type="button" className="ml-auto inline-flex items-center gap-1 text-[12px] text-[#6D4AE8]" onClick={() => onCopy(snippets[snippetTab])}>
              <TbCopy size={14} /> Copy
            </button>
          </div>
          <pre className="max-h-[320px] overflow-auto rounded-[10px] bg-[#0B1220] p-3.5 text-[11px] leading-relaxed text-[#E2E8F0]">
            {snippets[snippetTab]}
          </pre>
        </>
      )}
    </div>
  );
}
