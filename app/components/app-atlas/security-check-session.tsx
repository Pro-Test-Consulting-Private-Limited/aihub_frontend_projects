"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SecurityCheck } from "@/app/lib/security-checklist";
import { appFrameUrl, guidedProcedureFor, type LiveKind } from "@/app/lib/security-live-checks";
import { GuidedLiveLab } from "@/app/components/app-atlas/guided-labs";
import type { AtlasClient } from "@/app/services/appatlas";
import {
  securityAgent,
  SecurityAgentError,
  type PasswordTry,
  type SecurityRun,
} from "@/app/services/security-agent";

type Props = {
  check: SecurityCheck;
  kind: LiveKind;
  targetUrl?: string | null;
  client: AtlasClient;
  onClose: () => void;
};

const STUFFING_WHAT =
  "Brute force detection means: can someone guess passwords by trying many times in a row? This automated check opens a real browser and fires common / patterned passwords at login while you watch. Pass if the app locks out, throttles, or never lets the attacker in. Fail if a guessed password gets a session.";

const ENUM_WHAT =
  "This automated test checks whether login errors leak which accounts exist. The agent tries a fake mobile and a real test mobile with the same wrong password, compares the on-screen errors, and marks pass or fail.";

/**
 * Canvas-style live session: centre = headed screenshot or app frame; side = steps / controls.
 */
export function SecurityCheckSession({ check, kind, targetUrl, client, onClose }: Props) {
  const loginUrl = (targetUrl || "").trim();
  const guide = kind === "guided" ? guidedProcedureFor(check.name) : null;
  const whatThisIs =
    kind === "stuffing" ? STUFFING_WHAT : kind === "enumeration" ? ENUM_WHAT : guide?.whatThisIs || check.does;
  const auto = kind === "stuffing" || kind === "enumeration";

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#FAFAFA] dark:bg-[#0a0a0a]">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#EEE] bg-white px-5 py-3 dark:border-[#1a1a1a] dark:bg-[#0a0a0a]">
        <div className="min-w-0 max-w-[920px]">
          <div className="flex items-center gap-2 text-[13px] font-medium text-[#1F1F1F] dark:text-[#ededed]">
            <span
              className={`h-[8px] w-[8px] rounded-full ${auto ? "bg-[#16A34A]" : "bg-[#D97706]"} ${auto ? "animate-pulse" : ""}`}
            />
            {check.name}
            <span className="text-[11px] font-normal uppercase tracking-wide text-[#7E7E7E]">
              {auto ? "Automated · live" : "Guided"}
            </span>
          </div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#5E6066] dark:text-[#9ca3af]">{whatThisIs}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-[6px] border border-[#E5E7EB] px-3 py-1.5 text-[12px] dark:border-[#2a2a2a]"
        >
          Back to plan
        </button>
      </div>
      {!loginUrl && (
        <div className="bg-amber-50 px-5 py-2 text-[12px] text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          Set an Application URL on the project first.
        </div>
      )}
      {kind === "stuffing" ? (
        <StuffingSession loginUrl={loginUrl} onClose={onClose} />
      ) : kind === "enumeration" ? (
        <EnumerationSession loginUrl={loginUrl} onClose={onClose} />
      ) : (
        <GuidedSession checkName={check.name} loginUrl={loginUrl} client={client} onClose={onClose} />
      )}
    </div>
  );
}

