"use client";

import { useCallback, useEffect, useState } from "react";
import {
  securityAgent,
  SecurityAgentError,
  type EnumerationGuide,
  type SecurityRun,
} from "@/app/services/security-agent";

type Props = { targetUrl?: string | null };

/**
 * Live showcase for Authentication Security: one automated headed stuffing run + one guided enumeration checklist.
 */
export function SecurityShowcase({ targetUrl }: Props) {
  const loginUrl = (targetUrl || "").trim();
  const [tab, setTab] = useState<"stuffing" | "enumeration">("stuffing");

  return (
    <div className="mb-5 rounded-[10px] border border-[#E5E7EB] bg-[#FAFAFA] p-4 dark:border-[#2a2a2a] dark:bg-[#121212]">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h4 className="text-[13.5px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">Try a check (live)</h4>
          <p className="mt-0.5 max-w-[640px] text-[12px] text-[#5E6066] dark:text-[#9ca3af]">
            Watch an attacker reuse leaked-style passwords on your login, or walk a guided check for username leaks. Uses the Security Test Agent.
          </p>
        </div>
        <div className="flex gap-1.5">
          <TabBtn active={tab === "stuffing"} onClick={() => setTab("stuffing")} label="Watch an attack" tone="auto" />
          <TabBtn active={tab === "enumeration"} onClick={() => setTab("enumeration")} label="Do a check yourself" tone="guided" />
        </div>
      </div>
      {!loginUrl && (
        <p className="mt-3 rounded-[6px] border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          Set an Application URL on the project first — that becomes the login page under test.
        </p>
      )}
      <div className="mt-3">{tab === "stuffing" ? <StuffingPanel loginUrl={loginUrl} /> : <EnumerationPanel loginUrl={loginUrl} />}</div>
    </div>
  );
}

