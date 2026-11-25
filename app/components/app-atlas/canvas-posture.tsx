"use client";

import { Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  TbAlertTriangle,
  TbArrowDown,
  TbArrowUp,
  TbCheck,
  TbCookie,
  TbCopy,
  TbDownload,
  TbExternalLink,
  TbFilter,
  TbLock,
  TbNetwork,
  TbRefresh,
  TbSearch,
  TbShield,
  TbShieldCheck,
  TbWorld,
  TbX,
} from "react-icons/tb";
import type { AtlasClient } from "@/app/services/appatlas";
import { atlasUrl } from "@/app/services/appatlas";
import type { SecurityFinding, SecurityScan, SecuritySeverity } from "@/app/interfaces/appatlas";
import { SecurityCoveragePanel } from "@/app/components/app-atlas/security-coverage-panel";

const OWASP_TOP10 = [
  "A01:2021",
  "A02:2021",
  "A03:2021",
  "A04:2021",
  "A05:2021",
  "A06:2021",
  "A07:2021",
  "A08:2021",
  "A09:2021",
  "A10:2021",
] as const;

const SEV_ORDER: SecuritySeverity[] = ["critical", "high", "medium", "low", "info"];
const SEV_COLOR: Record<SecuritySeverity, string> = {
  critical: "#7F1D1D",
  high: "#DC2626",
  medium: "#D97706",
  low: "#2563EB",
  info: "#6B7280",
};
const SEV_BG: Record<SecuritySeverity, string> = {
  critical: "bg-[#7F1D1D] text-white",
  high: "bg-[#FEE2E2] text-[#991B1B] dark:bg-[#3f1212] dark:text-[#fecaca]",
  medium: "bg-[#FEF3C7] text-[#92400E] dark:bg-[#3a2a08] dark:text-[#fde68a]",
  low: "bg-[#DBEAFE] text-[#1E40AF] dark:bg-[#0f1f3a] dark:text-[#93c5fd]",
  info: "bg-[#F3F4F6] text-[#4B5563] dark:bg-[#1a1a1a] dark:text-[#9ca3af]",
};

const SAMPLE_ENV = process.env.NEXT_PUBLIC_SECURITY_POSTURE_SAMPLE === "1";

type DeepTab = "findings" | "headers" | "csp" | "cookies" | "thirdparty" | "diff";
type GroupBy = "none" | "screen" | "owasp" | "check";
type DrawerTab = "overview" | "evidence" | "remediation" | "history";
type TopView = "coverage" | "posture";

function SevChip({ severity }: { severity: SecuritySeverity }) {
  return (
    <span className={`inline-flex rounded-[4px] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${SEV_BG[severity]}`}>
      {severity}
    </span>
  );
}

