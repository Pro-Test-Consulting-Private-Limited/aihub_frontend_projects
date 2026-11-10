"use client";

import { useEffect, useMemo, useState } from "react";
import { TbLoader2, TbX } from "react-icons/tb";
import type { SitJob, SitWorkbook } from "@/app/interfaces/appatlas";
import type { AtlasClient } from "@/app/services/appatlas";

const BANDS = ["High", "Medium", "Low"] as const;

const CHIP: Record<string, string> = {
  High: "bg-[#FCE4E4] text-[#9b1c1c] border-[#f5c2c7]",
  Medium: "bg-[#FFF2CC] text-[#7a5b00] border-[#ffe08a]",
  Low: "bg-[#E5E7EB] text-[#4b5563] border-[#d1d5db]",
};

type CaseRow = {
  id: string;
  tcId: string;
  scenario: string;
  testType: string;
  priority: string;
  severity: string;
  why: string;
  source: string;
  lowConfidence: boolean;
  originalPriority: string;
  originalSeverity: string;
  model: string;
};

function rowsFromWorkbook(wb: SitWorkbook, ticketKey: string): CaseRow[] {
  const sheet = wb.sheets.find((s) => s.kind === "test-cases") || wb.sheets[0];
  return (sheet?.rows || [])
    .filter(
      (r) =>
        r.cells.requirementId === ticketKey ||
        r.cells.issueKey === ticketKey ||
        (r.cells.feature || "").startsWith(ticketKey),
    )
    .map((r) => ({
      id: r.id,
      tcId: r.cells.tcId || r.id,
      scenario: r.cells.scenario || "",
      testType: r.cells.testType || "",
      priority: r.cells.priority || "",
      severity: r.cells.severity || "",
      why:
        r.cells.why ||
        (r.cells.assessmentSource
          ? "Not assessed. Run Re-assess"
          : "No reason recorded (generated before assessment)"),
      source: r.cells.assessmentSource || "Not assessed",
      lowConfidence: r.cells.lowConfidence === "1",
      originalPriority: r.cells.originalPriority || "",
      originalSeverity: r.cells.originalSeverity || "",
      model: r.cells.assessmentModel || "",
    }));
}

