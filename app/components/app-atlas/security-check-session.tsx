"use client";

import { useCallback, useEffect, useState } from "react";
import type { SecurityCheck } from "@/app/lib/security-checklist";
import { guidedProcedureFor, type LiveKind } from "@/app/lib/security-live-checks";
import {
  securityAgent,
  SecurityAgentError,
  type SecurityRun,
} from "@/app/services/security-agent";

type Props = {
  check: SecurityCheck;
  kind: LiveKind;
  targetUrl?: string | null;
  onClose: () => void;
};

/**
 * Canvas-style live session: centre = headed screenshot or app frame; side = steps / controls.
 */
export function SecurityCheckSession({ check, kind, targetUrl, onClose }: Props) {
  const loginUrl = (targetUrl || "").trim();

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#FAFAFA] dark:bg-[#0a0a0a]">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#EEE] bg-white px-5 py-2.5 dark:border-[#1a1a1a] dark:bg-[#0a0a0a]">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[13px] font-medium text-[#1F1F1F] dark:text-[#ededed]">
            <span className={`h-[8px] w-[8px] rounded-full ${kind === "stuffing" ? "animate-pulse bg-[#16A34A]" : "bg-[#D97706]"}`} />
            {check.name}
            <span className="text-[11px] font-normal uppercase tracking-wide text-[#7E7E7E]">{kind === "stuffing" ? "Automated · live" : "Guided"}</span>
          </div>
          <div className="truncate text-[11px] text-[#7E7E7E]">{check.does}</div>
        </div>
        <button type="button" onClick={onClose} className="shrink-0 rounded-[6px] border border-[#E5E7EB] px-3 py-1.5 text-[12px] dark:border-[#2a2a2a]">
          Back to plan
        </button>
      </div>
      {!loginUrl && (
        <div className="bg-amber-50 px-5 py-2 text-[12px] text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          Set an Application URL on the project first.
        </div>
      )}
      {kind === "stuffing" ? <StuffingSession loginUrl={loginUrl} /> : <GuidedSession checkName={check.name} loginUrl={loginUrl} />}
    </div>
  );
}

function StuffingSession({ loginUrl }: { loginUrl: string }) {
  const [identifier, setIdentifier] = useState("");
  const [name, setName] = useState("");
  const [year, setYear] = useState("");
  const [company, setCompany] = useState("");
  const [osintEmail, setOsintEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<SecurityRun | null>(null);

  useEffect(() => {
    if (!run || (run.status !== "queued" && run.status !== "running")) return;
    const t = setInterval(async () => {
      try {
        const next = await securityAgent.getRun(run.id);
        setRun(next);
        if (next.status === "completed" || next.status === "failed") setBusy(false);
      } catch (e) {
        setError(e instanceof SecurityAgentError ? e.message : "Poll failed");
        setBusy(false);
      }
    }, 800);
    return () => clearInterval(t);
  }, [run]);

  const start = useCallback(async () => {
    setError(null);
    setRun(null);
    if (!loginUrl) {
      setError("Application URL is required.");
      return;
    }
    if (!identifier.trim()) {
      setError("Enter the login identifier under test (mobile or email).");
      return;
    }
    setBusy(true);
    try {
      const started = await securityAgent.startCredentialStuffing({
        loginUrl,
        identifier: identifier.trim(),
        fields: {
          name: name.trim() || undefined,
          year: year.trim() || undefined,
          company: company.trim() || undefined,
          osintEmail: osintEmail.trim() || undefined,
        },
        headed: true,
      });
      setRun(started);
    } catch (e) {
      setBusy(false);
      setError(e instanceof SecurityAgentError ? e.message : "Could not start check");
    }
  }, [loginUrl, identifier, name, year, company, osintEmail]);

  return (
    <div className="flex min-h-0 flex-1 gap-4 p-4">
      <div className="flex min-w-0 flex-1 flex-col items-center justify-start overflow-auto">
        {run?.screenshot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={run.screenshot}
            alt="Live headed browser"
            className="max-h-full w-full max-w-[1100px] rounded-[10px] border border-[#E6E1F5] bg-black object-contain dark:border-[#2a2a2a]"
          />
        ) : (
          <div className="mt-16 max-w-md text-center text-[13px] text-[#7E7E7E]">
            {busy || run?.status === "running" || run?.status === "queued"
              ? "Headed Chromium is opening on the Security agent host. Live frames appear here as attempts run."
              : "Start the check to watch the headed browser here (same idea as canvas recording — steps on the right)."}
          </div>
        )}
      </div>
      <aside className="flex w-[320px] shrink-0 flex-col gap-3 overflow-y-auto">
        <div className="text-[12px] font-medium text-[#1F1F1F] dark:text-[#ededed]">Setup</div>
        <Field label="Login identifier" value={identifier} onChange={setIdentifier} placeholder="mobile or email" />
        <Field label="Name (optional)" value={name} onChange={setName} placeholder="for Name@Year patterns" />
        <Field label="Year (optional)" value={year} onChange={setYear} placeholder="e.g. 2003" />
        <Field label="Company (optional)" value={company} onChange={setCompany} placeholder="for Company@Year" />
        <Field label="Breach-check email (optional)" value={osintEmail} onChange={setOsintEmail} placeholder="name@company.com" />
        <button
          type="button"
          disabled={busy || !loginUrl}
          onClick={start}
          className="rounded-[6px] bg-[#16A34A] px-3.5 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Running…" : "Start headed attack"}
        </button>
        {run && (
          <div className="text-[11.5px] text-[#7E7E7E]">
            Status: <span className="font-mono text-[#1F1F1F] dark:text-[#ededed]">{run.status}</span>
            {run.result?.verdict ? ` · ${run.result.verdict}` : ""}
          </div>
        )}
        {error && <p className="text-[12px] text-red-600">{error}</p>}
        <div className="text-[12px] font-medium text-[#1F1F1F] dark:text-[#ededed]">Live steps</div>
        <ol className="min-h-[120px] flex-1 space-y-1.5 rounded-[8px] border border-[#E5E7EB] bg-white p-3 dark:border-[#2a2a2a] dark:bg-[#141414]">
          {(run?.steps || []).length === 0 && <li className="text-[11px] text-[#7E7E7E]">Steps appear as the attack runs.</li>}
          {(run?.steps || []).map((s, i) => (
            <li key={`${s.at}-${i}`} className="flex gap-2 text-[12px]">
              <StepDot kind={s.kind} />
              <span className="text-[#1F1F1F] dark:text-[#ededed]">
                {s.message}
                {s.hint ? <span className="ml-1 font-mono text-[#7E7E7E]">({s.hint})</span> : null}
              </span>
            </li>
          ))}
        </ol>
        {run?.result?.summary && (
          <p className={`text-[12.5px] font-medium ${run.result.verdict === "compromised" || run.result.verdict === "fail" ? "text-red-600" : "text-[#16A34A]"}`}>
            {run.result.summary}
          </p>
        )}
      </aside>
    </div>
  );
}

