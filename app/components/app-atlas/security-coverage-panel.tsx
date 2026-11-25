"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  TbCheck,
  TbDownload,
  TbPlayerPlay,
  TbRefresh,
  TbShield,
  TbUserCheck,
  TbX,
} from "react-icons/tb";
import type { AtlasClient } from "@/app/services/appatlas";

type PassInfo = {
  id: string;
  title: string;
  kind: string;
  built: boolean;
  unlockCount: number;
  description: string;
};

type CheckRow = {
  id: string;
  category: string;
  name: string;
  status: string;
  statusLabel: string;
  reason: string;
  detectors: string[];
  scopeText: string;
  asvs: string | null;
  cwe: string | null;
  owasp: string | null;
  remediation: string | null;
  automationLevel: string;
  futurePass: string | null;
  humanStatus: string | null;
  automatedAlso: string | null;
};

const STATUS_BG: Record<string, string> = {
  fail: "bg-[#FEE2E2] text-[#991B1B]",
  pass: "bg-[#DCFCE7] text-[#166534]",
  partial: "bg-[#FEF9C3] text-[#854D0E]",
  not_tested: "bg-[#F3F4F6] text-[#4B5563]",
  manual: "bg-[#E0E7FF] text-[#3730A3]",
  human_verified_pass: "bg-[#F5D0FE] text-[#86198F]",
  human_verified_fail: "bg-[#F5D0FE] text-[#86198F]",
  human_verified_na: "bg-[#F5D0FE] text-[#86198F]",
};