export function SitCaseDrawer({
  client,
  workbookId,
  ticketKey,
  ticketName,
  focusRowId,
  modelInactive,
  canvasId,
  showRubric,
  refreshToken,
  reassessJob,
  onStartReassess,
  onClose,
  onChanged,
}: {
  client: AtlasClient;
  workbookId: string;
  ticketKey: string;
  ticketName: string;
  focusRowId?: string | null;
  modelInactive: boolean;
  canvasId?: string | null;
  showRubric?: boolean;
  refreshToken?: number;
  reassessJob?: SitJob | null;
  onStartReassess?: (workbookId: string, ticketKey: string) => Promise<void>;
  onClose: () => void;
  onChanged?: (wb: SitWorkbook) => void;
}) {
  const [wb, setWb] = useState<SitWorkbook | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prioFilter, setPrioFilter] = useState<Set<string>>(new Set());
  const [sevFilter, setSevFilter] = useState<Set<string>>(new Set());
  const [rubricOpen, setRubricOpen] = useState(!!showRubric);
  const [rubric, setRubric] = useState<Record<string, unknown> | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editP, setEditP] = useState("Medium");
  const [editS, setEditS] = useState("Medium");
  const [editNote, setEditNote] = useState("");

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await client.getSitWorkbook(workbookId);
      setWb(next);
      onChanged?.(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cases");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workbookId, ticketKey, refreshToken]);

  useEffect(() => {
    if (!rubricOpen) return;
    void client.getSitRiskRubric().then(setRubric).catch(() => setRubric(null));
  }, [rubricOpen, client]);

  const cases = useMemo(() => {
    if (!wb) return [];
    let list = rowsFromWorkbook(wb, ticketKey);
    if (prioFilter.size) list = list.filter((c) => prioFilter.has(c.priority));
    if (sevFilter.size) list = list.filter((c) => sevFilter.has(c.severity));
    const rank = (b: string) => (b === "High" ? 0 : b === "Medium" ? 1 : 2);
    return [...list].sort((a, b) => rank(a.priority) - rank(b.priority));
  }, [wb, ticketKey, prioFilter, sevFilter]);

  const toggle = (set: Set<string>, v: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    setter(next);
  };

  const reassessQueued =
    reassessJob && (reassessJob.status === "queued" || reassessJob.status === "running");

  const reassess = async () => {
    if (modelInactive || reassessQueued) return;
    if (!onStartReassess) return;
    setBusy(true);
    setError(null);
    try {
      await onStartReassess(workbookId, ticketKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Re-assess failed");
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!editId) return;
    setBusy(true);
    try {
      const next = await client.patchSitCase(workbookId, editId, {
        priority: editP,
        severity: editS,
        note: editNote || undefined,
      });
      setWb(next);
      onChanged?.(next);
      setEditId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-[440px] flex-col bg-white shadow-xl dark:bg-[#101010]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-[#eef0f5] px-4 py-3 dark:border-[#1a1a1a]">
          <div>
            <div className="flex flex-wrap items-center gap-1.5 text-[14px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">
              <span>
                {ticketKey} · {ticketName}
              </span>
              <span
                title="AI-assisted estimate. Review before relying on it."
                className="rounded border border-[#e9d5ff] bg-[#f5f3ff] px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-[#7c3aed]"
              >
                beta
              </span>
            </div>
            {wb ? (
              <div className="mt-1 space-y-0.5 text-[11px] text-[#6b7280]">
                <div>
                  Generated{" "}
                  {wb.generatedAt
                    ? new Date(wb.generatedAt).toLocaleString()
                    : new Date(wb.createdAt).toLocaleString()}
                </div>
                <div>
                  {wb.assessedAt
                    ? `Assessed ${new Date(wb.assessedAt).toLocaleString()}${
                        cases[0]?.source && cases[0].source !== "Template" && cases[0].source !== "Not assessed"
                          ? ` · ${cases[0].source}`
                          : ""
                      }`
                    : "Not assessed yet"}
                </div>
              </div>
            ) : null}
            <div className="mt-1 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || modelInactive || !!reassessQueued || !onStartReassess}
                onClick={() => void reassess()}
                className="rounded-[6px] bg-[#8664F2] px-2.5 py-1 text-[11px] font-medium text-white disabled:opacity-40"
                title={
                  modelInactive
                    ? "Model is not running"
                    : reassessQueued
                      ? "Re-assess already queued"
                      : "Re-assess with current model (runs in background)"
                }
              >
                {reassessQueued ? (
                  <span className="inline-flex items-center gap-1">
                    <TbLoader2 className="animate-spin" size={12} />
                    Re-assessing
                  </span>
                ) : busy ? (
                  "Working…"
                ) : (
                  "Re-assess"
                )}
              </button>
              <button
                type="button"
                onClick={() => setRubricOpen((v) => !v)}
                className="rounded-[6px] border border-[#e2e6ef] px-2.5 py-1 text-[11px] text-[#5b647a]"
              >
                {rubricOpen ? "Hide rubric" : "View full rubric"}
              </button>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-[#6b7280]" aria-label="Close">
            <TbX size={18} />
          </button>
        </header>

        {error ? (
          <div className="mx-4 mt-3 rounded border border-[#f5c2c7] bg-[#fff5f5] px-2 py-1.5 text-[12px] text-[#b42318]">
            {error}
          </div>
        ) : null}

        {rubricOpen && rubric ? (
          <div className="max-h-40 overflow-auto border-b border-[#eef0f5] px-4 py-2 text-[11px] text-[#5b647a] dark:border-[#1a1a1a]">
            <div className="font-semibold text-[#1F1F1F] dark:text-[#ededed]">Rubric v{(rubric as { version?: number }).version}</div>
            <p className="mt-1">{(rubric as { severity?: { definition?: string } }).severity?.definition}</p>
            <p className="mt-1">{(rubric as { priority?: { definition?: string } }).priority?.definition}</p>
            <p className="mt-1">{(rubric as { priority?: { floor?: string } }).priority?.floor}</p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 border-b border-[#eef0f5] px-4 py-2 text-[11px] dark:border-[#1a1a1a]">
          <span className="text-[#9ca3af]">Priority</span>
          {BANDS.map((b) => (
            <button
              key={`p-${b}`}
              type="button"
              onClick={() => toggle(prioFilter, b, setPrioFilter)}
              className={`rounded-full border px-2 py-0.5 ${prioFilter.has(b) ? CHIP[b] : "border-[#e5e7eb] text-[#6b7280]"}`}
            >
              {b[0]}
            </button>
          ))}
          <span className="ml-2 text-[#9ca3af]">Severity</span>
          {BANDS.map((b) => (
            <button
              key={`s-${b}`}
              type="button"
              onClick={() => toggle(sevFilter, b, setSevFilter)}
              className={`rounded-full border px-2 py-0.5 ${sevFilter.has(b) ? CHIP[b] : "border-[#e5e7eb] text-[#6b7280]"}`}
            >
              {b[0]}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
          {loading ? (
            <div className="flex items-center gap-2 text-[12px] text-[#8a93a8]">
              <TbLoader2 className="animate-spin" /> Loading…
            </div>
          ) : (
            <ul className="space-y-2">
              {cases.map((c) => (
                <li
                  key={c.id}
                  className={`rounded-[8px] border px-3 py-2 text-[12px] ${
                    focusRowId === c.id ? "border-[#8664F2] bg-[#F4EFFE]/50" : "border-[#eee] dark:border-[#222]"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] text-[#8664F2]">{c.tcId}</span>
                    <span className="font-medium text-[#1F1F1F] dark:text-[#ededed]">{c.scenario}</span>
                    {c.testType ? (
                      <span className="rounded-full border border-[#e5e7eb] px-1.5 py-0.5 text-[10px]">{c.testType}</span>
                    ) : null}
                    {c.priority ? (
                      <span className={`rounded-full border px-1.5 py-0.5 text-[10px] ${CHIP[c.priority] || ""}`} title={c.originalPriority ? `Original ${c.originalPriority}` : undefined}>
                        P {c.priority}
                      </span>
                    ) : (
                      <span className="text-[#9ca3af]">P -</span>
                    )}
                    {c.severity ? (
                      <span className={`rounded-full border px-1.5 py-0.5 text-[10px] ${CHIP[c.severity] || ""}`} title={c.originalSeverity ? `Original ${c.originalSeverity}` : undefined}>
                        S {c.severity}
                      </span>
                    ) : (
                      <span className="text-[#9ca3af]">S -</span>
                    )}
                    <span className="rounded-full bg-[#f3f4f6] px-1.5 py-0.5 text-[10px] text-[#4b5563]">{c.source}</span>
                    {c.lowConfidence ? (
                      <span className="rounded-full bg-[#fff7ed] px-1.5 py-0.5 text-[10px] text-[#c2410c]">Low confidence</span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[11px] text-[#5b647a]">{c.why}</p>
                  {c.model ? <p className="mt-0.5 text-[10px] text-[#9ca3af]">Model: {c.model}</p> : null}
                  <button
                    type="button"
                    className="mt-1 text-[11px] text-[#8664F2]"
                    onClick={() => {
                      setEditId(c.id);
                      setEditP(c.priority || "Medium");
                      setEditS(c.severity || "Medium");
                      setEditNote("");
                    }}
                  >
                    Edit P/S
                  </button>
                  {editId === c.id ? (
                    <div className="mt-2 space-y-2 rounded border border-[#e2e6ef] p-2">
                      <div className="flex gap-2">
                        <label className="text-[11px]">
                          Priority
                          <select className="ml-1 border px-1" value={editP} onChange={(e) => setEditP(e.target.value)}>
                            {BANDS.map((b) => (
                              <option key={b} value={b}>
                                {b}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="text-[11px]">
                          Severity
                          <select className="ml-1 border px-1" value={editS} onChange={(e) => setEditS(e.target.value)}>
                            {BANDS.map((b) => (
                              <option key={b} value={b}>
                                {b}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <input
                        className="w-full rounded border border-[#e2e6ef] px-2 py-1 text-[11px]"
                        placeholder="Optional note"
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <button type="button" disabled={busy} onClick={() => void saveEdit()} className="rounded bg-[#8664F2] px-2 py-1 text-[11px] text-white">
                          Save
                        </button>
                        <button type="button" onClick={() => setEditId(null)} className="text-[11px] text-[#6b7280]">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