function GuidedSession({ checkName, loginUrl }: { checkName: string; loginUrl: string }) {
  const guide = guidedProcedureFor(checkName);
  const [sameMessage, setSameMessage] = useState<boolean | null>(null);
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<SecurityRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!guide) {
    return <div className="p-6 text-[13px] text-[#7E7E7E]">No guided procedure for this check yet.</div>;
  }

  const submit = async (pass: boolean) => {
    setBusy(true);
    setError(null);
    try {
      // Enumeration uses sameMessage; other guided checks use pass/fail via sameMessage mapping
      const run = await securityAgent.submitEnumeration({
        loginUrl: loginUrl || undefined,
        sameMessage: pass,
        notes: notes.trim() || `${checkName}: ${pass ? "pass" : "fail"}`,
      });
      setResult(run);
      setSameMessage(pass);
    } catch (e) {
      setError(e instanceof SecurityAgentError ? e.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  };

  const frameUrl = guide.showAppFrame && loginUrl ? loginUrl : null;

  return (
    <div className="flex min-h-0 flex-1 gap-4 p-4">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[10px] border border-[#E6E1F5] bg-white dark:border-[#2a2a2a] dark:bg-[#141414]">
        {frameUrl ? (
          <iframe title="Application under test" src={frameUrl} className="h-full min-h-[420px] w-full flex-1 bg-white" />
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-[13px] text-[#7E7E7E]">
            Follow the steps on the right. Open your app separately if this check is not browser-based.
          </div>
        )}
      </div>
      <aside className="flex w-[320px] shrink-0 flex-col gap-3 overflow-y-auto">
        <p className="text-[12.5px] leading-relaxed text-[#5E6066] dark:text-[#9ca3af]">{guide.plainStory}</p>
        <ol className="space-y-2">
          {guide.steps.map((s) => (
            <li key={s.n} className="rounded-[6px] border border-[#E5E7EB] bg-white px-3 py-2 dark:border-[#2a2a2a] dark:bg-[#1a1a1a]">
              <div className="text-[12.5px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">
                {s.n}. {s.title}
              </div>
              <div className="mt-0.5 text-[12px] text-[#7E7E7E]">{s.does}</div>
            </li>
          ))}
        </ol>
        <p className="text-[11px] text-[#7E7E7E]">
          Pass: {guide.passWhen}
          <br />
          Fail: {guide.failWhen}
        </p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Optional notes"
          className="w-full rounded-[6px] border border-[#E5E7EB] bg-white px-3 py-2 text-[12.5px] dark:border-[#2a2a2a] dark:bg-[#1a1a1a]"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => submit(true)}
            className={`rounded-[6px] border px-3 py-1.5 text-[12px] ${sameMessage === true ? "border-[#16A34A] bg-[#F0FDF4] font-semibold text-[#16A34A]" : "border-[#E5E7EB] dark:border-[#2a2a2a]"}`}
          >
            Record pass
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => submit(false)}
            className={`rounded-[6px] border px-3 py-1.5 text-[12px] ${sameMessage === false ? "border-[#D97706] bg-[#FFFBEB] font-semibold text-[#D97706]" : "border-[#E5E7EB] dark:border-[#2a2a2a]"}`}
          >
            Record fail
          </button>
        </div>
        {error && <p className="text-[12px] text-red-600">{error}</p>}
        {result?.result?.summary && (
          <p className={`text-[12.5px] font-medium ${result.result.verdict === "pass" ? "text-[#16A34A]" : "text-red-600"}`}>{result.result.summary}</p>
        )}
      </aside>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block text-[11.5px] text-[#7E7E7E]">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-[6px] border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-[12.5px] text-[#1F1F1F] dark:border-[#2a2a2a] dark:bg-[#1a1a1a] dark:text-[#ededed]"
      />
    </label>
  );
}

function StepDot({ kind }: { kind: string }) {
  const color =
    kind === "pass" || kind === "breach"
      ? "bg-[#16A34A]"
      : kind === "fail" || kind === "error"
        ? "bg-red-500"
        : kind === "attempt"
          ? "bg-[#8664F2]"
          : "bg-[#9CA3AF]";
  return <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${color}`} aria-hidden />;
}
