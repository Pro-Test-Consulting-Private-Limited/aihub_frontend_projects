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
  "Brute force detection means: can someone guess passwords by trying many times in a row? Tell the agent what you know (often just a mobile). It fakes an OSINT stitch (Truecaller / UPI / breach-style signals), builds a Name@Year password graph, and tries those live in a headed browser. Pass if the app locks out or never lets the attacker in.";

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

type ClueRow = { id: string; value: string };

function parseClues(rows: ClueRow[]) {
  const values = rows.map((r) => r.value.trim()).filter(Boolean);
  let identifier = "";
  let name = "";
  let year = "";
  let company = "";
  for (const v of values) {
    if (/^\+?\d[\d\s-]{7,}$/.test(v) || /^\d{10}$/.test(v.replace(/\D/g, ""))) {
      if (!identifier) identifier = v.replace(/\s+/g, "");
    } else if (/^\d{4}$/.test(v) && Number(v) >= 1950 && Number(v) <= 2015) {
      if (!year) year = v;
    } else if (/@/.test(v)) {
      if (!identifier) identifier = v;
    } else if (/[a-zA-Z]{2,}/.test(v)) {
      if (!name) name = v;
      else if (!company) company = v;
    }
  }
  return { identifier, name, year, company, clues: values };
}

/** Showcase: known demo mobile → name + DOB year (matches agent demo-intel). */
const DEMO_PHONE_HINT: Record<string, { fullName: string; year: string }> = {
  "9900776952": { fullName: "Marti Sai Santosh Pradyumna", year: "2003" },
};

