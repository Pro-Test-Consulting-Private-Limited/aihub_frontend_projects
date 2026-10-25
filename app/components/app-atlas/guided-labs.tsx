"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { securityAgent, SecurityAgentError, type SecurityRun } from "@/app/services/security-agent";

type LabProps = {
  loginUrl: string;
  lab: "jwt" | "idor";
  onEvent: (event: string, detail?: string) => void;
  onClose: () => void;
  /** Called when the live check has a lean pass/fail (probe / IDOR page result). */
  onOutcome?: (pass: boolean, detail: string) => void;
};

/**
 * Human drives headed Chromium; this pane mirrors screenshots.
 * Step 1 only completes after the first live frame arrives.
 */
export function GuidedLiveLab({ loginUrl, lab, onEvent, onClose, onOutcome }: LabProps) {
  const [run, setRun] = useState<SecurityRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mobileB, setMobileB] = useState("");
  const [passB, setPassB] = useState("");
  const [decoded, setDecoded] = useState<{ header: Record<string, unknown>; payload: Record<string, unknown> } | null>(null);
  const [probeOut, setProbeOut] = useState<{ status?: number; body?: string; rejected?: boolean } | null>(null);
  const [forgedNote, setForgedNote] = useState<string | null>(null);
  const [pollErr, setPollErr] = useState<string | null>(null);
  const startedFlag = useRef(false);
  const runIdRef = useRef<string | null>(null);
  const outcomeSent = useRef(false);
  const autoStarted = useRef(false);

  const flags = run?.guided?.flags || {};

  useEffect(() => {
    if ((flags.browser_ready || run?.screenshot) && !startedFlag.current) {
      startedFlag.current = true;
      onEvent("browser_started");
    }
    if (flags.logged_in) onEvent("logged_in");
    if (flags.token_captured) onEvent("token_captured");
    if (flags.decoded) onEvent("decoded");
    if (flags.forged) onEvent("forged");
    if (flags.probed) onEvent("probed");
    if (flags.verdict_ready) onEvent("verdict_ready");
    if (flags.victim_loaded) onEvent("victim_loaded");
    if (flags.idor_navigated) onEvent("idor_navigated");
    if (flags.idor_result) onEvent("idor_result");

    // Lean pass/fail from live site — parent auto-records when all steps are done.
    if (!outcomeSent.current && onOutcome) {
      if (lab === "jwt" && flags.verdict_ready && flags.probed) {
        const pass = Boolean(flags.forge_rejected);
        outcomeSent.current = true;
        onOutcome(pass, pass ? "Forged JWT rejected by API" : "Forged JWT was accepted");
      } else if (lab === "idor" && flags.idor_result) {
        const pass = Boolean(flags.page_forbidden) && !flags.page_txn_visible;
        outcomeSent.current = true;
        onOutcome(pass, pass ? "Live site blocked other user’s txn" : "Live site showed other user’s txn");
      }
    }
  }, [flags, run?.screenshot, onEvent, onOutcome, lab]);

  // Always close Chromium when leaving this panel.
  useEffect(() => {
    return () => {
      const id = runIdRef.current;
      if (!id) return;
      securityAgent.guidedBrowserAction(id, { type: "stop" }).catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (!run?.id) return;
    if (run.status !== "queued" && run.status !== "running") return;
    let cancelled = false;
    const tick = async () => {
      try {
        const next = await securityAgent.getRun(run.id);
        if (!cancelled) {
          setRun(next);
          setPollErr(null);
          if (next.error) setErr(next.error);
        }
      } catch (e) {
        if (!cancelled) setPollErr(e instanceof Error ? e.message : "Poll failed");
      }
    };
    tick();
    const t = setInterval(tick, 600);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [run?.id, run?.status]);

  const start = useCallback(async () => {
    setBusy(true);
    setErr(null);
    setPollErr(null);
    startedFlag.current = false;
    try {
      if (!loginUrl) throw new Error("Application URL required on the project.");
      const next = await securityAgent.startGuidedBrowser({ loginUrl, lab, headed: true });
      runIdRef.current = next.id;
      outcomeSent.current = false;
      setRun(next);
    } catch (e) {
      setErr(e instanceof SecurityAgentError ? e.message : e instanceof Error ? e.message : "Start failed");
    } finally {
      setBusy(false);
    }
  }, [loginUrl, lab]);

  // Open like automated sessions — no separate Start button.
  useEffect(() => {
    if (autoStarted.current || !loginUrl) return;
    autoStarted.current = true;
    void start();
  }, [loginUrl, start]);

  const act = async (body: Record<string, unknown>) => {
    if (!run) return;
    setBusy(true);
    setErr(null);
    try {
      const out = await securityAgent.guidedBrowserAction(run.id, body);
      if (out.run) setRun(out.run as SecurityRun);
      if (body.type === "jwt_decode" && out.header) {
        setDecoded({
          header: out.header as Record<string, unknown>,
          payload: (out.payload || {}) as Record<string, unknown>,
        });
      }
      if (body.type === "jwt_forge") {
        setForgedNote("Forged alg:none token ready — signature emptied. Next: Probe.");
      }
      if (body.type === "jwt_probe") {
        const rejected = Boolean(out.rejected);
        setProbeOut({
          status: out.status as number | undefined,
          body: String(out.bodyPreview || ""),
          rejected,
        });
        if (!outcomeSent.current && onOutcome) {
          outcomeSent.current = true;
          onOutcome(rejected, rejected ? "Forged JWT rejected by API" : "Forged JWT was accepted");
        }
      }
    } catch (e) {
      setErr(e instanceof SecurityAgentError ? e.message : e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const stopBrowser = useCallback(async () => {
    const id = runIdRef.current || run?.id;
    if (!id) return;
    try {
      await securityAgent.guidedBrowserAction(id, { type: "stop" });
    } catch {
      /* ignore */
    }
    runIdRef.current = null;
  }, [run?.id]);

  const stop = useCallback(async () => {
    await stopBrowser();
    onClose();
  }, [stopBrowser, onClose]);

  const victimTxns = run?.guided?.victimTxns || [];
  const lastSteps = (run?.steps || []).slice(-4);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[10px] border border-[#E6E1F5] bg-[#111] dark:border-[#2a2a2a]">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#333] bg-[#1a1a1a] px-3 py-1.5 text-[11.5px] text-[#ccc]">
          <span className="truncate font-mono">{run?.guided?.url || (busy || run ? "Opening live browser…" : "Preparing…")}</span>
          {run && (
            <button type="button" onClick={() => act({ type: "stop" })} className="shrink-0 text-[#f87171] underline">
              Stop browser
            </button>
          )}
        </div>
        <div className="flex min-h-[420px] flex-1 flex-col items-center justify-center bg-[#0a0a0a] p-2">
          {run?.screenshot ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={run.screenshot} alt="Live application" className="max-h-full max-w-full object-contain" />
          ) : (
            <div className="max-w-lg space-y-2 p-6 text-center text-[13px] text-[#9ca3af]">
              <p className="text-[#fbbf24]">Opening live browser…</p>
              <p>
                A <strong className="text-[#ddd]">Chromium</strong> window opens with this session — sign in{" "}
                <strong className="text-[#ddd]">there</strong>. This pane mirrors it (check the taskbar if you don’t see it).
              </p>
              {lastSteps.length > 0 && (
                <ul className="mt-2 space-y-1 text-left text-[11px] text-[#a3a3a3]">
                  {lastSteps.map((s, i) => (
                    <li key={`${s.at}-${i}`}>
                      <span className="text-[#8664F2]">{s.kind}</span>: {s.message}
                    </li>
                  ))}
                </ul>
              )}
              {(err || pollErr) && <p className="text-[11px] text-red-400">{err || pollErr}</p>}
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 space-y-2 rounded-[8px] border border-[#E6E1F5] bg-[#FAFAFA] p-2.5 dark:border-[#2a2a2a] dark:bg-[#1a1a1a]">
        <div className="text-[11.5px] font-semibold uppercase tracking-wide text-[#8664F2]">
          {lab === "jwt" ? "JWT — decode / forge / probe" : "IDOR — victim target"}
        </div>
        {run && lab === "jwt" && (
          <>
            <p className="text-[11px] text-[#7E7E7E]">
              Sign in on <strong>Chromium</strong>. When Decode enables: Decode → Forge alg:none → Probe.
            </p>
            <div className="flex flex-wrap gap-1.5">
              <LabBtn onClick={() => act({ type: "jwt_decode" })} disabled={busy || !flags.token_captured}>
                Decode
              </LabBtn>
              <LabBtn onClick={() => act({ type: "jwt_forge", mode: "none" })} disabled={busy || !flags.token_captured}>
                Forge alg:none
              </LabBtn>
              <LabBtn onClick={() => act({ type: "jwt_probe" })} disabled={busy || !flags.forged} primary>
                Probe /auth/me
              </LabBtn>
            </div>
            {decoded && <JwtCards header={decoded.header} payload={decoded.payload} />}
            {forgedNote && (
              <div className="rounded-[6px] border border-[#A05DFF]/40 bg-[#A05DFF]/10 px-2.5 py-2 text-[11px] text-[#5B21B6] dark:text-[#E9D5FF]">
                {forgedNote}
              </div>
            )}
            {probeOut && (
              <div
                className={`rounded-[6px] border px-2.5 py-2 text-[11px] ${
                  probeOut.rejected
                    ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100"
                    : "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100"
                }`}
              >
                <div className="font-semibold">
                  Probe result: HTTP {probeOut.status}{" "}
                  {probeOut.rejected ? "— rejected (lean PASS)" : "— accepted (lean FAIL)"}
                </div>
                {probeOut.body && (
                  <pre className="mt-1 max-h-16 overflow-auto whitespace-pre-wrap font-mono text-[10px] opacity-80">{probeOut.body}</pre>
                )}
              </div>
            )}
          </>
        )}
        {run && lab === "idor" && (
          <>
            <p className="text-[11px] text-[#7E7E7E]">
              Sign in as <strong>User A</strong> on Chromium. Then load User B’s txns and open one — the live site navigates (watch the
              mirror).
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              <TinyField label="User B mobile" value={mobileB} onChange={setMobileB} />
              <TinyField label="User B password" value={passB} onChange={setPassB} type="password" />
            </div>
            <LabBtn
              onClick={() => act({ type: "idor_load_victim", mobileNumber: mobileB, password: passB })}
              disabled={busy || !flags.logged_in || !mobileB.trim() || !passB}
            >
              Load B’s transactions
            </LabBtn>
            {victimTxns.length > 0 && (
              <div className="max-h-28 space-y-1 overflow-y-auto">
                {victimTxns.map((t) => (
                  <button
                    key={t.transactionId}
                    type="button"
                    disabled={busy}
                    onClick={() => act({ type: "idor_open_in_browser", transactionId: t.transactionId })}
                    className="block w-full rounded border border-[#E5E7EB] bg-white px-2 py-1 text-left font-mono text-[11px] hover:border-[#8664F2] dark:border-[#2a2a2a] dark:bg-[#0a0a0a]"
                  >
                    Open in live browser: {t.label}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        {(err || pollErr) && <p className="text-[11px] text-red-600">{err || pollErr}</p>}
        <button type="button" onClick={stop} className="text-[11px] text-[#7E7E7E] underline">
          Back to plan
        </button>
      </div>
    </div>
  );
}

function JwtCards({ header, payload }: { header: Record<string, unknown>; payload: Record<string, unknown> }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="rounded-[8px] border border-[#E5E7EB] bg-white p-2 dark:border-[#2a2a2a] dark:bg-[#0a0a0a]">
        <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[#8664F2]">Header</div>
        <KvRows
          rows={Object.entries(header).map(([k, v]) => ({
            k,
            v: String(v),
            hot: k === "alg",
          }))}
        />
      </div>
      <div className="rounded-[8px] border border-[#E5E7EB] bg-white p-2 dark:border-[#2a2a2a] dark:bg-[#0a0a0a]">
        <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[#8664F2]">Payload</div>
        <KvRows rows={Object.entries(payload).map(([k, v]) => ({ k, v: formatClaim(v), hot: k === "sub" || k === "exp" }))} />
      </div>
    </div>
  );
}

function formatClaim(v: unknown): string {
  if (typeof v === "number" && v > 1_000_000_000 && v < 4_000_000_000) {
    try {
      return `${v} (${new Date(v * 1000).toISOString()})`;
    } catch {
      return String(v);
    }
  }
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function KvRows({ rows }: { rows: { k: string; v: string; hot?: boolean }[] }) {
  return (
    <dl className="max-h-28 space-y-1 overflow-auto">
      {rows.map((r) => (
        <div key={r.k} className="flex gap-2 text-[11px]">
          <dt className={`shrink-0 font-semibold ${r.hot ? "text-[#D97706]" : "text-[#7E7E7E]"}`}>{r.k}</dt>
          <dd className={`min-w-0 break-all font-mono ${r.hot ? "font-semibold text-[#1F1F1F] dark:text-[#ededed]" : "text-[#5E6066] dark:text-[#9ca3af]"}`}>
            {r.v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function TinyField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-[10.5px] text-[#7E7E7E]">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 w-full rounded border border-[#E5E7EB] bg-white px-2 py-1 text-[12px] dark:border-[#2a2a2a] dark:bg-[#0a0a0a]"
      />
    </label>
  );
}

function LabBtn({
  children,
  onClick,
  disabled,
  primary,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-[5px] border px-2.5 py-1 text-[11px] font-semibold disabled:opacity-40 ${
        primary
          ? "border-[#8664F2] bg-[#8664F2] text-white"
          : "border-[#E5E7EB] bg-white text-[#1F1F1F] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] dark:text-[#ededed]"
      }`}
    >
      {children}
    </button>
  );
}
