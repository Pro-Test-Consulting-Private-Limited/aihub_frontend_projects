"use client";

import { useState } from "react";
import { TbArrowDown, TbArrowUp, TbBulb, TbChevronDown, TbChevronRight, TbLoader2, TbPlus, TbTrash } from "react-icons/tb";
import { apiAgent } from "@/app/services/api-testing";
import type { ExtractedVariable, GateRow, PrerequisiteStep, PrerequisiteSuggestion, RunResponse } from "@/app/interfaces/api-testing";
import { newId } from "@/app/lib/api-testing/rows";
import { KeyValueEditor, OverridesEditor } from "./fields";
import { RunAsSelect } from "./accounts";
import { StatusBadge } from "./results";
import { Hint } from "./layout-mode";
import { cloneSteps, getSharedSetup, setSharedSetup, stopSharingSetup } from "@/app/lib/api-testing/shared-setup";
import { box, iconButton, input, label, mono, outlineButton, SECRET_NAME } from "./ui";

const METHOD_COLORS: Record<string, string> = { GET: "text-[#16A34A]", POST: "text-[#2563EB]", PUT: "text-[#D97706]", PATCH: "text-[#8B5CF6]", DELETE: "text-[#DC2626]" };

function StepCard({
  step,
  index,
  count,
  onChange,
  onRemove,
  onMove,
  last,
  accountIds,
}: {
  accountIds: string[];
  step: PrerequisiteStep;
  index: number;
  count: number;
  onChange: (s: PrerequisiteStep) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  last?: RunResponse["prerequisites"][number];
}) {
  const [open, setOpen] = useState(step.extract.length === 0 || step.origin === "suggested");
  const setExtract = (i: number, e: ExtractedVariable) => onChange({ ...step, extract: step.extract.map((x, j) => (j === i ? e : x)) });
  return (
    <div className={`${box} overflow-hidden`}>
      <div className="flex items-center gap-2 px-3 py-2">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          {open ? <TbChevronDown size={14} className="shrink-0 text-[#7E7E7E]" /> : <TbChevronRight size={14} className="shrink-0 text-[#7E7E7E]" />}
          <span className="shrink-0 text-[11px] text-[#7E7E7E]">{index + 1}</span>
          <span className={`${mono} min-w-0 truncate text-[12.5px] font-semibold`}>
            <span className={`mr-1.5 ${METHOD_COLORS[step.endpoint.method] ?? "text-[#4B5563]"}`}>{step.endpoint.method}</span>
            <span className="text-[#1F1F1F] dark:text-[#ededed]">{step.endpoint.path}</span>
          </span>
          {step.extract.length > 0 && <span className="shrink-0 truncate text-[11px] text-[#7E7E7E]">saves {step.extract.map((e) => `{{${e.name}}}`).join(", ")}</span>}
        </button>
        {last && <StatusBadge status={last.status} />}
        <button type="button" className={iconButton} aria-label="Move up" disabled={index === 0} onClick={() => onMove(-1)}>
          <TbArrowUp size={14} />
        </button>
        <button type="button" className={iconButton} aria-label="Move down" disabled={index === count - 1} onClick={() => onMove(1)}>
          <TbArrowDown size={14} />
        </button>
        <button type="button" className={iconButton} aria-label="Remove prerequisite" onClick={onRemove}>
          <TbTrash size={14} />
        </button>
      </div>
      {open && (
        <div className="space-y-3 border-t border-[#EEE] px-3 py-3 dark:border-[#1a1a1a]">
          {step.reason && <div className="text-[11.5px] text-[#7E7E7E]">{step.reason}</div>}
          <div>
            <div className={label}>Save values from the response</div>
            <div className="space-y-1.5">
              {step.extract.map((e, i) => (
                <div key={i} className="flex flex-wrap items-center gap-1.5">
                  <input className={`${input} ${mono} !w-[110px]`} placeholder="token" value={e.name} onChange={(ev) => setExtract(i, { ...e, name: ev.target.value.replace(/[^\w.-]/g, ""), secret: e.secret || SECRET_NAME.test(ev.target.value) })} />
                  <span className="text-[12px] text-[#7E7E7E]">=</span>
                  <select className="rounded-[6px] border border-[#D9D9D9] bg-white px-1.5 py-1 text-[12px] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] dark:text-[#ededed]" value={e.source} onChange={(ev) => setExtract(i, { ...e, source: ev.target.value as "body" | "header", path: ev.target.value === "header" ? "Location" : "$." })}>
                    <option value="body">body JSONPath</option>
                    <option value="header">header</option>
                  </select>
                  <input className={`${input} ${mono} !w-[150px]`} placeholder={e.source === "body" ? "$.token" : "Header-Name"} value={e.path} onChange={(ev) => setExtract(i, { ...e, path: ev.target.value })} />
                  <label className="flex items-center gap-1 text-[11.5px] text-[#5E6066] dark:text-[#9ca3af]">
                    <input type="checkbox" checked={e.secret} onChange={(ev) => setExtract(i, { ...e, secret: ev.target.checked })} /> secret
                  </label>
                  <button type="button" className={iconButton} aria-label="Remove variable" onClick={() => onChange({ ...step, extract: step.extract.filter((_, j) => j !== i) })}>
                    <TbTrash size={14} />
                  </button>
                </div>
              ))}
              <button type="button" className={`${outlineButton} !px-2 !py-1 !text-[11.5px]`} onClick={() => onChange({ ...step, extract: [...step.extract, { name: "", source: "body", path: "$.", secret: false }] })}>
                <TbPlus size={12} /> Save a value
              </button>
            </div>
          </div>
          <div>
            <div className={label}>Request for this step</div>
            <OverridesEditor value={step.request} onChange={(request) => onChange({ ...step, request })} />
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[12px] text-[#5E6066] dark:text-[#9ca3af]">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={step.cache} onChange={(e) => onChange({ ...step, cache: e.target.checked })} /> Reuse the saved values for this browser session
            </label>
            <label className="flex items-center gap-1.5">
              Run as
              <RunAsSelect value={step.as ?? ""} onChange={(as) => onChange({ ...step, as: as || undefined })} accounts={accountIds.filter(Boolean)} emptyLabel="(default account)" />
            </label>
            <label className="flex items-center gap-1.5">
              Expected status
              <input className={`${input} !w-[64px]`} value={step.expectStatus ?? "2xx"} onChange={(e) => onChange({ ...step, expectStatus: e.target.value.trim() || undefined })} />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

/** The ordered list of endpoints from the same spec that run before the tests, with the variables they save. */
export function PrerequisitesSection({
  accountIds,
  steps,
  onChange,
  defaultHeaders,
  onDefaultHeaders,
  variables,
  onVariables,
  rows,
  target,
  specUrl,
  lastRun,
  onRerun,
  running,
  canRerun,
}: {
  accountIds: string[];
  steps: PrerequisiteStep[];
  onChange: (steps: PrerequisiteStep[]) => void;
  defaultHeaders: Record<string, string>;
  onDefaultHeaders: (h: Record<string, string>) => void;
  variables: Record<string, string>;
  onVariables: (v: Record<string, string>) => void;
  rows: GateRow[];
  target: { method: string; path: string };
  specUrl: string;
  lastRun?: RunResponse;
  onRerun: () => void;
  running: boolean;
  canRerun: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [, setShareTick] = useState(0);
  const [suggestions, setSuggestions] = useState<PrerequisiteSuggestion[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pick, setPick] = useState("");
  const candidates = rows.filter((r) => !(r.method === target.method && r.path === target.path));
  const saved = [...new Set([...steps.flatMap((s) => s.extract.map((e) => e.name)), ...(lastRun?.prerequisites ?? []).flatMap((p) => (p.extracted ?? []).map((e) => e.name))].filter(Boolean))];

  const suggest = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiAgent.suggestPrerequisites(specUrl, target.path, target.method);
      setSuggestions(res.suggestions.filter((s) => !steps.some((x) => x.endpoint.method === s.endpoint.method && x.endpoint.path === s.endpoint.path)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not get suggestions.");
    } finally {
      setLoading(false);
    }
  };
  const accept = (s: PrerequisiteSuggestion) => {
    onChange([...steps, { id: newId(), endpoint: s.endpoint, request: s.request ?? {}, extract: s.extract, cache: s.cache, origin: "suggested", reason: s.reason }]);
    if (s.defaultHeader) onDefaultHeaders({ ...defaultHeaders, ...s.defaultHeader });
    setSuggestions((cur) => cur?.filter((x) => x.id !== s.id) ?? null);
  };
  const add = () => {
    const r = candidates.find((c) => c.key === pick);
    if (!r) return;
    onChange([...steps, { id: newId(), endpoint: { method: r.method, path: r.path }, request: {}, extract: [], cache: false, origin: "manual" }]);
    setPick("");
  };
  const move = (i: number, dir: -1 | 1) => {
    const next = [...steps];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    onChange(next);
  };

  return (
    <section className={`${box} px-4 py-3`}>
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex items-center gap-1.5 text-[13px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">
          {open ? <TbChevronDown size={14} /> : <TbChevronRight size={14} />} Prerequisites ({steps.length})
        </button>
        <div className="flex items-center gap-1.5">
        {steps.length > 0 && (
          <button type="button" className={`${outlineButton} !px-2.5 !py-1 !text-[11.5px]`} onClick={() => { setSharedSetup(specUrl, steps, defaultHeaders); setShareTick((n) => n + 1); }} title="New endpoints of this spec start with these steps. Endpoints you already opened keep their own.">
            Use on all endpoints
          </button>
        )}
        {steps.length === 0 && getSharedSetup(specUrl) && (
          <button type="button" className={`${outlineButton} !px-2.5 !py-1 !text-[11.5px]`} onClick={() => { const sh = getSharedSetup(specUrl)!; onChange(cloneSteps(sh.prerequisites)); onDefaultHeaders({ ...defaultHeaders, ...sh.defaultHeaders }); }}>
            Use the shared steps ({getSharedSetup(specUrl)!.prerequisites.length})
          </button>
        )}
        {getSharedSetup(specUrl) && (
          <button type="button" className="text-[11.5px] text-[#7E7E7E] hover:underline" onClick={() => { stopSharingSetup(specUrl); setShareTick((n) => n + 1); }}>Stop sharing</button>
        )}
        {steps.length > 0 && (
          <button type="button" className={`${outlineButton} !px-2.5 !py-1 !text-[11.5px]`} onClick={onRerun} disabled={!canRerun || running} title="Runs the prerequisites again and replaces the values saved for this session">
            Re-run prerequisites
          </button>
        )}
        </div>
      </div>
      {open && (
        <div className="mt-2 space-y-2.5">
          <Hint short="Calls that run first. What they return is saved for the tests.">
            These run first, in order. Every field of their responses is saved automatically (token, userId...) and you can use it as <span className={mono}>{"{{token}}"}</span> in headers, path, query and body; add a rule below only to save a value under another name. A token a step saves belongs to the account it runs as (see Run as), so an admin login never replaces the customer&apos;s. Data a step sends (mobile number, password) is reused by later steps, and generated data is new on every run. If a step fails, the tests are BLOCKED, not failed.
          </Hint>
          {steps.map((s, i) => (
            <StepCard key={s.id} accountIds={accountIds} step={s} index={i} count={steps.length} last={lastRun?.prerequisites.find((p) => p.id === s.id)} onChange={(n) => onChange(steps.map((x) => (x.id === s.id ? n : x)))} onRemove={() => onChange(steps.filter((x) => x.id !== s.id))} onMove={(d) => move(i, d)} />
          ))}
          <div className="flex flex-wrap items-center gap-1.5">
            <select className="min-w-0 max-w-[260px] flex-1 rounded-[6px] border border-[#D9D9D9] bg-white px-2 py-1.5 text-[12px] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] dark:text-[#ededed]" value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Add an endpoint…</option>
              {candidates.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.method} {c.path}
                  {c.pass ? "" : " (blocked)"}
                </option>
              ))}
            </select>
            <button type="button" className={outlineButton} onClick={add} disabled={!pick}>
              <TbPlus size={13} /> Add
            </button>
            <button type="button" className={outlineButton} onClick={suggest} disabled={loading}>
              {loading ? <TbLoader2 size={13} className="animate-spin" /> : <TbBulb size={13} />} Suggest from spec
            </button>
          </div>
          {error && <div className="text-[12px] text-[#DC2626]">{error}</div>}
          {suggestions && (
            <div className="space-y-1.5">
              {suggestions.length === 0 && <div className={`${box} px-3 py-2 text-[12px] text-[#7E7E7E]`}>No more suggestions: nothing else in the spec looks like a prerequisite for this endpoint.</div>}
              {suggestions.map((s) => (
                <div key={s.id} className={`${box} flex items-start gap-2 px-3 py-2`}>
                  <div className="min-w-0 flex-1 text-[12px]">
                    <div className={`${mono} font-semibold text-[#1F1F1F] dark:text-[#ededed]`}>
                      {s.endpoint.method} {s.endpoint.path} <span className="font-normal text-[#7E7E7E]">saves {s.extract.map((e) => `{{${e.name}}}`).join(", ")}</span>
                    </div>
                    <div className="mt-0.5 text-[#5E6066] dark:text-[#9ca3af]">{s.reason}</div>
                  </div>
                  <button type="button" className={`${outlineButton} !px-2.5 !py-1 !text-[11.5px]`} onClick={() => accept(s)}>
                    Accept
                  </button>
                </div>
              ))}
            </div>
          )}
          {(saved.length > 0 || Object.keys(defaultHeaders).length > 0) && (
            <div>
              <div className={label}>Headers added to every test call</div>
              <KeyValueEditor key={JSON.stringify(Object.keys(defaultHeaders))} value={defaultHeaders} keyPlaceholder="Authorization" valuePlaceholder="Bearer {{token}}" addLabel="Add header" onChange={(h) => onDefaultHeaders((h as Record<string, string>) ?? {})} />
              {saved.length > 0 && <div className="mt-1.5 text-[11.5px] text-[#7E7E7E]">Saved variables: {saved.map((v) => `{{${v}}}`).join("  ")}</div>}
            </div>
          )}
          <div>
            <div className={label}>Your variables</div>
            <Hint short="Values no step can produce, like a second user&apos;s token." small>For values no step can produce, such as a second user&apos;s token ({"{{otherUserToken}}"}). A test that needs a variable nobody defined is skipped, not failed. {"{{expiredToken}}"} is generated for you.</Hint>
            <KeyValueEditor value={variables} keyPlaceholder="otherUserToken" valuePlaceholder="value" addLabel="Add variable" onChange={(v) => onVariables((v as Record<string, string>) ?? {})} />
          </div>
        </div>
      )}
    </section>
  );
}