export function SecurityCoveragePanel({
  client,
  canvasId,
}: {
  client: AtlasClient;
  canvasId: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [passes, setPasses] = useState<PassInfo[]>([]);
  const [jobs, setJobs] = useState<Array<{ id: string; passId: string; status: string; progress: Record<string, unknown> }>>([]);
  const [report, setReport] = useState<{
    tally: Record<string, number>;
    grade: { eligible: boolean; label: string; testedCount: number };
    coverage: { screensVisited: number; screensOnCanvas: number; percent: number; requestsSeen: number } | null;
    checks: CheckRow[];
    failures: Array<{ severity: string; title: string; checkId: string }>;
    futurePassUnlockCounts: Record<string, number>;
    agentBindingsCovered: string[];
    notTestedReasons: Record<string, number>;
  } | null>(null);
  const [view, setView] = useState<"matrix" | "report">("matrix");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [drawer, setDrawer] = useState<CheckRow | null>(null);
  const [attestNotes, setAttestNotes] = useState("");
  const [attesting, setAttesting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, r] = await Promise.all([client.listSecurityPasses(canvasId), client.getSecurityReport(canvasId)]);
      setPasses(p.passes || []);
      setJobs(p.jobs || []);
      setReport(r as typeof report);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load coverage");
    } finally {
      setLoading(false);
    }
  }, [canvasId, client]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    let rows = report?.checks || [];
    if (statusFilter !== "all") {
      rows = rows.filter((c) =>
        statusFilter === "human_verified" ? String(c.status).startsWith("human_verified") : c.status === statusFilter,
      );
    }
    if (q.trim()) {
      const n = q.toLowerCase();
      rows = rows.filter(
        (c) => c.id.toLowerCase().includes(n) || c.name.toLowerCase().includes(n) || c.category.toLowerCase().includes(n),
      );
    }
    return rows;
  }, [report, statusFilter, q]);

  const runPass = async (passId: string) => {
    try {
      await client.enqueueSecurityPass(canvasId, passId);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start pass");
    }
  };

  const attest = async (status: "pass" | "fail" | "na") => {
    if (!drawer) return;
    setAttesting(true);
    try {
      await client.attestSecurityCheck(canvasId, drawer.id, { humanStatus: status, notes: attestNotes });
      setDrawer(null);
      setAttestNotes("");
      await refresh();
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
      if (format === "html") {
        window.open(url, "_blank", "noopener,noreferrer");
      }
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    }
  };

  if (loading && !report) {
    return <div className="animate-pulse h-40 rounded-[12px] bg-[#E5E7EB]/50 dark:bg-[#2a2a2a]/50" />;
  }

  const tally = report?.tally || {};

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

      {/* Grade gate + tally */}
      <section className="grid grid-cols-12 gap-3" aria-label="Coverage summary">
        <div className="col-span-12 rounded-[12px] border border-[#E5E7EB] bg-white p-4 dark:border-[#2a2a2a] dark:bg-[#141414] md:col-span-4">
          <div className="text-[12px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">Score gate</div>
          <div className="mt-2 text-[22px] font-bold text-[#8664F2]">{report?.grade?.label || "—"}</div>
          <p className="mt-1 text-[11px] text-[#7E7E7E]">
            Letter grade only after enough checks are tested and traffic/probes are observed.
          </p>
          {report?.coverage && (
            <p className="mt-2 text-[11px] text-[#5E6066]">
              Crawl coverage: {report.coverage.screensVisited}/{report.coverage.screensOnCanvas} screens (
              {report.coverage.percent}%), {report.coverage.requestsSeen} responses
            </p>
          )}
        </div>
        <div className="col-span-12 grid grid-cols-3 gap-2 md:col-span-8 sm:grid-cols-6">
          {[
            ["Fail", tally.fail],
            ["Pass", tally.pass],
            ["Partial", tally.partial],
            ["Not tested", tally.not_tested],
            ["Manual", tally.manual],
            ["Human verified", tally.human_verified],
          ].map(([label, n]) => (
            <button
              key={String(label)}
              type="button"
              onClick={() =>
                setStatusFilter(
                  label === "Human verified"
                    ? "human_verified"
                    : String(label).toLowerCase().replace(" ", "_"),
                )
              }
              className="rounded-[10px] border border-[#E5E7EB] px-2 py-2 text-left dark:border-[#2a2a2a]"
            >
              <div className="text-[10px] text-[#7E7E7E]">{label}</div>
              <div className="text-[18px] font-semibold">{n ?? 0}</div>
            </button>
          ))}
        </div>
      </section>

      {/* Pass cards */}
      <section aria-label="Scan passes">
        <div className="mb-2 flex items-center gap-2">
          <h3 className="text-[13px] font-semibold">Scan passes</h3>
          <button type="button" onClick={() => void refresh()} className="text-[#8664F2]" aria-label="Refresh">
            <TbRefresh size={14} />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3 xl:grid-cols-6">
          {passes.map((p) => {
            const job = jobs.find((j) => j.passId === p.id && (j.status === "queued" || j.status === "running"));
            return (
              <div key={p.id} className="rounded-[10px] border border-[#E5E7EB] p-3 dark:border-[#2a2a2a]">
                <div className="text-[12px] font-semibold">{p.title}</div>
                <p className="mt-1 text-[10.5px] text-[#7E7E7E] line-clamp-3">{p.description}</p>
                {!p.built && (
                  <div className="mt-2 text-[10.5px] font-medium text-[#854D0E]">
                    Not built yet · unlocks {p.unlockCount} checks
                  </div>
                )}
                {p.built && (
                  <button
                    type="button"
                    disabled={Boolean(job)}
                    onClick={() => void runPass(p.id)}
                    className="mt-2 inline-flex items-center gap-1 rounded-[6px] bg-[#8664F2] px-2 py-1 text-[11px] text-white disabled:opacity-50"
                  >
                    <TbPlayerPlay size={12} /> {job ? job.status : "Run"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {report?.futurePassUnlockCounts && (
          <p className="mt-2 text-[11px] text-[#7E7E7E]">
            Future unlock counts:{" "}
            {Object.entries(report.futurePassUnlockCounts)
              .map(([k, v]) => `${k} (${v})`)
              .join(" · ")}
          </p>
        )}
        {report?.agentBindingsCovered?.length ? (
          <p className="mt-1 text-[11px] text-[#7E7E7E]">
            Agent ingest covers: {report.agentBindingsCovered.join(", ")}
          </p>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-[8px] border border-[#E5E7EB] dark:border-[#2a2a2a]">
          {(["matrix", "report"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-[12px] capitalize ${view === v ? "bg-[#8664F2] text-white" : ""}`}
            >
              {v}
            </button>
          ))}
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter checks…"
          className="rounded-[7px] border border-[#E5E7EB] px-2 py-1 text-[12px] dark:border-[#2a2a2a] dark:bg-transparent"
        />
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={() => void download("html")} className="inline-flex items-center gap-1 rounded-[7px] border border-[#E5E7EB] px-2 py-1 text-[11px] dark:border-[#2a2a2a]">
            <TbDownload size={12} /> PDF / HTML
          </button>
          <button type="button" onClick={() => void download("json")} className="inline-flex items-center gap-1 rounded-[7px] border border-[#E5E7EB] px-2 py-1 text-[11px] dark:border-[#2a2a2a]">
            JSON
          </button>
          <button type="button" onClick={() => void download("xlsx")} className="inline-flex items-center gap-1 rounded-[7px] border border-[#E5E7EB] px-2 py-1 text-[11px] dark:border-[#2a2a2a]">
            XLSX
          </button>
        </div>
      </div>

      {view === "report" && report && (
        <section className="rounded-[12px] border border-[#E5E7EB] p-4 dark:border-[#2a2a2a]">
          <h3 className="text-[13px] font-semibold">Failures by severity</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-[12px]">
            {report.failures.slice(0, 40).map((f, i) => (
              <li key={`${f.checkId}-${i}`}>
                <strong className="uppercase">{f.severity}</strong> {f.checkId} — {f.title}
              </li>
            ))}
            {!report.failures.length && <li className="text-[#7E7E7E]">None</li>}
          </ol>
          <h3 className="mt-4 text-[13px] font-semibold">Not tested — reason breakdown</h3>
          <ul className="mt-2 space-y-1 text-[11px] text-[#5E6066]">
            {Object.entries(report.notTestedReasons || {})
              .sort((a, b) => b[1] - a[1])
              .slice(0, 20)
              .map(([reason, n]) => (
                <li key={reason}>
                  <strong>{n}</strong> — {reason}
                </li>
              ))}
          </ul>
        </section>
      )}

      <div className="overflow-auto rounded-[12px] border border-[#E5E7EB] dark:border-[#2a2a2a]">
        <table className="min-w-full text-left text-[11px]">
          <thead className="bg-[#F9FAFB] dark:bg-[#1a1a1a]">
            <tr>
              <th className="px-2 py-2">ID</th>
              <th className="px-2 py-2">Category</th>
              <th className="px-2 py-2">Name</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Scope</th>
              <th className="px-2 py-2">Future / method</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr
                key={c.id}
                className="cursor-pointer border-t border-[#E5E7EB] hover:bg-[#F5F3FF]/40 dark:border-[#2a2a2a]"
                onClick={() => setDrawer(c)}
              >
                <td className="px-2 py-1.5 font-mono">{c.id}</td>
                <td className="px-2 py-1.5">{c.category}</td>
                <td className="px-2 py-1.5">{c.name}</td>
                <td className="px-2 py-1.5">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_BG[c.status] || STATUS_BG.not_tested}`}>
                    {c.statusLabel}
                  </span>
                  {c.scopeText ? <div className="mt-0.5 text-[10px] text-[#7E7E7E]">{c.scopeText}</div> : null}
                </td>
                <td className="px-2 py-1.5 text-[#5E6066]">{c.scopeText || "—"}</td>
                <td className="px-2 py-1.5 text-[#5E6066]">{c.futurePass || "Pass 1/2"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {drawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" role="dialog" aria-modal="true">
          <div className="flex h-full w-full max-w-md flex-col bg-white shadow-xl dark:bg-[#141414]">
            <div className="flex items-center gap-2 border-b border-[#E5E7EB] px-4 py-3 dark:border-[#2a2a2a]">
              <TbShield size={16} className="text-[#8664F2]" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold">{drawer.id} · {drawer.name}</div>
                <div className="text-[11px] text-[#7E7E7E]">{drawer.category}</div>
              </div>
              <button type="button" onClick={() => setDrawer(null)} aria-label="Close">
                <TbX size={16} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-[12px] space-y-3">
              <div>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_BG[drawer.status] || ""}`}>
                  {drawer.statusLabel}
                </span>
                {drawer.scopeText ? <span className="ml-2 text-[#7E7E7E]">{drawer.scopeText}</span> : null}
              </div>
              <p>{drawer.reason}</p>
              {drawer.automatedAlso && (
                <p className="rounded-[8px] bg-[#F3F4F6] px-2 py-1.5 text-[11px] dark:bg-[#1a1a1a]">{drawer.automatedAlso}</p>
              )}
              <div className="text-[11px] text-[#5E6066]">
                Detectors: {(drawer.detectors || []).join(", ") || "—"}
                <br />
                ASVS {drawer.asvs || "—"} · {drawer.cwe || "—"} · {drawer.owasp || "—"}
                <br />
                Level: {drawer.automationLevel}
                {drawer.futurePass ? ` · Future: ${drawer.futurePass}` : ""}
              </div>
              {drawer.remediation && (
                <div>
                  <div className="font-semibold">Remediation</div>
                  <p className="text-[#5E6066]">{drawer.remediation}</p>
                </div>
              )}
              <div className="rounded-[10px] border border-[#E5E7EB] p-3 dark:border-[#2a2a2a]">
                <div className="mb-2 flex items-center gap-1 text-[12px] font-semibold">
                  <TbUserCheck size={14} /> Human attestation
                </div>
                <p className="mb-2 text-[10.5px] text-[#7E7E7E]">
                  For guided, manual, or not-built checks. Automated results stay visible alongside.
                  Evidence uploads are capped at 2 MiB; redact PANs, passwords, and tokens.
                </p>
                <textarea
                  value={attestNotes}
                  onChange={(e) => setAttestNotes(e.target.value)}
                  rows={3}
                  placeholder="Notes…"
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