function StuffingSession({ loginUrl, onClose }: { loginUrl: string; onClose: () => void }) {
  const [clues, setClues] = useState<ClueRow[]>([{ id: "c1", value: "" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<SecurityRun | null>(null);
  const [setupOpen, setSetupOpen] = useState(true);
  const [intelPreview, setIntelPreview] = useState<{
    phone: string;
    fullName: string;
    year: string;
    sources: { id: string; label: string; hit: string; score: number; ready: boolean }[];
  } | null>(null);
  const stepsEndRef = useRef<HTMLLIElement | null>(null);

  const done = run?.status === "completed" || run?.status === "failed";
  const verdict = run?.result?.verdict;
  const intel = run?.intel || null;

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
    setIntelPreview(null);
    setSetupOpen(true);
    if (!loginUrl) {
      setError("Application URL is required.");
      return;
    }
    const parsed = parseClues(clues);
    if (!parsed.identifier) {
      setError("Add at least a mobile number (or email) in “Say what you know”.");
      return;
    }
    setBusy(true);
    try {
      const phoneKey = parsed.identifier.replace(/\D/g, "").slice(-10);
      const demo = DEMO_PHONE_HINT[phoneKey];
      if (demo) {
        const sources = [
          { id: "enum", label: "CNAM / SIP ENUM enrich", hit: "consumer MSISDN (non-trunk)", score: 88, ready: false },
          { id: "truecaller", label: "Truecaller-class directory", hit: demo.fullName, score: 92, ready: false },
          { id: "phonepe", label: "UPI VPA → display-name graph", hit: "Marti S. Pradyumna", score: 78, ready: false },
          { id: "gpay", label: "GPay entity cluster", hit: "Sai Pradyumna", score: 71, ready: false },
          { id: "hibp", label: "Breach-email ∩ DOB prior", hit: `birth year ${demo.year}`, score: 64, ready: false },
          { id: "jw", label: "Jaro–Winkler resolve ≥0.86", hit: demo.fullName, score: 90, ready: false },
        ];
        setIntelPreview({ phone: phoneKey, fullName: demo.fullName, year: demo.year, sources });
        for (let i = 0; i < sources.length; i++) {
          await new Promise((r) => setTimeout(r, 420));
          setIntelPreview((prev) =>
            prev
              ? { ...prev, sources: prev.sources.map((s, j) => (j <= i ? { ...s, ready: true } : s)) }
              : prev,
          );
        }
        await new Promise((r) => setTimeout(r, 350));
      }

      const started = await securityAgent.startCredentialStuffing({
        loginUrl,
        identifier: parsed.identifier,
        clues: parsed.clues,
        fields: {
          name: parsed.name || demo?.fullName || undefined,
          year: parsed.year || demo?.year || undefined,
          company: parsed.company || undefined,
        },
        headed: true,
      });
      setRun(started);
    } catch (e) {
      setBusy(false);
      setError(e instanceof SecurityAgentError ? e.message : "Could not start check");
    }
  }, [loginUrl, clues]);

  const addClue = () => setClues((rows) => [...rows, { id: `c${Date.now()}`, value: "" }]);
  const setClue = (id: string, value: string) => setClues((rows) => rows.map((r) => (r.id === id ? { ...r, value } : r)));
  const removeClue = (id: string) => setClues((rows) => (rows.length <= 1 ? rows : rows.filter((r) => r.id !== id)));

  const sourceBars = intelPreview?.sources || intel?.sources || [];

  return (
    <div className="flex min-h-0 flex-1 gap-3 p-3">
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[10px] border border-[#E6E1F5] bg-[#111] dark:border-[#2a2a2a]">
        {run?.screenshot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={run.screenshot} alt="Live headed browser" className="h-full w-full object-contain" />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-[13px] text-[#9CA3AF]">
            {busy || run?.status === "running" || run?.status === "queued" ? (
              <>
                <p className="text-[#fbbf24]">Gathering OSINT → opening headed browser…</p>
                <p>Live login attempts appear here once Chromium is on the agent host.</p>
              </>
            ) : (
              <p>Say what you know on the right, then start — live browser + password graph appear here.</p>
            )}
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

      <aside className="flex w-[400px] shrink-0 min-h-0 flex-col overflow-hidden rounded-[10px] border border-[#E5E7EB] bg-white dark:border-[#2a2a2a] dark:bg-[#121212]">
        <div className="shrink-0 border-b border-[#EEE] px-3 py-2.5 dark:border-[#1a1a1a]">
          <button
            type="button"
            className="flex w-full items-center justify-between text-[12px] font-medium text-[#1F1F1F] dark:text-[#ededed]"
            onClick={() => setSetupOpen((o) => !o)}
          >
            Say what you know
            <span className="text-[11px] text-[#7E7E7E]">{setupOpen ? "Hide" : "Show"}</span>
          </button>
          {setupOpen && (
            <div className="mt-2 space-y-2">
              <p className="text-[11px] leading-snug text-[#7E7E7E]">
                Add rows — mobile is enough for the demo. Optional: full name, birth year, company.
              </p>
              {clues.map((row, i) => (
                <div key={row.id} className="flex gap-1.5">
                  <input
                    value={row.value}
                    onChange={(e) => setClue(row.id, e.target.value)}
                    placeholder={i === 0 ? "e.g. 9900776952" : "name, year, company…"}
                    className="min-w-0 flex-1 rounded-[6px] border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-[12.5px] dark:border-[#2a2a2a] dark:bg-[#1a1a1a]"
                  />
                  <button
                    type="button"
                    onClick={() => removeClue(row.id)}
                    disabled={clues.length <= 1}
                    className="shrink-0 rounded-[6px] border border-[#E5E7EB] px-2 text-[11px] text-[#7E7E7E] disabled:opacity-30 dark:border-[#2a2a2a]"
                  >
                    −
                  </button>
                </div>
              ))}
              <button type="button" onClick={addClue} className="text-[11.5px] font-medium text-[#8664F2] underline">
                + Add another clue
              </button>
              {!done && (
                <button
                  type="button"
                  disabled={busy || !loginUrl}
                  onClick={() => void start()}
                  className="w-full rounded-[6px] bg-[#16A34A] px-3.5 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50"
                >
                  {busy ? "Running OSINT + attack…" : "Start OSINT + headed attack"}
                </button>
              )}
              {error && <p className="text-[12px] text-red-600">{error}</p>}
            </div>
          )}
          {run && !setupOpen && (
            <div className="mt-1 truncate text-[11px] text-[#7E7E7E]">
              {parseClues(clues).identifier || "—"} · {busy ? "running" : run.status}
              {verdict ? ` · ${verdict}` : ""}
            </div>
          )}
        </div>

        {(intelPreview || intel) && (
          <div className="shrink-0 space-y-2 border-b border-[#EEE] px-3 py-2.5 dark:border-[#1a1a1a]">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[#8664F2]">OSINT stitch</div>
            <p className="text-[11.5px] text-[#5E6066] dark:text-[#9ca3af]">
              Phone{" "}
              <span className="font-mono text-[#1F1F1F] dark:text-[#ededed]">
                {intelPreview?.phone || intel?.phone}
              </span>
              {(intelPreview?.fullName || intel?.fullName) && (
                <>
                  {" "}
                  → <strong>{intelPreview?.fullName || intel?.fullName}</strong>
                  {(intelPreview?.year || intel?.year) && <> · born {intelPreview?.year || intel?.year}</>}
                </>
              )}
            </p>
            <div className="space-y-1.5">
              {sourceBars.map((s) => {
                const ready = "ready" in s ? Boolean((s as { ready?: boolean }).ready) : true;
                const score = s.score ?? 0;
                return (
                  <div key={s.id}>
                    <div className="mb-0.5 flex justify-between gap-2 text-[10.5px] text-[#7E7E7E]">
                      <span className="truncate">{s.label}</span>
                      <span className="shrink-0 font-mono">{ready ? `${score}%` : "…"}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[#E5E7EB] dark:bg-[#2a2a2a]">
                      <div
                        className="h-full rounded-full bg-[#8664F2] transition-all duration-500"
                        style={{ width: ready ? `${score}%` : "8%" }}
                      />
                    </div>
                    {ready && <div className="mt-0.5 truncate text-[10.5px] text-[#5E6066] dark:text-[#9ca3af]">{s.hit}</div>}
                  </div>
                );
              })}
            </div>
            <p className="text-[10.5px] leading-snug text-[#9CA3AF]">
              Next: markov ⊕ leet ⊕ Name@DOB lattice (≥40 nodes). Live Chromium only on top posterior mass.
            </p>
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col px-3 pt-2.5">
          <div className="mb-1.5 shrink-0 text-[12px] font-medium text-[#1F1F1F] dark:text-[#ededed]">Passwords tried</div>
          <div className="mb-2 max-h-[36%] min-h-[72px] shrink-0 overflow-y-auto rounded-[8px] border border-[#E5E7EB] dark:border-[#2a2a2a]">
            {(run?.passwordsTried || []).length === 0 ? (
              <div className="px-2.5 py-2 text-[11px] text-[#7E7E7E]">Cleartext passwords appear as each attempt runs.</div>
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
              {run.result.summary || run.error || run.result.reason}
              {run.result.attempts != null ? ` (${run.result.attempts} attempt${run.result.attempts === 1 ? "" : "s"})` : ""}
            </p>
            {(run.error || run.result.reason) && verdict === "error" && (
              <pre className="mt-1.5 max-h-20 overflow-auto whitespace-pre-wrap rounded-[6px] bg-white/80 px-2 py-1.5 font-mono text-[10.5px] text-red-900 dark:bg-black/20 dark:text-red-100">
                {String(run.error || run.result.reason).slice(0, 500)}
              </pre>
            )}
            {run.result.matchedPassword && (
              <p className="mt-1.5 rounded-[6px] bg-white/80 px-2 py-1.5 font-mono text-[12.5px] text-red-900 dark:bg-black/20 dark:text-red-100">
                Worked: {run.result.matchedPassword}
              </p>
            )}
            <p className="mt-2 text-[11.5px] text-[#5E6066] dark:text-[#9ca3af]">{verdictNextStep(verdict)}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void start()}
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

  type GuidedVerdict = "pass" | "fail" | "inconclusive";

  const submit = useCallback(
    async (verdict: GuidedVerdict, detail?: string) => {
      if (!guide) return;
      setBusy(true);
      setError(null);
      try {
        const stepNotes = guide.steps.map((s) => `${s.n}. ${s.title}: ${doneSteps[s.n] ? "DONE" : "not done"}`).join("\n");
        const labLine = detail || liveHint ? `Lab: ${detail || liveHint}` : "";
        const run = await securityAgent.submitGuidedResult({
          checkName,
          verdict,
          loginUrl: loginUrl || undefined,
          detail:
            detail ||
            (verdict === "pass"
              ? guide.passWhen
              : verdict === "fail"
                ? guide.failWhen
                : "No result — tester did not conclude pass or fail."),
          notes: [notes.trim(), stepNotes, labLine].filter(Boolean).join("\n\n") || undefined,
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

  // When every step is done and lab suggests pass/fail → auto-record (tester can still override).
  useEffect(() => {
    if (!guide || autoRecorded.current || result?.result || !leanOutcome) return;
    const allDone = guide.steps.every((s) => doneSteps[s.n]);
    if (!allDone) return;
    autoRecorded.current = true;
    void submit(leanOutcome.pass ? "pass" : "fail", leanOutcome.detail);
  }, [guide, doneSteps, leanOutcome, result?.result, submit]);

  const verdictBtns = (current?: string) => (
    <div className="flex flex-wrap gap-2">
      {(
        [
          { v: "pass" as const, label: "Pass", cls: "border-[#16A34A] bg-[#F0FDF4] text-[#16A34A]" },
          { v: "fail" as const, label: "Fail", cls: "border-[#D97706] bg-[#FFFBEB] text-[#D97706]" },
          { v: "inconclusive" as const, label: "No result", cls: "border-[#9CA3AF] bg-[#F5F6F6] text-[#4B5563]" },
        ] as const
      ).map(({ v, label, cls }) => {
        const active = current === v;
        return (
          <button
            key={v}
            type="button"
            disabled={busy}
            onClick={() => {
              autoRecorded.current = true;
              void submit(v, leanOutcome?.detail);
            }}
            className={`rounded-[6px] border px-3 py-1.5 text-[12px] font-semibold disabled:opacity-50 ${cls} ${
              active ? "ring-2 ring-offset-1 ring-[#8664F2]" : ""
            }`}
          >
            {active ? `${label} ✓` : label}
          </button>
        );
      })}
    </div>
  );
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
      <GuidedLiveLab
        loginUrl={appFrameUrl(loginUrl) || loginUrl}
        lab={guide.lab!}
        client={client}
        onEvent={onLabEvent}
        onClose={onClose}
        onOutcome={(pass, detail) => setLeanOutcome({ pass, detail })}
        render={({ browser, tools }) => (
          <div className="flex min-h-0 flex-1 gap-3 p-3">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">{browser}</div>
            <aside className="flex w-[380px] shrink-0 min-h-0 flex-col overflow-hidden rounded-[10px] border border-[#E5E7EB] bg-white dark:border-[#2a2a2a] dark:bg-[#121212]">
              <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
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
                          on
                            ? "border-[#16A34A] bg-[#F0FDF4] dark:bg-[#0f2418]"
                            : "border-[#E5E7EB] bg-[#FAFAFA] dark:border-[#2a2a2a] dark:bg-[#1a1a1a]"
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
                {leanOutcome && (
                  <div className="rounded-[6px] border border-[#8664F2]/40 bg-[#F3EEFF] px-3 py-2 text-[12px] text-[#5B21B6]">
                    Lab suggests: <strong>{leanOutcome.pass ? "PASS" : "FAIL"}</strong>
                    {leanOutcome.detail ? ` — ${leanOutcome.detail}` : ""}. You can override below.
                  </div>
                )}
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Optional notes"
                  className="w-full rounded-[6px] border border-[#E5E7EB] bg-white px-3 py-2 text-[12.5px] dark:border-[#2a2a2a] dark:bg-[#1a1a1a]"
                />
                <div className="space-y-1.5">
                  <div className="text-[11px] font-medium text-[#7E7E7E]">
                    {recorded ? "Recorded — override anytime" : "Record result"}
                  </div>
                  {verdictBtns(result?.result?.verdict)}
                </div>
                {error && <p className="text-[12px] text-red-600">{error}</p>}
                {recorded && result?.result && (
                  <div
                    className={`rounded-[6px] border p-2 ${
                      result.result.verdict === "pass"
                        ? "border-emerald-200 bg-emerald-50"
                        : result.result.verdict === "fail"
                          ? "border-red-200 bg-red-50"
                          : "border-[#E5E7EB] bg-[#F5F6F6]"
                    }`}
                  >
                    <div className="text-[13px] font-semibold">
                      {result.result.verdict === "pass"
                        ? "Pass — recorded"
                        : result.result.verdict === "fail"
                          ? "Fail — recorded"
                          : "No result — recorded"}
                    </div>
                    <p className="mt-1 text-[12px]">{result.result.summary}</p>
                  </div>
                )}
              </div>
              <div className="max-h-[46%] shrink-0 overflow-y-auto border-t border-[#E5E7EB] bg-[#FAFAFA] dark:border-[#2a2a2a] dark:bg-[#1a1a1a]">
                {tools}
              </div>
            </aside>
          </div>
        )}
      />
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
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Optional notes"
            className="w-full rounded-[6px] border border-[#E5E7EB] bg-white px-3 py-2 text-[12.5px] dark:border-[#2a2a2a] dark:bg-[#1a1a1a]"
          />
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium text-[#7E7E7E]">
              {recorded ? "Recorded — override anytime" : "Record result"}
            </div>
            {verdictBtns(result?.result?.verdict)}
          </div>
          {error && <p className="text-[12px] text-red-600">{error}</p>}
        </div>
        {recorded && result?.result && (
          <div
            className={`shrink-0 border-t px-3 py-3 ${
              result.result.verdict === "pass"
                ? "border-emerald-100 bg-emerald-50"
                : result.result.verdict === "fail"
                  ? "border-red-100 bg-red-50"
                  : "border-[#E5E7EB] bg-[#F5F6F6]"
            }`}
          >
            <div className="text-[13px] font-semibold text-[#1F1F1F]">
              {result.result.verdict === "pass"
                ? "Pass — recorded"
                : result.result.verdict === "fail"
                  ? "Fail — recorded"
                  : "No result — recorded"}
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
                  autoRecorded.current = false;
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