function ScoreRing({
  score,
  grade,
  gatedLabel,
}: {
  score: number;
  grade: string;
  /** When set, hide letter grade (not enough tested). */
  gatedLabel?: string | null;
}) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const gated = Boolean(gatedLabel);
  const pct = gated ? 0 : Math.max(0, Math.min(100, score)) / 100;
  const color = score >= 90 ? "#16A34A" : score >= 80 ? "#65A30D" : score >= 65 ? "#D97706" : score >= 50 ? "#EA580C" : "#DC2626";
  return (
    <div
      className="relative h-[110px] w-[110px]"
      role="img"
      aria-label={gated ? gatedLabel! : `Posture score ${score}, grade ${grade}`}
    >
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-[#E5E7EB] dark:text-[#2a2a2a]" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={gated ? "#9CA3AF" : color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c * (1 - pct)}`}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
        {gated ? (
          <>
            <span className="text-[11px] font-semibold leading-tight text-[#1F1F1F] dark:text-[#ededed]">{gatedLabel}</span>
            <span className="mt-0.5 text-[10px] text-[#7E7E7E]">No grade yet</span>
          </>
        ) : (
          <>
            <span className="text-[28px] font-bold leading-none text-[#1F1F1F] dark:text-[#ededed]">{grade}</span>
            <span className="mt-0.5 text-[12px] text-[#7E7E7E]">{score}/100</span>
          </>
        )}
      </div>
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-[8px] bg-[#E5E7EB]/60 dark:bg-[#2a2a2a]/60 ${className || "h-20"}`} />;
}

function EmptyPanel({ title, body, icon }: { title: string; body: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-[12px] border border-dashed border-[#E5E7EB] px-6 py-12 text-center dark:border-[#2a2a2a]">
      <div className="text-[#8664F2]">{icon || <TbShield size={28} />}</div>
      <div className="text-[14px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">{title}</div>
      <p className="max-w-[420px] text-[12.5px] text-[#7E7E7E]">{body}</p>
    </div>
  );
}

function whyItMatters(f: SecurityFinding): string {
  if (f.checkId.includes("hsts")) return "Without HSTS, browsers can be tricked into using plain HTTP on a later visit, exposing cookies and tokens.";
  if (f.checkId.includes("csp")) return "A weak or missing CSP makes XSS and data injection easier to exploit in the browser.";
  if (f.checkId.includes("cookie")) return "Cookies without Secure or HttpOnly are easier to steal via network sniffing or script access.";
  if (f.checkId.includes("cors")) return "Overly open CORS lets untrusted sites read responses from your API in a user browser.";
  if (f.checkId.includes("sri") || f.checkId.includes("cross-domain"))
    return "Third-party scripts can change without notice; SRI and pinning reduce supply-chain risk.";
  if (f.checkId.includes("frame")) return "Missing clickjacking protection lets other sites embed your UI and trick users into actions.";
  if (f.checkId.includes("mixed")) return "HTTP resources on an HTTPS page can be modified in transit and break the lock icon.";
  return "This finding comes from passive review of response metadata captured during your recording.";
}

export function CanvasPosture({
  client,
  canvasId,
  projectId,
  onFocusNode,
}: {
  client: AtlasClient;
  canvasId: string | null;
  projectId: string | null;
  onFocusNode?: (nodeId: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgOn, setOrgOn] = useState(false);
  const [projectOn, setProjectOn] = useState(false);
  const [hosts, setHosts] = useState<string[]>([]);
  const [env, setEnv] = useState("unknown");
  const [scans, setScans] = useState<SecurityScan[]>([]);
  const [scanId, setScanId] = useState<string | null>(null);
  const [findings, setFindings] = useState<SecurityFinding[]>([]);
  const [diff, setDiff] = useState<{
    added: SecurityFinding[];
    fixed: SecurityFinding[];
    unchanged: SecurityFinding[];
  } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [sampleMode, setSampleMode] = useState(false);

  const [topView, setTopView] = useState<TopView>("coverage");
  const [gradeGateLabel, setGradeGateLabel] = useState<string | null>(null);
  const [deepTab, setDeepTab] = useState<DeepTab>("findings");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [q, setQ] = useState("");
  const [sevFilter, setSevFilter] = useState<SecuritySeverity | "all">("all");
  const [owaspFilter, setOwaspFilter] = useState<string | "all">("all");
  const [checkFilter, setCheckFilter] = useState("");
  const [screenFilter, setScreenFilter] = useState<string | "all">("all");
  const [statusFilter, setStatusFilter] = useState<string | "all">("all");
  const [confFilter, setConfFilter] = useState<string | "all">("all");
  const [selected, setSelected] = useState<SecurityFinding | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("overview");
  const [bulk, setBulk] = useState<Set<string>>(new Set());
  const [dryRun, setDryRun] = useState<{ summary: string; description: string; labels: string[] } | null>(null);
  const [sortKey, setSortKey] = useState<"severity" | "title" | "status">("severity");

  const enabled = orgOn && projectOn && (env === "dev" || env === "test" || env === "staging");
  const activeScan = scans.find((s) => s.id === scanId) || scans[0] || null;
  const summary = activeScan?.summary || {};
  const isSample = Boolean(summary.sample) || sampleMode;

  const refresh = useCallback(async () => {
    if (!canvasId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [settings, feats, scanList] = await Promise.all([
        client.getSettings().catch(() => ({ securityPosturePassive: false } as { securityPosturePassive?: boolean })),
        projectId
          ? client.getProjectFeatures(projectId).catch(() => null)
          : Promise.resolve(null),
        client.listSecurityScans(canvasId),
      ]);
      setOrgOn(Boolean(settings.securityPosturePassive));
      if (feats) {
        setProjectOn(Boolean(feats.features.securityPassive));
        setHosts(feats.securityTargetHosts || []);
        setEnv(String(feats.environment || "unknown").toLowerCase());
      }
      setScans(scanList.items);
      const latest = scanList.items.find((s) => s.status === "ready") || scanList.items[0] || null;
      const sid = latest?.id || null;
      setScanId(sid);
      const report = await client.getSecurityReport(canvasId).catch(() => null);
      const grade = report?.grade as { eligible?: boolean; label?: string } | undefined;
      setGradeGateLabel(grade && grade.eligible === false ? grade.label || null : null);
      const coverageFails: SecurityFinding[] = ((report?.failures as Array<Record<string, unknown>>) || []).map((f, i) => {
        const screens = (f.screens as string[]) || (f.affectedScreens as string[]) || [];
        return {
          id: `cov-${String(f.checkId || i)}`,
          canvasId,
          scanId: sid || "coverage",
          nodeId: screens[0] || null,
          stateId: null,
          checkId: String(f.checkId || ""),
          title: String(f.title || f.checkId || "Finding"),
          severity: (String(f.severity || "info") as SecuritySeverity),
          status: "open",
          owaspCategory: f.owasp ? String(f.owasp) : null,
          cwe: f.cwe ? String(f.cwe) : null,
          confidence: "high",
          remediation: f.remediation ? String(f.remediation) : null,
          evidence: {
            statusReason: f.statusReason || f.why || "",
            screens,
            why: f.statusReason || f.why || "",
          },
          createdAt: Date.now(),
        };
      });
      if (sid) {
        const [f, d] = await Promise.all([client.listSecurityFindings(canvasId, sid), client.getSecurityDiff(canvasId)]);
        // Prefer Coverage fails so Findings matches the checklist; keep scan-only rows that are not already covered.
        const covered = new Set(coverageFails.map((x) => x.checkId));
        const extras = f.items.filter((x) => x.status === "open" && !covered.has(x.checkId || ""));
        setFindings(coverageFails.length ? [...coverageFails, ...extras] : f.items);
        setDiff(d.diff);
      } else {
        setFindings(coverageFails);
        setDiff(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load posture");
    } finally {
      setLoading(false);
    }
  }, [canvasId, client, projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runScan = async (sample = false) => {
    if (!canvasId) return;
    setScanning(true);
    setError(null);
    try {
      const res = await client.runSecurityScan(canvasId, { sample });
      setSampleMode(sample);
      setScans((prev) => [res.scan, ...prev.filter((s) => s.id !== res.scan.id)]);
      setScanId(res.scan.id);
      setFindings(res.findings);
      const d = await client.getSecurityDiff(canvasId);
      setDiff(d.diff);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  };

  const filtered = useMemo(() => {
    let rows = [...findings];
    if (q.trim()) {
      const needle = q.toLowerCase();
      rows = rows.filter(
        (f) =>
          f.title.toLowerCase().includes(needle) ||
          f.checkId.toLowerCase().includes(needle) ||
          (f.owaspCategory || "").toLowerCase().includes(needle),
      );
    }
    if (sevFilter !== "all") rows = rows.filter((f) => f.severity === sevFilter);
    if (owaspFilter !== "all") rows = rows.filter((f) => f.owaspCategory === owaspFilter);
    if (checkFilter) rows = rows.filter((f) => f.checkId.includes(checkFilter));
    if (screenFilter !== "all") rows = rows.filter((f) => f.nodeId === screenFilter);
    if (statusFilter !== "all") rows = rows.filter((f) => f.status === statusFilter);
    if (confFilter !== "all") rows = rows.filter((f) => f.confidence === confFilter);
    const rank = (s: SecuritySeverity) => SEV_ORDER.indexOf(s);
    rows.sort((a, b) => {
      if (sortKey === "title") return a.title.localeCompare(b.title);
      if (sortKey === "status") return a.status.localeCompare(b.status);
      return rank(a.severity) - rank(b.severity);
    });
    return rows;
  }, [findings, q, sevFilter, owaspFilter, checkFilter, screenFilter, statusFilter, confFilter, sortKey]);

  const grouped = useMemo(() => {
    if (groupBy === "none") return [{ key: "all", label: "All findings", items: filtered }];
    const map = new Map<string, SecurityFinding[]>();
    for (const f of filtered) {
      const key =
        groupBy === "screen" ? f.nodeId || "unassigned" : groupBy === "owasp" ? f.owaspCategory || "other" : f.checkId;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    }
    return [...map.entries()].map(([key, items]) => ({ key, label: key, items }));
  }, [filtered, groupBy]);

  const patchStatus = async (id: string, status: string) => {
    if (!canvasId) return;
    setFindings((prev) => prev.map((f) => (f.id === id ? { ...f, status } : f)));
    if (selected?.id === id) setSelected((s) => (s ? { ...s, status } : s));
    try {
      await client.patchSecurityFinding(canvasId, id, { status });
    } catch {
      void refresh();
    }
  };

  const exportReport = () => {
    const payload = { scan: activeScan, findings, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `posture-${activeScan?.id || "export"}.json`;
    a.click();
  };

  if (!canvasId) {
    return <EmptyPanel title="No canvas selected" body="Open or record a canvas to review Canvas posture." />;
  }

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-16" />
        <div className="grid grid-cols-4 gap-3">
          <Skeleton />
          <Skeleton />
          <Skeleton />
          <Skeleton />
        </div>
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (!enabled && !isSample) {
    return (
      <div className="p-6">
        <EmptyPanel
          title="Canvas posture is off"
          body={
            !orgOn
              ? "The organisation flag securityPosturePassive is off. Enable it on the App Atlas logs dashboard: Canvases page → Security tab → Org: Canvas posture (passive)."
              : !projectOn
                ? "This project does not have securityPassive enabled. Turn it on under the project AppAtlas features → Security posture (default off)."
                : hosts.length === 0
                  ? "No allowlisted hosts. Add securityTargetHosts under project AppAtlas features → Security posture before capturing."
                  : `Environment lock: posture runs only in dev, test, or staging (current: ${env}).`
          }
          icon={<TbLock size={28} />}
        />
        {SAMPLE_ENV && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => void runScan(true)}
              className="rounded-[8px] border border-[#8664F2] bg-[#F5F1FF] px-4 py-2 text-[13px] font-medium text-[#8664F2] dark:bg-[#1c1530]"
            >
              Load sample data (dev only)
            </button>
          </div>
        )}
      </div>
    );
  }

  if (enabled && hosts.length === 0 && !isSample && !activeScan) {
    return (
      <div className="p-6">
        <EmptyPanel
          title="No allowlisted host"
          body="securityPassive is on, but securityTargetHosts is empty. Add the harness hostname (for example 127.0.0.1) so capture can run."
          icon={<TbWorld size={28} />}
        />
      </div>
    );
  }

  const bySev = summary.bySeverity || { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  const sevTotal = SEV_ORDER.reduce((n, k) => n + (bySev[k] || 0), 0) || 1;
  const stats = summary.stats || {
    screensScanned: 0,
    requestsAnalysed: 0,
    thirdPartyDomains: 0,
    cookies: 0,
    openFindings: findings.filter((f) => f.status === "open").length,
  };
  const deltaNew = diff?.added.length ?? 0;
  const deltaFixed = diff?.fixed.length ?? 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {isSample && (
        <div className="shrink-0 border-b border-[#F59E0B]/40 bg-[#FFFBEB] px-4 py-2 text-center text-[12px] font-medium text-[#92400E] dark:bg-[#2a2008] dark:text-[#fde68a]">
          Sample data, not from a real scan
        </div>
      )}

      {/* Header strip */}
      <header className="shrink-0 border-b border-[#EEE] px-5 py-3 dark:border-[#1a1a1a]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <TbShieldCheck className="text-[#8664F2]" size={20} />
            <h2 className="text-[15px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">Canvas posture</h2>
          </div>
          <select
            aria-label="Scan history"
            className="rounded-[6px] border border-[#E5E7EB] bg-white px-2 py-1.5 text-[12px] dark:border-[#2a2a2a] dark:bg-[#141414]"
            value={scanId || ""}
            onChange={async (e) => {
              const id = e.target.value;
              setScanId(id);
              if (!canvasId || !id) return;
              const f = await client.listSecurityFindings(canvasId, id);
              setFindings(f.items);
            }}
          >
            {scans.length === 0 && <option value="">No scans yet</option>}
            {scans.map((s) => (
              <option key={s.id} value={s.id}>
                {new Date(s.createdAt).toLocaleString()} · {s.status} · {s.rulesetVersion}
              </option>
            ))}
          </select>
          <span className="rounded-full border border-[#E5E7EB] px-2 py-0.5 text-[11px] text-[#5E6066] dark:border-[#2a2a2a]">
            {activeScan?.status || "idle"}
          </span>
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-[7px] border border-[#E5E7EB] px-2 py-1 text-[11px] dark:border-[#2a2a2a]">
              Run details
            </summary>
            <div className="absolute left-0 z-20 mt-1 w-64 rounded-[8px] border border-[#E5E7EB] bg-white p-2 text-[11px] shadow dark:border-[#2a2a2a] dark:bg-[#141414]">
              <div>Ruleset: {activeScan?.rulesetVersion || "posture-demo-1.0"}</div>
              <div>Org posture: {orgOn ? "on" : "off"}</div>
              <div>Project passive: {projectOn ? "on" : "off"}</div>
              <div>Env: {env}</div>
              <div className="mt-1 text-[#7E7E7E]">Host allowlist is in project settings.</div>
            </div>
          </details>
          <div className="ml-auto flex flex-wrap gap-2">
            {canvasId && (
              <button
                type="button"
                disabled={scanning}
                onClick={() => {
                  setTopView("coverage");
                  void client.enqueueSecurityRunAll(canvasId).then(() => refresh()).catch((e) => setError(e instanceof Error ? e.message : "Run all failed"));
                }}
                className="inline-flex items-center gap-1.5 rounded-[7px] border border-[#8664F2] px-3 py-1.5 text-[12px] font-medium text-[#8664F2] disabled:opacity-50"
              >
                Run all passes
              </button>
            )}
            <button
              type="button"
              disabled={scanning}
              onClick={() => void runScan(false)}
              className="inline-flex items-center gap-1.5 rounded-[7px] border border-[#8664F2] bg-[#8664F2] px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
            >
              <TbRefresh size={14} className={scanning ? "animate-spin" : ""} /> Re-scan
            </button>
            {SAMPLE_ENV && (
              <button
                type="button"
                onClick={() => void runScan(true)}
                className="rounded-[7px] border border-[#E5E7EB] px-3 py-1.5 text-[12px] dark:border-[#2a2a2a]"
              >
                Sample data
              </button>
            )}
            <div className="relative">
              <details>
                <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-[7px] border border-[#E5E7EB] px-3 py-1.5 text-[12px] dark:border-[#2a2a2a]">
                  <TbDownload size={14} /> Export
                </summary>
                <div className="absolute right-0 z-20 mt-1 w-40 rounded-[8px] border border-[#E5E7EB] bg-white p-1 text-[11px] shadow dark:border-[#2a2a2a] dark:bg-[#141414]">
                  <button type="button" className="block w-full rounded px-2 py-1 text-left hover:bg-[#F5F1FF]" onClick={exportReport}>
                    Findings JSON
                  </button>
                  {canvasId && (
                    <>
                      <button
                        type="button"
                        className="block w-full rounded px-2 py-1 text-left hover:bg-[#F5F1FF]"
                        onClick={() => void client.exportSecurityReport(canvasId, "html").then(({ blob, filename }) => {
                          const url = URL.createObjectURL(blob);
                          window.open(url, "_blank");
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = filename;
                          a.click();
                        })}
                      >
                        PDF / HTML
                      </button>
                      <button
                        type="button"
                        className="block w-full rounded px-2 py-1 text-left hover:bg-[#F5F1FF]"
                        onClick={() => void client.exportSecurityReport(canvasId, "xlsx").then(({ blob, filename }) => {
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = filename;
                          a.click();
                        })}
                      >
                        XLSX
                      </button>
                      <button
                        type="button"
                        className="block w-full rounded px-2 py-1 text-left hover:bg-[#F5F1FF]"
                        onClick={() => void client.exportSecurityReport(canvasId, "json").then(({ blob, filename }) => {
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = filename;
                          a.click();
                        })}
                      >
                        Checklist JSON
                      </button>
                    </>
                  )}
                </div>
              </details>
            </div>
          </div>
        </div>
        {error && (
          <div className="mt-2 flex items-center gap-2 rounded-[8px] border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[12px] text-[#991B1B]" role="alert">
            <TbAlertTriangle size={14} /> {error}
            <button type="button" className="ml-auto" onClick={() => setError(null)} aria-label="Dismiss">
              <TbX size={14} />
            </button>
          </div>
        )}
      </header>

      <div className="shrink-0 border-b border-[#E5E7EB] px-5 pt-2 dark:border-[#2a2a2a]">
        <div className="flex gap-1" role="tablist" aria-label="Security views">
          {(
            [
              ["coverage", "Coverage & report"],
              ["posture", "Passive findings"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={topView === id}
              onClick={() => setTopView(id)}
              className={`rounded-t-[8px] px-3 py-2 text-[12px] font-medium ${
                topView === id
                  ? "bg-white text-[#8664F2] shadow-[0_-1px_0_#8664F2_inset] dark:bg-[#141414]"
                  : "text-[#7E7E7E]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {topView === "coverage" && canvasId ? (
          <Suspense fallback={<div className="h-40 animate-pulse rounded-[12px] bg-[#E5E7EB]/50 dark:bg-[#2a2a2a]/50" />}>
            <SecurityCoveragePanel client={client} canvasId={canvasId} onOpenNode={onFocusNode} />
          </Suspense>
        ) : !activeScan ? (
          <EmptyPanel
            title="No scan yet"
            body="Record the allowlisted app, save the canvas, then run Re-scan. Capture only stores redacted response metadata."
            icon={<TbShield size={28} />}
          />
        ) : (
          <>
            {/* Hero: no ungated letter grade or score ring on Findings */}
            <section className="grid grid-cols-12 gap-4" aria-label="Posture summary">
              <div className="col-span-12 flex flex-wrap items-center gap-4 rounded-[12px] border border-[#E5E7EB] bg-white p-4 dark:border-[#2a2a2a] dark:bg-[#141414] xl:col-span-4">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">Findings from completed passes</div>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#7E7E7E]">
                    Queued or running passes never replace this list. Open Coverage for the full 143-check tally and progress card.
                    Letter grades stay on Coverage after the gate unlocks.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-3 text-[12px]">
                    <span className="inline-flex items-center gap-1 text-[#DC2626]">
                      <TbAlertTriangle size={14} /> {findings.filter((f) => f.status === "open").length} open
                    </span>
                    <span className="inline-flex items-center gap-1 text-[#7E7E7E]">
                      <TbArrowUp size={14} /> {deltaNew} new
                    </span>
                    <span className="inline-flex items-center gap-1 text-[#16A34A]">
                      <TbArrowDown size={14} /> {deltaFixed} fixed
                    </span>
                    <button type="button" className="text-[#8664F2]" onClick={() => setTopView("coverage")}>
                      Open Coverage
                    </button>
                  </div>
                </div>
              </div>
              <div className="col-span-12 rounded-[12px] border border-[#E5E7EB] bg-white p-4 dark:border-[#2a2a2a] dark:bg-[#141414] xl:col-span-4">
                <div className="mb-2 text-[12px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">Severity breakdown</div>
                <div className="flex h-3 overflow-hidden rounded-full" role="img" aria-label="Severity segmented bar">
                  {SEV_ORDER.map((k) => (
                    <div key={k} style={{ width: `${((bySev[k] || 0) / sevTotal) * 100}%`, background: SEV_COLOR[k] }} title={`${k}: ${bySev[k] || 0}`} />
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {SEV_ORDER.map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        setSevFilter(k);
                        setDeepTab("findings");
                      }}
                      className="inline-flex items-center gap-1.5 text-[11px] text-[#5E6066] dark:text-[#9ca3af]"
                    >
                      <span className="h-2 w-2 rounded-full" style={{ background: SEV_COLOR[k] }} />
                      {k} · {bySev[k] || 0}
                    </button>
                  ))}
                </div>
              </div>
              <div className="col-span-12 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:col-span-4 xl:grid-cols-2">
                {[
                  { label: "Screens scanned", value: stats.screensScanned, icon: <TbShield size={16} /> },
                  { label: "Requests analysed", value: stats.requestsAnalysed, icon: <TbNetwork size={16} /> },
                  { label: "Third-party domains", value: stats.thirdPartyDomains, icon: <TbWorld size={16} /> },
                  { label: "Cookies", value: stats.cookies, icon: <TbCookie size={16} /> },
                  { label: "Open findings", value: stats.openFindings, icon: <TbAlertTriangle size={16} /> },
                ].map((c) => (
                  <div key={c.label} className="rounded-[10px] border border-[#E5E7EB] px-3 py-2.5 dark:border-[#2a2a2a]">
                    <div className="flex items-center gap-1.5 text-[10.5px] text-[#7E7E7E]">
                      {c.icon} {c.label}
                    </div>
                    <div className="mt-1 text-[20px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">{c.value}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* OWASP heatmap */}
            <section className="mt-4" aria-label="OWASP Top 10">
              <h3 className="mb-2 text-[13px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">OWASP Top 10 heatmap</h3>
              <div className="grid grid-cols-5 gap-2 lg:grid-cols-10">
                {OWASP_TOP10.map((cat) => {
                  const row = summary.byOwasp?.[cat] || { count: 0, worst: "info" as SecuritySeverity };
                  const intensity = Math.min(1, row.count / 8);
                  const bg = row.count
                    ? `color-mix(in srgb, ${SEV_COLOR[row.worst]} ${20 + intensity * 60}%, transparent)`
                    : undefined;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setOwaspFilter(cat);
                        setDeepTab("findings");
                      }}
                      className="rounded-[8px] border border-[#E5E7EB] p-2 text-left transition hover:ring-2 hover:ring-[#8664F2]/40 dark:border-[#2a2a2a]"
                      style={{ background: bg }}
                      aria-label={`${cat} ${row.count} findings`}
                    >
                      <div className="text-[10px] font-bold text-[#1F1F1F] dark:text-[#ededed]">{cat.slice(0, 3)}</div>
                      <div className="text-[16px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">{row.count}</div>
                      <div className="truncate text-[9px] text-[#7E7E7E]">{cat}</div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Per-screen strip */}
            <section className="mt-4" aria-label="Per-screen risk">
              <h3 className="mb-2 text-[13px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">Per-screen risk</h3>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {(summary.perScreen || []).length === 0 && (
                  <EmptyPanel title="No screens in summary" body="Re-scan after recording so node rollups appear." />
                )}
                {(summary.perScreen || []).map((s) => (
                  <button
                    key={s.nodeId}
                    type="button"
                    onClick={() => {
                      setScreenFilter(s.nodeId);
                      setDeepTab("findings");
                      onFocusNode?.(s.nodeId);
                    }}
                    className="w-[140px] shrink-0 rounded-[10px] border border-[#E5E7EB] bg-white p-2 text-left hover:border-[#8664F2] dark:border-[#2a2a2a] dark:bg-[#141414]"
                  >
                    <div className="h-[72px] overflow-hidden rounded-[6px] bg-[#F5F6F6] dark:bg-[#1a1a1a]">
                      {s.screenshotUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={atlasUrl(s.screenshotUrl)} alt={s.title || s.path} className="h-full w-full object-cover object-top" />
                      ) : null}
                    </div>
                    <div className="mt-1.5 truncate text-[11px] font-medium text-[#1F1F1F] dark:text-[#ededed]">{s.path || s.nodeId}</div>
                    <div className="mt-1 flex items-center justify-between">
                      <SevChip severity={s.worst} />
                      <span className="text-[10px] text-[#7E7E7E]">{s.count}</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* Deep tabs */}
            <div className="mt-4 flex flex-wrap gap-1 border-b border-[#EEE] dark:border-[#1a1a1a]" role="tablist">
              {(
                [
                  ["findings", "Findings"],
                  ["headers", "Security headers"],
                  ["csp", "CSP analyzer"],
                  ["cookies", "Cookie inspector"],
                  ["thirdparty", "Third-party"],
                  ["diff", "Scan diff"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={deepTab === id}
                  onClick={() => setDeepTab(id)}
                  className={`rounded-t-[8px] px-3 py-2 text-[12.5px] ${
                    deepTab === id
                      ? "border border-b-0 border-[#E5E7EB] bg-white font-semibold text-[#8664F2] dark:border-[#2a2a2a] dark:bg-[#141414]"
                      : "text-[#5E6066] hover:text-[#1F1F1F] dark:text-[#9ca3af]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="rounded-b-[12px] border border-t-0 border-[#E5E7EB] bg-white p-4 dark:border-[#2a2a2a] dark:bg-[#141414]">
              {deepTab === "findings" && (
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <TbSearch className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={14} />
                      <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Search findings"
                        aria-label="Search findings"
                        className="rounded-[6px] border border-[#E5E7EB] py-1.5 pl-7 pr-2 text-[12px] dark:border-[#2a2a2a] dark:bg-[#0a0a0a]"
                      />
                    </div>
                    <select aria-label="Severity filter" value={sevFilter} onChange={(e) => setSevFilter(e.target.value as SecuritySeverity | "all")} className="rounded-[6px] border border-[#E5E7EB] px-2 py-1.5 text-[12px] dark:border-[#2a2a2a] dark:bg-[#0a0a0a]">
                      <option value="all">Severity</option>
                      {SEV_ORDER.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <select aria-label="OWASP filter" value={owaspFilter} onChange={(e) => setOwaspFilter(e.target.value)} className="rounded-[6px] border border-[#E5E7EB] px-2 py-1.5 text-[12px] dark:border-[#2a2a2a] dark:bg-[#0a0a0a]">
                      <option value="all">OWASP</option>
                      {OWASP_TOP10.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                    <input
                      aria-label="Check family filter"
                      value={checkFilter}
                      onChange={(e) => setCheckFilter(e.target.value)}
                      placeholder="Check family"
                      className="w-[120px] rounded-[6px] border border-[#E5E7EB] px-2 py-1.5 text-[12px] dark:border-[#2a2a2a] dark:bg-[#0a0a0a]"
                    />
                    <select aria-label="Status filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-[6px] border border-[#E5E7EB] px-2 py-1.5 text-[12px] dark:border-[#2a2a2a] dark:bg-[#0a0a0a]">
                      <option value="all">Status</option>
                      {["open", "accepted", "fixed", "false_positive"].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <select aria-label="Confidence filter" value={confFilter} onChange={(e) => setConfFilter(e.target.value)} className="rounded-[6px] border border-[#E5E7EB] px-2 py-1.5 text-[12px] dark:border-[#2a2a2a] dark:bg-[#0a0a0a]">
                      <option value="all">Confidence</option>
                      {["high", "medium", "low"].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <select aria-label="Group by" value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)} className="rounded-[6px] border border-[#E5E7EB] px-2 py-1.5 text-[12px] dark:border-[#2a2a2a] dark:bg-[#0a0a0a]">
                      <option value="none">No grouping</option>
                      <option value="screen">By screen</option>
                      <option value="owasp">By OWASP</option>
                      <option value="check">By check</option>
                    </select>
                    <select aria-label="Sort" value={sortKey} onChange={(e) => setSortKey(e.target.value as typeof sortKey)} className="rounded-[6px] border border-[#E5E7EB] px-2 py-1.5 text-[12px] dark:border-[#2a2a2a] dark:bg-[#0a0a0a]">
                      <option value="severity">Sort severity</option>
                      <option value="title">Sort title</option>
                      <option value="status">Sort status</option>
                    </select>
                    {(sevFilter !== "all" || owaspFilter !== "all" || screenFilter !== "all" || q) && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-[11px] text-[#8664F2]"
                        onClick={() => {
                          setSevFilter("all");
                          setOwaspFilter("all");
                          setScreenFilter("all");
                          setStatusFilter("all");
                          setConfFilter("all");
                          setCheckFilter("");
                          setQ("");
                        }}
                      >
                        <TbFilter size={12} /> Clear filters
                      </button>
                    )}
                  </div>

                  {filtered.length === 0 ? (
                    <div className="mt-4">
                      <EmptyPanel title="No findings match" body="Try clearing filters, or re-scan after recording more traffic." />
                    </div>
                  ) : (
                    <div className="mt-3 overflow-x-auto" role="table" aria-label="Findings">
                      {grouped.map((g) => (
                        <div key={g.key} className="mb-3">
                          {groupBy !== "none" && (
                            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#7E7E7E]">
                              {g.label} · {g.items.length}
                            </div>
                          )}
                          <table className="w-full min-w-[720px] border-collapse text-left text-[12.5px]">
                            <thead>
                              <tr className="border-b border-[#EEE] text-[11px] text-[#7E7E7E] dark:border-[#1a1a1a]">
                                <th className="w-8 py-2">
                                  <span className="sr-only">Select</span>
                                </th>
                                <th className="py-2 font-medium">Severity</th>
                                <th className="py-2 font-medium">Finding</th>
                                <th className="py-2 font-medium">OWASP</th>
                                <th className="py-2 font-medium">Confidence</th>
                                <th className="py-2 font-medium">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {g.items.map((f) => (
                                <tr
                                  key={f.id}
                                  tabIndex={0}
                                  onClick={() => {
                                    setSelected(f);
                                    setDrawerTab("overview");
                                    setDryRun(null);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      setSelected(f);
                                      setDrawerTab("overview");
                                    }
                                  }}
                                  className="cursor-pointer border-b border-[#F3F4F6] hover:bg-[#F9FAFB] focus:bg-[#F5F1FF] dark:border-[#1a1a1a] dark:hover:bg-[#1a1a1a]"
                                >
                                  <td className="py-2" onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="checkbox"
                                      aria-label={`Select ${f.title}`}
                                      checked={bulk.has(f.id)}
                                      onChange={(e) => {
                                        setBulk((prev) => {
                                          const next = new Set(prev);
                                          if (e.target.checked) next.add(f.id);
                                          else next.delete(f.id);
                                          return next;
                                        });
                                      }}
                                    />
                                  </td>
                                  <td className="py-2">
                                    <SevChip severity={f.severity} />
                                  </td>
                                  <td className="py-2">
                                    <div className="font-medium text-[#1F1F1F] dark:text-[#ededed]">{f.title}</div>
                                    <div className="text-[10.5px] text-[#9CA3AF]">{f.checkId}</div>
                                  </td>
                                  <td className="py-2 text-[#5E6066] dark:text-[#9ca3af]">{f.owaspCategory || "-"}</td>
                                  <td className="py-2">
                                    <span className="rounded-[4px] border border-[#E5E7EB] px-1.5 py-0.5 text-[10px] dark:border-[#2a2a2a]">{f.confidence}</span>
                                  </td>
                                  <td className="py-2" onClick={(e) => e.stopPropagation()}>
                                    <select
                                      aria-label={`Status for ${f.title}`}
                                      value={f.status}
                                      onChange={(e) => void patchStatus(f.id, e.target.value)}
                                      className="rounded-[4px] border border-[#E5E7EB] px-1.5 py-1 text-[11px] dark:border-[#2a2a2a] dark:bg-[#0a0a0a]"
                                    >
                                      {["open", "accepted", "fixed", "false_positive"].map((s) => (
                                        <option key={s} value={s}>
                                          {s}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                      {bulk.size > 0 && (
                        <div className="mt-2 flex items-center gap-2 text-[12px]">
                          <span>{bulk.size} selected</span>
                          <button
                            type="button"
                            className="rounded-[6px] border px-2 py-1"
                            onClick={() => {
                              for (const id of bulk) void patchStatus(id, "accepted");
                              setBulk(new Set());
                            }}
                          >
                            Mark accepted
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {deepTab === "headers" && (
                <div className="overflow-x-auto">
                  {(summary.headersMatrix || []).length === 0 ? (
                    <EmptyPanel title="No header matrix" body="Document responses were not captured for this scan." />
                  ) : (
                    <table className="w-full min-w-[800px] border-collapse text-[11.5px]">
                      <thead>
                        <tr className="border-b border-[#EEE] dark:border-[#1a1a1a]">
                          <th className="py-2 text-left">Screen</th>
                          {["strict-transport-security", "content-security-policy", "x-frame-options", "x-content-type-options", "referrer-policy", "permissions-policy"].map(
                            (h) => (
                              <th key={h} className="px-1 py-2 text-left font-medium">
                                {h.replace(/-/g, "\u00ad")}
                              </th>
                            ),
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {(summary.headersMatrix || []).map((row) => (
                          <tr key={row.nodeId} className="border-b border-[#F3F4F6] dark:border-[#1a1a1a]">
                            <td className="py-2 font-medium">{row.path || row.nodeId}</td>
                            {Object.entries(row.headers).map(([name, cell]) => (
                              <td key={name} className="px-1 py-2">
                                <button
                                  type="button"
                                  title={cell.value || cell.status}
                                  className={`rounded-[4px] px-1.5 py-0.5 text-[10px] font-medium ${
                                    cell.status === "missing"
                                      ? "bg-[#FEE2E2] text-[#991B1B]"
                                      : cell.status === "weak"
                                        ? "bg-[#FEF3C7] text-[#92400E]"
                                        : "bg-[#DCFCE7] text-[#166534]"
                                  }`}
                                  onClick={() =>
                                    setSelected({
                                      id: `hdr-${row.nodeId}-${name}`,
                                      canvasId: canvasId!,
                                      scanId: scanId || "",
                                      nodeId: row.nodeId,
                                      stateId: null,
                                      checkId: "sec-headers",
                                      severity: cell.status === "missing" ? "high" : cell.status === "weak" ? "medium" : "info",
                                      confidence: "high",
                                      owaspCategory: "A05:2021",
                                      cwe: null,
                                      title: `${name}: ${cell.status}`,
                                      remediation: null,
                                      evidence: { header: name, ...cell },
                                      status: "open",
                                      createdAt: Date.now(),
                                    })
                                  }
                                >
                                  {cell.status}
                                </button>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {deepTab === "csp" && (
                <div className="space-y-2">
                  {(summary.cspBreakdown || []).length === 0 ? (
                    <EmptyPanel title="No CSP findings" body="Either CSP was absent (see findings) or the evaluator had nothing to report." />
                  ) : (
                    (summary.cspBreakdown || []).map((c, i) => (
                      <div key={i} className="rounded-[8px] border border-[#E5E7EB] px-3 py-2 dark:border-[#2a2a2a]">
                        <div className="flex items-center gap-2">
                          <span className="rounded-[4px] bg-[#FEF3C7] px-1.5 py-0.5 text-[10px] font-bold text-[#92400E]">sev {c.severity}</span>
                          <span className="font-mono text-[12px]">{c.directive}</span>
                        </div>
                        <p className="mt-1 text-[12px] text-[#5E6066] dark:text-[#9ca3af]">{c.description}</p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {deepTab === "cookies" && (
                <div className="overflow-x-auto">
                  {(summary.cookies || []).length === 0 ? (
                    <EmptyPanel title="No cookies observed" body="No Set-Cookie attributes were captured on allowlisted responses." icon={<TbCookie size={28} />} />
                  ) : (
                    <table className="w-full min-w-[700px] text-[12px]">
                      <thead>
                        <tr className="border-b border-[#EEE] text-left text-[11px] text-[#7E7E7E] dark:border-[#1a1a1a]">
                          <th className="py-2">Name</th>
                          <th>Domain</th>
                          <th>Path</th>
                          <th>Flags</th>
                          <th>Lifetime</th>
                          <th>Screens</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(summary.cookies || []).map((c, i) => (
                          <tr key={i} className="border-b border-[#F3F4F6] dark:border-[#1a1a1a]">
                            <td className="py-2 font-mono font-medium">{String(c.name)}</td>
                            <td>{String(c.domain || "-")}</td>
                            <td>{String(c.path || "/")}</td>
                            <td className="space-x-1 py-2">
                              <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${c.secure ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#FEE2E2] text-[#991B1B]"}`}>
                                Secure
                              </span>
                              <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${c.httpOnly ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#FEE2E2] text-[#991B1B]"}`}>
                                HttpOnly
                              </span>
                              <span className="rounded-full bg-[#F3F4F6] px-1.5 py-0.5 text-[10px] dark:bg-[#1a1a1a]">{String(c.sameSite || "unset")}</span>
                            </td>
                            <td>{c.maxAge != null ? `${c.maxAge}s` : "-"}</td>
                            <td className="text-[11px] text-[#7E7E7E]">{Array.isArray(c.screens) ? (c.screens as string[]).length : 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {deepTab === "thirdparty" && (
                <div className="overflow-x-auto">
                  {(summary.thirdParty || []).length === 0 ? (
                    <EmptyPanel title="No third-party domains" body="All captured requests were first-party or none were recorded." />
                  ) : (
                    <table className="w-full min-w-[640px] text-[12px]">
                      <thead>
                        <tr className="border-b border-[#EEE] text-left text-[11px] text-[#7E7E7E] dark:border-[#1a1a1a]">
                          <th className="py-2">Domain</th>
                          <th>Requests</th>
                          <th>Types</th>
                          <th>SRI</th>
                          <th>Screens</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(summary.thirdParty || []).map((t) => (
                          <tr key={t.domain} className="border-b border-[#F3F4F6] dark:border-[#1a1a1a]">
                            <td className="py-2 font-mono">{t.domain}</td>
                            <td>{t.count}</td>
                            <td>{t.resourceTypes.join(", ")}</td>
                            <td>{t.sriStatus}</td>
                            <td>{t.screens.length}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {deepTab === "diff" && (
                <div className="grid gap-4 md:grid-cols-3">
                  {!diff ? (
                    <div className="md:col-span-3">
                      <EmptyPanel title="Need two scans" body="Run at least two ready scans to compare new, fixed, and unchanged findings." />
                    </div>
                  ) : (
                    ([
                      ["New", diff.added, "text-[#DC2626]"],
                      ["Fixed", diff.fixed, "text-[#16A34A]"],
                      ["Unchanged", diff.unchanged, "text-[#7E7E7E]"],
                    ] as const).map(([label, items, tone]) => (
                      <div key={label} className="rounded-[10px] border border-[#E5E7EB] p-3 dark:border-[#2a2a2a]">
                        <div className={`text-[13px] font-semibold ${tone}`}>
                          {label} · {items.length}
                        </div>
                        <ul className="mt-2 max-h-[240px] space-y-1 overflow-y-auto text-[12px]">
                          {items.slice(0, 40).map((f) => (
                            <li key={f.id} className="truncate">
                              <SevChip severity={f.severity} /> {f.title}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Detail drawer */}
      {selected && (
        <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[440px] flex-col border-l border-[#E5E7EB] bg-white shadow-xl dark:border-[#2a2a2a] dark:bg-[#0a0a0a]" role="dialog" aria-label="Finding detail">
          <div className="flex items-start justify-between border-b border-[#EEE] px-4 py-3 dark:border-[#1a1a1a]">
            <div className="min-w-0 pr-2">
              <div className="flex items-center gap-2">
                <SevChip severity={selected.severity} />
                <span className="text-[10px] text-[#9CA3AF]">{selected.confidence}</span>
              </div>
              <h3 className="mt-1 text-[14px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">{selected.title}</h3>
            </div>
            <button type="button" aria-label="Close" onClick={() => setSelected(null)} className="rounded-[6px] p-1 hover:bg-[#F5F6F6] dark:hover:bg-[#1a1a1a]">
              <TbX size={18} />
            </button>
          </div>
          <div className="flex gap-1 border-b border-[#EEE] px-2 dark:border-[#1a1a1a]" role="tablist">
            {(["overview", "evidence", "remediation", "history"] as DrawerTab[]).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={drawerTab === t}
                onClick={() => setDrawerTab(t)}
                className={`px-3 py-2 text-[12px] capitalize ${drawerTab === t ? "border-b-2 border-[#8664F2] font-semibold text-[#8664F2]" : "text-[#7E7E7E]"}`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-[12.5px]">
            {drawerTab === "overview" && (
              <div className="space-y-3">
                <p className="leading-relaxed text-[#5E6066] dark:text-[#9ca3af]">{whyItMatters(selected)}</p>
                <div>
                  <div className="text-[11px] font-semibold uppercase text-[#7E7E7E]">Impact</div>
                  <p className="mt-1">Severity {selected.severity} with {selected.confidence} confidence from passive metadata.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selected.owaspCategory && (
                    <a
                      className="rounded-[6px] border border-[#E5E7EB] px-2 py-1 text-[11px] text-[#8664F2] dark:border-[#2a2a2a]"
                      href={`https://owasp.org/Top10/`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {selected.owaspCategory} <TbExternalLink className="inline" size={11} />
                    </a>
                  )}
                  {selected.cwe && (
                    <a
                      className="rounded-[6px] border border-[#E5E7EB] px-2 py-1 text-[11px] text-[#8664F2] dark:border-[#2a2a2a]"
                      href={`https://cwe.mitre.org/data/definitions/${selected.cwe.replace(/\D/g, "")}.html`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {selected.cwe} <TbExternalLink className="inline" size={11} />
                    </a>
                  )}
                </div>
              </div>
            )}
            {drawerTab === "evidence" && (
              <div className="space-y-3">
                <pre className="overflow-x-auto rounded-[8px] bg-[#F5F6F6] p-3 text-[11px] dark:bg-[#141414]">{JSON.stringify(selected.evidence, null, 2)}</pre>
                {typeof selected.evidence.screenshotUrl === "string" && selected.evidence.screenshotUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={atlasUrl(String(selected.evidence.screenshotUrl))} alt="Screen evidence" className="rounded-[8px] border border-[#E5E7EB] dark:border-[#2a2a2a]" />
                )}
                {typeof selected.evidence.url === "string" && (
                  <div className="break-all font-mono text-[11px] text-[#5E6066]">{String(selected.evidence.url)}</div>
                )}
              </div>
            )}
            {drawerTab === "remediation" && (
              <div className="space-y-2">
                <p className="whitespace-pre-wrap leading-relaxed">{selected.remediation || "No remediation text for this check."}</p>
                {selected.remediation && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-[6px] border px-2 py-1 text-[11px]"
                    onClick={() => void navigator.clipboard.writeText(selected.remediation || "")}
                  >
                    <TbCopy size={12} /> Copy example
                  </button>
                )}
              </div>
            )}
            {drawerTab === "history" && (
              <div className="space-y-2 text-[#5E6066] dark:text-[#9ca3af]">
                <div>First seen · {new Date(selected.createdAt).toLocaleString()}</div>
                <div>Last seen · {new Date(selected.createdAt).toLocaleString()}</div>
                <div>Status · {selected.status}</div>
                <div className="text-[11px]">Status changes are applied immediately; re-scan preserves check identity for diffs.</div>
              </div>
            )}
            {dryRun && (
              <div className="mt-4 rounded-[8px] border border-[#E5E7EB] p-3 dark:border-[#2a2a2a]">
                <div className="flex items-center gap-1 text-[11px] font-semibold text-[#8664F2]">
                  <TbCheck size={14} /> Jira dry run (not created)
                </div>
                <div className="mt-1 font-medium">{dryRun.summary}</div>
                <pre className="mt-2 max-h-[160px] overflow-auto whitespace-pre-wrap text-[11px]">{dryRun.description}</pre>
              </div>
            )}
          </div>
          <div className="flex gap-2 border-t border-[#EEE] px-4 py-3 dark:border-[#1a1a1a]">
            <button
              type="button"
              className="rounded-[7px] border border-[#E5E7EB] px-3 py-1.5 text-[12px] dark:border-[#2a2a2a]"
              disabled={!selected.nodeId}
              onClick={() => selected.nodeId && onFocusNode?.(selected.nodeId)}
            >
              Open on canvas
            </button>
            <button
              type="button"
              className="rounded-[7px] bg-[#8664F2] px-3 py-1.5 text-[12px] font-medium text-white"
              onClick={async () => {
                if (!canvasId || selected.id.startsWith("hdr-")) return;
                const res = await client.dryRunSecurityFindingJira(canvasId, selected.id);
                setDryRun(res.issue);
              }}
            >
              Draft Jira bug (dry run)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