function StuffingSession({ loginUrl, onClose }: { loginUrl: string; onClose: () => void }) {
  const [identifier, setIdentifier] = useState("");
  const [name, setName] = useState("");
  const [year, setYear] = useState("");
  const [company, setCompany] = useState("");
  const [osintEmail, setOsintEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<SecurityRun | null>(null);
  const [setupOpen, setSetupOpen] = useState(true);
  const stepsEndRef = useRef<HTMLLIElement | null>(null);

  const done = run?.status === "completed" || run?.status === "failed";
  const verdict = run?.result?.verdict;

  useEffect(() => {
    if (!run || (run.status !== "queued" && run.status !== "running")) return;
    const t = setInterval(async () => {
      try {
        const next = await securityAgent.getRun(run.id);
        setRun(next);
        if (next.status === "completed" || next.status === "failed") {
          setBusy(false);
          setSetupOpen(false);
        }
      } catch (e) {
        setError(e instanceof SecurityAgentError ? e.message : "Poll failed");
        setBusy(false);
      }
    }, 800);
    return () => clearInterval(t);
  }, [run]);

  useEffect(() => {
    stepsEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [run?.steps?.length, run?.status]);

  const start = useCallback(async () => {
    setError(null);
    setRun(null);
    setSetupOpen(true);
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
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[10px] border border-[#E6E1F5] bg-[#111] dark:border-[#2a2a2a]">
        {run?.screenshot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={run.screenshot} alt="Live headed browser" className="h-full w-full object-contain" />
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-[13px] text-[#9CA3AF]">
            {busy || run?.status === "running" || run?.status === "queued"
              ? "Headed Chromium is opening on the Security agent host. Live frames appear here as attempts run."
              : "Start the check — the live browser view shows here while steps update on the right."}
          </div>
        )}
        {done && run?.result && (
          <div
            className={`absolute inset-x-0 bottom-0 border-t px-4 py-3 ${
              verdict === "compromised" || verdict === "fail" || verdict === "error"
                ? "border-red-200 bg-red-50/95 text-red-900"
                : "border-emerald-200 bg-emerald-50/95 text-emerald-900"
            }`}
          >
            <div className="text-[13px] font-semibold">{verdictHeadline(verdict)}</div>
            <div className="mt-0.5 text-[12px] opacity-90">{run.result.summary}</div>
          </div>
        )}
      </div>

      <aside className="flex w-[340px] shrink-0 min-h-0 flex-col overflow-hidden rounded-[10px] border border-[#E5E7EB] bg-white dark:border-[#2a2a2a] dark:bg-[#121212]">
        {/* Setup — collapsible once running/done */}
        <div className="shrink-0 border-b border-[#EEE] px-3 py-2.5 dark:border-[#1a1a1a]">
          <button
            type="button"
            className="flex w-full items-center justify-between text-[12px] font-medium text-[#1F1F1F] dark:text-[#ededed]"
            onClick={() => setSetupOpen((o) => !o)}
          >
            Setup
            <span className="text-[11px] text-[#7E7E7E]">{setupOpen ? "Hide" : "Show"}</span>
          </button>
          {setupOpen && (
            <div className="mt-2 space-y-2">
              <Field label="Login identifier" value={identifier} onChange={setIdentifier} placeholder="mobile or email" />
              <Field label="Name (optional)" value={name} onChange={setName} placeholder="for Name@Year patterns" />
              <Field label="Year (optional)" value={year} onChange={setYear} placeholder="e.g. 2003" />
              <Field label="Company (optional)" value={company} onChange={setCompany} placeholder="for Company@Year" />
              <Field label="Breach-check email (optional)" value={osintEmail} onChange={setOsintEmail} placeholder="name@company.com" />
              {!done && (
                <button
                  type="button"
                  disabled={busy || !loginUrl}
                  onClick={start}
                  className="w-full rounded-[6px] bg-[#16A34A] px-3.5 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50"
                >
                  {busy ? "Running…" : "Start headed attack"}
                </button>
              )}
              {error && <p className="text-[12px] text-red-600">{error}</p>}
            </div>
          )}
          {run && !setupOpen && (
            <div className="mt-1 truncate text-[11px] text-[#7E7E7E]">
              {identifier || "—"} · {busy ? "running" : run.status}
              {verdict ? ` · ${verdict}` : ""}
            </div>
          )}
        </div>

        {/* Password list + steps — scroll region */}
        <div className="flex min-h-0 flex-1 flex-col px-3 pt-2.5">
          <div className="mb-1.5 shrink-0 text-[12px] font-medium text-[#1F1F1F] dark:text-[#ededed]">Passwords tried</div>
          <div className="mb-2 max-h-[40%] min-h-[72px] shrink-0 overflow-y-auto rounded-[8px] border border-[#E5E7EB] dark:border-[#2a2a2a]">
            {(run?.passwordsTried || []).length === 0 ? (
              <div className="px-2.5 py-2 text-[11px] text-[#7E7E7E]">Cleartext passwords appear here as each attempt runs.</div>
            ) : (
              <table className="w-full text-left text-[11.5px]">
                <thead className="sticky top-0 bg-[#F5F6F6] text-[#7E7E7E] dark:bg-[#1a1a1a]">
                  <tr>
                    <th className="px-2 py-1 font-medium">#</th>
                    <th className="px-2 py-1 font-medium">Password</th>
                    <th className="px-2 py-1 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {(run?.passwordsTried || []).map((p) => (
                    <tr key={p.attempt} className="border-t border-[#EEE] dark:border-[#1a1a1a]">
                      <td className="px-2 py-1 align-top text-[#7E7E7E]">{p.attempt}</td>
                      <td className="px-2 py-1 align-top font-mono text-[12px] text-[#1F1F1F] dark:text-[#ededed]">{p.password}</td>
                      <td className="px-2 py-1 align-top">{passwordOutcomeLabel(p)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="mb-1.5 shrink-0 text-[12px] font-medium text-[#1F1F1F] dark:text-[#ededed]">Live steps</div>
          <ol className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain pb-2">
            {(run?.steps || []).length === 0 && (
              <li className="text-[11px] text-[#7E7E7E]">Steps appear as the attack runs.</li>
            )}
            {(run?.steps || []).map((s, i) => (
              <li key={`${s.at}-${i}`} className="flex gap-2 text-[12px] leading-snug">
                <StepDot kind={s.kind} />
                <span className="min-w-0 text-[#1F1F1F] dark:text-[#ededed]">{s.message}</span>
              </li>
            ))}
            <li ref={stepsEndRef} aria-hidden className="h-0" />
          </ol>
        </div>

        {/* Result footer — never overlaps steps */}
        {done && run?.result && (
          <div
            className={`shrink-0 border-t px-3 py-3 dark:border-[#1a1a1a] ${
              verdict === "compromised" || verdict === "fail" || verdict === "error"
                ? "border-red-100 bg-red-50 dark:bg-red-950/40"
                : "border-emerald-100 bg-emerald-50 dark:bg-emerald-950/30"
            }`}
          >
            <div
              className={`text-[13px] font-semibold ${
                verdict === "compromised" || verdict === "fail" || verdict === "error"
                  ? "text-red-800 dark:text-red-200"
                  : "text-emerald-800 dark:text-emerald-200"
              }`}
            >
              {verdictHeadline(verdict)}
            </div>
            <p
              className={`mt-1 text-[12px] leading-relaxed ${
                verdict === "compromised" || verdict === "fail" || verdict === "error"
                  ? "text-red-700 dark:text-red-300"
                  : "text-emerald-800 dark:text-emerald-300"
              }`}
            >
              {run.result.summary}
              {run.result.attempts != null ? ` (${run.result.attempts} attempt${run.result.attempts === 1 ? "" : "s"})` : ""}
            </p>
            {run.result.matchedPassword && (
              <p className="mt-1.5 rounded-[6px] bg-white/80 px-2 py-1.5 font-mono text-[12.5px] text-red-900 dark:bg-black/20 dark:text-red-100">
                Worked: {run.result.matchedPassword}
              </p>
            )}
            <p className="mt-2 text-[11.5px] text-[#5E6066] dark:text-[#9ca3af]">{verdictNextStep(verdict)}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={start}
                className="rounded-[6px] bg-[#16A34A] px-3 py-1.5 text-[12px] font-semibold text-white"
              >
                Run again
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-[6px] border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12px] dark:border-[#2a2a2a] dark:bg-[#1a1a1a]"
              >
                Back to plan
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function passwordOutcomeLabel(p: PasswordTry) {
  const map: Record<string, { text: string; className: string }> = {
    trying: { text: "trying…", className: "text-[#8664F2]" },
    failed: { text: "failed", className: "text-[#7E7E7E]" },
    success: { text: "WORKED", className: "font-semibold text-red-600" },
    blocked: { text: "blocked", className: "font-semibold text-[#16A34A]" },
    error: { text: "error", className: "text-amber-700" },
  };
  const m = map[p.outcome] || { text: p.outcome, className: "text-[#7E7E7E]" };
  return <span className={m.className}>{m.text}</span>;
}

function verdictHeadline(verdict?: string) {
  switch (verdict) {
    case "compromised":
      return "Check failed — login succeeded with a guessed password";
    case "protected":
      return "Check passed — app stopped the attack";
    case "held":
      return "Check held — no password worked in this run";
    case "error":
      return "Check errored";
    default:
      return "Check finished";
  }
}

function verdictNextStep(verdict?: string) {
  switch (verdict) {
    case "compromised":
      return "Next: require stronger passwords, lockout/CAPTCHA, and MFA. Re-run after fixes, or open a guided check (e.g. MFA / lockout notification).";
    case "protected":
      return "Next: confirm lockout notification (guided) and that a real user can still recover access.";
    case "held":
      return "Next: try with name/year patterns filled in, or raise attempt count. Also run username enumeration (guided).";
    default:
      return "Fix the error above, then run again.";
  }
}

function EnumerationSession({ loginUrl, onClose }: { loginUrl: string; onClose: () => void }) {
  const [realId, setRealId] = useState("");
  const [fakeId, setFakeId] = useState("0000000000");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<SecurityRun | null>(null);
  const done = run?.status === "completed" || run?.status === "failed";

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

  const start = async () => {
    setError(null);
    setRun(null);
    if (!loginUrl) {
      setError("Application URL is required.");
      return;
    }
    if (!realId.trim()) {
      setError("Enter a real test mobile (validIdentifier).");
      return;
    }
    setBusy(true);
    try {
      const started = await securityAgent.startUsernameEnumeration({
        loginUrl,
        validIdentifier: realId.trim(),
        invalidIdentifier: fakeId.trim() || "0000000000",
        headed: true,
      });
      setRun(started);
    } catch (e) {
      setBusy(false);
      setError(e instanceof SecurityAgentError ? e.message : "Could not start");
    }
  };

  return (
    <div className="flex min-h-0 flex-1 gap-4 p-4">
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[10px] border border-[#E6E1F5] bg-[#111] dark:border-[#2a2a2a]">
        {run?.screenshot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={run.screenshot} alt="Enumeration browser" className="h-full w-full object-contain" />
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-[13px] text-[#9CA3AF]">
            {busy ? "Running headed enumeration…" : "Start to watch fake vs real login attempts."}
          </div>
        )}
      </div>
      <aside className="flex w-[340px] shrink-0 min-h-0 flex-col overflow-hidden rounded-[10px] border border-[#E5E7EB] bg-white dark:border-[#2a2a2a] dark:bg-[#121212]">
        <div className="space-y-2 border-b border-[#EEE] px-3 py-2.5 dark:border-[#1a1a1a]">
          <Field label="Fake mobile" value={fakeId} onChange={setFakeId} placeholder="0000000000" />
          <Field label="Real test mobile" value={realId} onChange={setRealId} placeholder="your test mobile" />
          {!done && (
            <button
              type="button"
              disabled={busy || !loginUrl}
              onClick={start}
              className="w-full rounded-[6px] bg-[#16A34A] px-3 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Running…" : "Start automated enumeration"}
            </button>
          )}
          {error && <p className="text-[12px] text-red-600">{error}</p>}
        </div>
        <ol className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-2.5">
          {(run?.steps || []).map((s, i) => (
            <li key={`${s.at}-${i}`} className="flex gap-2 text-[12px]">
              <StepDot kind={s.kind} />
              <span>{s.message}</span>
            </li>
          ))}
        </ol>
        {done && run?.result && (
          <div
            className={`shrink-0 border-t px-3 py-3 ${
              run.result.verdict === "pass" ? "bg-emerald-50" : "bg-red-50"
            }`}
          >
            <div className="text-[13px] font-semibold">{run.result.verdict === "pass" ? "Pass" : "Fail"}</div>
            <p className="mt-1 text-[12px]">{run.result.summary}</p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={start} className="rounded-[6px] bg-[#16A34A] px-3 py-1.5 text-[12px] font-semibold text-white">
                Run again
              </button>
              <button type="button" onClick={onClose} className="rounded-[6px] border px-3 py-1.5 text-[12px]">
                Back to plan
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function GuidedSession({
  checkName,
  loginUrl,
  client,
  onClose,
}: {
  checkName: string;
  loginUrl: string;
  client: AtlasClient;
  onClose: () => void;
}) {
  const guide = guidedProcedureFor(checkName);
  const [doneSteps, setDoneSteps] = useState<Record<number, boolean>>({});
  /** Manual override: once set, auto events won't flip this step. */
  const [locked, setLocked] = useState<Record<number, boolean>>({});
  const [liveHint, setLiveHint] = useState<string | null>(null);
  const [frameSrc, setFrameSrc] = useState(() => appFrameUrl(loginUrl));
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<SecurityRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [leanOutcome, setLeanOutcome] = useState<{ pass: boolean; detail: string } | null>(null);
  const autoRecorded = useRef(false);

  useEffect(() => {
    setFrameSrc(appFrameUrl(loginUrl));
  }, [loginUrl]);

  const onLabEvent = useCallback(
    (event: string, detail?: string) => {
      if (!guide) return;
      if (detail) setLiveHint(detail);
      for (const s of guide.steps) {
        if (s.autoOn === event && !locked[s.n]) {
          setDoneSteps((prev) => (prev[s.n] ? prev : { ...prev, [s.n]: true }));
        }
      }
    },
    [guide, locked],
  );

  const submit = useCallback(
    async (pass: boolean, detail?: string) => {
      if (!guide) return;
      setBusy(true);
      setError(null);
      try {
        const stepNotes = guide.steps.map((s) => `${s.n}. ${s.title}: ${doneSteps[s.n] ? "DONE" : "not done"}`).join("\n");
        const run = await securityAgent.submitEnumeration({
          loginUrl: loginUrl || undefined,
          sameMessage: pass,
          notes:
            [notes.trim(), stepNotes, detail || liveHint ? `Lab: ${detail || liveHint}` : ""]
              .filter(Boolean)
              .join("\n\n") || `${checkName}: ${pass ? "pass" : "fail"}`,
        });
        setResult(run);
      } catch (e) {
        setError(e instanceof SecurityAgentError ? e.message : "Submit failed");
      } finally {
        setBusy(false);
      }
    },
    [guide, doneSteps, notes, liveHint, loginUrl, checkName],
  );

  // When every step is done and we know lean pass/fail → auto-record.
  useEffect(() => {
    if (!guide || autoRecorded.current || result?.result || !leanOutcome) return;
    const allDone = guide.steps.every((s) => doneSteps[s.n]);
    if (!allDone) return;
    autoRecorded.current = true;
    void submit(leanOutcome.pass, leanOutcome.detail);
  }, [guide, doneSteps, leanOutcome, result?.result, submit]);

  if (!guide) {
    return <div className="p-6 text-[13px] text-[#7E7E7E]">No guided procedure for this check yet.</div>;
  }

  const toggleStep = (n: number) => {
    setLocked((prev) => ({ ...prev, [n]: true }));
    setDoneSteps((prev) => ({ ...prev, [n]: !prev[n] }));
  };

  const recorded = Boolean(result?.result);
  const doneCount = guide.steps.filter((s) => doneSteps[s.n]).length;
  const openUrl = frameSrc || appFrameUrl(loginUrl);
  const liveLab = guide.lab === "jwt" || guide.lab === "idor";

  if (liveLab) {
    return (
      <div className="flex min-h-0 flex-1 gap-4 p-4">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <GuidedLiveLab
            loginUrl={appFrameUrl(loginUrl) || loginUrl}
            lab={guide.lab!}
            client={client}
            onEvent={onLabEvent}
            onClose={onClose}
            onOutcome={(pass, detail) => setLeanOutcome({ pass, detail })}
          />
        </div>
        <aside className="flex w-[340px] shrink-0 min-h-0 flex-col overflow-hidden rounded-[10px] border border-[#E5E7EB] bg-white dark:border-[#2a2a2a] dark:bg-[#121212]">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
            <p className="text-[12px] font-medium text-[#1F1F1F] dark:text-[#ededed]">{guide.plainStory}</p>
            <p className="text-[11px] text-[#7E7E7E]">
              Steps {doneCount}/{guide.steps.length} — ticks from the live site; pass/fail auto-records when complete
            </p>
            <ol className="space-y-2">
              {guide.steps.map((s) => {
                const on = Boolean(doneSteps[s.n]);
                return (
                  <li
                    key={s.n}
                    className={`rounded-[6px] border px-3 py-2 ${
                      on ? "border-[#16A34A] bg-[#F0FDF4] dark:bg-[#0f2418]" : "border-[#E5E7EB] bg-[#FAFAFA] dark:border-[#2a2a2a] dark:bg-[#1a1a1a]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[12.5px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">
                          {s.n}. {s.title}
                          {on && <span className="ml-1.5 text-[10px] font-medium text-[#16A34A]">live</span>}
                        </div>
                        <div className="mt-0.5 text-[12px] leading-snug text-[#5E6066] dark:text-[#9ca3af]">{s.does}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleStep(s.n)}
                        className={`shrink-0 rounded-[4px] border px-2 py-1 text-[11px] font-semibold ${
                          on ? "border-[#16A34A] text-[#16A34A]" : "border-[#D9D9D9] text-[#7E7E7E]"
                        }`}
                      >
                        {on ? "Done" : "Mark done"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
            <p className="text-[11px] text-[#9CA3AF]">
              Pass: {guide.passWhen}
              <br />
              Fail: {guide.failWhen}
            </p>
            {!recorded && leanOutcome && doneCount === guide.steps.length && (
              <div className="rounded-[6px] border border-[#8664F2]/40 bg-[#F3EEFF] px-3 py-2 text-[12px] text-[#5B21B6]">
                {busy ? "Recording result…" : `All steps done — auto ${leanOutcome.pass ? "PASS" : "FAIL"}: ${leanOutcome.detail}`}
              </div>
            )}
            {!recorded && (
              <>
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
                    onClick={() => {
                      autoRecorded.current = true;
                      void submit(true);
                    }}
                    className="rounded-[6px] border border-[#16A34A] bg-[#F0FDF4] px-3 py-1.5 text-[12px] font-semibold text-[#16A34A]"
                  >
                    Record pass
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      autoRecorded.current = true;
                      void submit(false);
                    }}
                    className="rounded-[6px] border border-[#D97706] bg-[#FFFBEB] px-3 py-1.5 text-[12px] font-semibold text-[#D97706]"
                  >
                    Record fail
                  </button>
                </div>
              </>
            )}
            {error && <p className="text-[12px] text-red-600">{error}</p>}
            {recorded && result?.result && (
              <div className={`rounded-[6px] border p-2 ${result.result.verdict === "pass" ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
                <div className="text-[13px] font-semibold">{result.result.verdict === "pass" ? "Pass — recorded" : "Fail — recorded"}</div>
                <p className="mt-1 text-[12px]">{result.result.summary}</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 gap-4 p-4">
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[10px] border border-[#E6E1F5] bg-white dark:border-[#2a2a2a] dark:bg-[#141414]">
        {openUrl ? (
          <>
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#EEE] bg-[#FAFAFA] px-3 py-1.5 text-[11.5px] text-[#5E6066] dark:border-[#1a1a1a] dark:bg-[#1a1a1a] dark:text-[#9ca3af]">
              <span className="truncate font-mono">{openUrl}</span>
              <a href={openUrl} target="_blank" rel="noreferrer" className="shrink-0 font-medium text-[#8664F2] underline hover:no-underline">
                Open in new tab
              </a>
            </div>
            <iframe title="Application under test" src={openUrl} className="h-full min-h-[420px] w-full flex-1 bg-white" />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-[13px] text-[#7E7E7E]">
            Set an Application URL on the project so the app opens here.
          </div>
        )}
      </div>
      <aside className="flex w-[400px] shrink-0 min-h-0 flex-col overflow-hidden rounded-[10px] border border-[#E5E7EB] bg-white dark:border-[#2a2a2a] dark:bg-[#121212]">
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
          <p className="text-[12px] font-medium text-[#1F1F1F] dark:text-[#ededed]">{guide.plainStory}</p>
          <p className="text-[11px] text-[#7E7E7E]">
            Steps done: {doneCount}/{guide.steps.length}
            {liveHint ? ` · ${liveHint}` : ""} — click Done to toggle
          </p>
          <ol className="space-y-2">
            {guide.steps.map((s) => {
              const on = Boolean(doneSteps[s.n]);
              return (
                <li
                  key={s.n}
                  className={`rounded-[6px] border px-3 py-2 transition-colors ${
                    on ? "border-[#16A34A] bg-[#F0FDF4] dark:bg-[#0f2418]" : "border-[#E5E7EB] bg-[#FAFAFA] dark:border-[#2a2a2a] dark:bg-[#1a1a1a]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">
                        {s.n}. {s.title}
                        {on && <span className="ml-1.5 text-[10px] font-medium text-[#16A34A]">live</span>}
                      </div>
                      <div className="mt-0.5 text-[12px] leading-snug text-[#5E6066] dark:text-[#9ca3af]">{s.does}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleStep(s.n)}
                      className={`shrink-0 rounded-[4px] border px-2 py-1 text-[11px] font-semibold ${
                        on ? "border-[#16A34A] text-[#16A34A]" : "border-[#D9D9D9] text-[#7E7E7E]"
                      }`}
                    >
                      {on ? "Done" : "Mark done"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="text-[11px] text-[#9CA3AF]">
            Pass when: {guide.passWhen}
            <br />
            Fail when: {guide.failWhen}
          </p>
          {!recorded && (
            <>
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
                  className="rounded-[6px] border border-[#16A34A] bg-[#F0FDF4] px-3 py-1.5 text-[12px] font-semibold text-[#16A34A]"
                >
                  Record pass
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => submit(false)}
                  className="rounded-[6px] border border-[#D97706] bg-[#FFFBEB] px-3 py-1.5 text-[12px] font-semibold text-[#D97706]"
                >
                  Record fail
                </button>
              </div>
            </>
          )}
          {error && <p className="text-[12px] text-red-600">{error}</p>}
        </div>
        {recorded && result?.result && (
          <div
            className={`shrink-0 border-t px-3 py-3 ${
              result.result.verdict === "pass" ? "border-emerald-100 bg-emerald-50" : "border-red-100 bg-red-50"
            }`}
          >
            <div className={`text-[13px] font-semibold ${result.result.verdict === "pass" ? "text-emerald-800" : "text-red-800"}`}>
              {result.result.verdict === "pass" ? "Pass — recorded" : "Fail — recorded"}
            </div>
            <p className="mt-1 text-[12px] text-[#5E6066]">{result.result.summary}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setDoneSteps({});
                  setLocked({});
                  setLiveHint(null);
                }}
                className="rounded-[6px] border px-3 py-1.5 text-[12px]"
              >
                Run again
              </button>
              <button type="button" onClick={onClose} className="rounded-[6px] bg-[#8664F2] px-3 py-1.5 text-[12px] font-semibold text-white">
                Back to plan
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
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