function TabBtn({ active, onClick, label, tone }: { active: boolean; onClick: () => void; label: string; tone: "auto" | "guided" }) {
  const on =
    tone === "auto"
      ? "border-[#16A34A] bg-[#F0FDF4] font-semibold text-[#16A34A]"
      : "border-[#D97706] bg-[#FFFBEB] font-semibold text-[#D97706]";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[6px] border px-3 py-1 text-[12px] ${active ? on : "border-[#E5E7EB] text-[#5E6066] dark:border-[#2a2a2a]"}`}
    >
      {label}
    </button>
  );
}

function StuffingPanel({ loginUrl }: { loginUrl: string }) {
  const [identifier, setIdentifier] = useState("");
  const [name, setName] = useState("");
  const [year, setYear] = useState("");
  const [company, setCompany] = useState("");
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
    }, 900);
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
      setError("Enter the email / username / mobile under test.");
      return;
    }
    setBusy(true);
    try {
      const started = await securityAgent.startCredentialStuffing({
        loginUrl,
        identifier: identifier.trim(),
        fields: { name: name.trim() || undefined, year: year.trim() || undefined, company: company.trim() || undefined },
        headed: true,
      });
      setRun(started);
    } catch (e) {
      setBusy(false);
      setError(e instanceof SecurityAgentError ? e.message : "Could not start check");
    }
  }, [loginUrl, identifier, name, year, company]);

  return (
    <div className="space-y-3">
      <p className="text-[12.5px] leading-relaxed text-[#5E6066] dark:text-[#9ca3af]">
        <span className="font-medium text-[#1F1F1F] dark:text-[#ededed]">Password guessing / stuffing.</span> Free OSINT checks (XposedOrNot, LeakCheck, EmailRep) see whether this email shows up in known leaks, then we build likely passwords from common lists and name/year patterns and try them in a real browser on your login.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Identifier under test" value={identifier} onChange={setIdentifier} placeholder="test.user@yourorg.com" />
        <Field label="Known name (optional)" value={name} onChange={setName} placeholder="for Name@Year patterns" />
        <Field label="Year (optional)" value={year} onChange={setYear} placeholder="1990 or 2024" />
        <Field label="Company (optional)" value={company} onChange={setCompany} placeholder="for Company@Year" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || !loginUrl}
          onClick={start}
          className="rounded-[6px] bg-[#16A34A] px-3.5 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Running…" : "Start attack (headed browser)"}
        </button>
        {run && (
          <span className="text-[11.5px] text-[#7E7E7E]">
            Status: <span className="font-mono text-[#1F1F1F] dark:text-[#ededed]">{run.status}</span>
            {run.result?.verdict ? ` · ${run.result.verdict}` : ""}
          </span>
        )}
      </div>
      {error && <p className="text-[12px] text-red-600">{error}</p>}
      {run?.breach?.message && (
        <p className="rounded-[6px] border border-[#E5E7EB] bg-white px-3 py-2 text-[12px] text-[#5E6066] dark:border-[#2a2a2a] dark:bg-[#1a1a1a] dark:text-[#9ca3af]">
          {run.breach.message}
        </p>
      )}
      {run?.steps?.length ? (
        <ol className="max-h-[240px] space-y-1.5 overflow-y-auto rounded-[8px] border border-[#E5E7EB] bg-white p-3 dark:border-[#2a2a2a] dark:bg-[#1a1a1a]">
          {run.steps.map((s, i) => (
            <li key={`${s.at}-${i}`} className="flex gap-2 text-[12px]">
              <StepDot kind={s.kind} />
              <span className="text-[#1F1F1F] dark:text-[#ededed]">
                {s.message}
                {s.hint ? <span className="ml-1 font-mono text-[#7E7E7E]">({s.hint})</span> : null}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
      {run?.result?.summary && (
        <p className={`text-[12.5px] font-medium ${run.result.verdict === "compromised" || run.result.verdict === "fail" ? "text-red-600" : "text-[#16A34A]"}`}>
          {run.result.summary}
        </p>
      )}
    </div>
  );
}

function EnumerationPanel({ loginUrl }: { loginUrl: string }) {
  const [guide, setGuide] = useState<EnumerationGuide | null>(null);
  const [sameMessage, setSameMessage] = useState<boolean | null>(null);
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<SecurityRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    securityAgent
      .enumerationGuide()
      .then((g) => {
        if (!cancelled) setGuide(g);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof SecurityAgentError ? e.message : "Could not load guide");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async () => {
    if (sameMessage === null) {
      setError("Pick whether the messages were the same or different.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const run = await securityAgent.submitEnumeration({ loginUrl: loginUrl || undefined, sameMessage, notes: notes.trim() || undefined });
      setResult(run);
    } catch (e) {
      setError(e instanceof SecurityAgentError ? e.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-[12.5px] leading-relaxed text-[#5E6066] dark:text-[#9ca3af]">
        <span className="font-medium text-[#1F1F1F] dark:text-[#ededed]">{guide?.title || "Username enumeration"}.</span>{" "}
        {guide?.plainStory}
      </p>
      {guide && (
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
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSameMessage(true)}
          className={`rounded-[6px] border px-3 py-1.5 text-[12px] ${sameMessage === true ? "border-[#16A34A] bg-[#F0FDF4] font-semibold text-[#16A34A]" : "border-[#E5E7EB] dark:border-[#2a2a2a]"}`}
        >
          Same message (pass)
        </button>
        <button
          type="button"
          onClick={() => setSameMessage(false)}
          className={`rounded-[6px] border px-3 py-1.5 text-[12px] ${sameMessage === false ? "border-[#D97706] bg-[#FFFBEB] font-semibold text-[#D97706]" : "border-[#E5E7EB] dark:border-[#2a2a2a]"}`}
        >
          Different message (fail)
        </button>
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Optional notes (what each error said)"
        className="w-full rounded-[6px] border border-[#E5E7EB] bg-white px-3 py-2 text-[12.5px] dark:border-[#2a2a2a] dark:bg-[#1a1a1a]"
      />
      <button
        type="button"
        disabled={busy || sameMessage === null}
        onClick={submit}
        className="rounded-[6px] bg-[#D97706] px-3.5 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Saving…" : "Record result"}
      </button>
      {error && <p className="text-[12px] text-red-600">{error}</p>}
      {result?.result?.summary && (
        <p className={`text-[12.5px] font-medium ${result.result.verdict === "pass" ? "text-[#16A34A]" : "text-red-600"}`}>{result.result.summary}</p>
      )}
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
