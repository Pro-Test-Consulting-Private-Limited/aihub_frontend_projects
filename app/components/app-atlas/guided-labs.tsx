"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { securityAgent, SecurityAgentError, type SecurityRun } from "@/app/services/security-agent";

type LabProps = {
  loginUrl: string;
  lab: "jwt" | "idor";
  onEvent: (event: string, detail?: string) => void;
  onClose: () => void;
};

/**
 * Human drives headed Chromium; this pane mirrors screenshots.
 * Step 1 only completes after the first live frame arrives.
 */
export function GuidedLiveLab({ loginUrl, lab, onEvent, onClose }: LabProps) {
  const [run, setRun] = useState<SecurityRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mobileB, setMobileB] = useState("");
  const [passB, setPassB] = useState("");
  const [decoded, setDecoded] = useState("");
  const [probeOut, setProbeOut] = useState("");
  const [pollErr, setPollErr] = useState<string | null>(null);
  const startedFlag = useRef(false);

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
  }, [flags, run?.screenshot, onEvent]);

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

  const start = async () => {
    setBusy(true);
    setErr(null);
    setPollErr(null);
    startedFlag.current = false;
    try {
      if (!loginUrl) throw new Error("Application URL required on the project.");
      const next = await securityAgent.startGuidedBrowser({ loginUrl, lab, headed: true });
      setRun(next);
    } catch (e) {
      setErr(e instanceof SecurityAgentError ? e.message : e instanceof Error ? e.message : "Start failed");
    } finally {
      setBusy(false);
    }
  };

  const act = async (body: Record<string, unknown>) => {
    if (!run) return;
    setBusy(true);
    setErr(null);
    try {
      const out = await securityAgent.guidedBrowserAction(run.id, body);
      if (out.run) setRun(out.run as SecurityRun);
      if (body.type === "jwt_decode" && out.header) {
        setDecoded(JSON.stringify({ header: out.header, payload: out.payload }, null, 2));
      }
      if (body.type === "jwt_probe") {
        setProbeOut(`HTTP ${out.status}\n${out.bodyPreview || ""}`);
      }
    } catch (e) {
      setErr(e instanceof SecurityAgentError ? e.message : e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const stop = useCallback(async () => {
    if (run?.id) {
      try {
        await securityAgent.guidedBrowserAction(run.id, { type: "stop" });
      } catch {
        /* ignore */
      }
    }
    onClose();
  }, [run?.id, onClose]);

  const victimTxns = run?.guided?.victimTxns || [];
  const lastSteps = (run?.steps || []).slice(-4);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[10px] border border-[#E6E1F5] bg-[#111] dark:border-[#2a2a2a]">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#333] bg-[#1a1a1a] px-3 py-1.5 text-[11.5px] text-[#ccc]">
          <span className="truncate font-mono">{run?.guided?.url || (run ? "Starting Chromium…" : "Not started")}</span>
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
              {!run && (
                <p>
                  Click <strong className="text-[#ddd]">Start live browser</strong>. A Chromium window opens —{" "}
                  <strong className="text-[#ddd]">sign in there</strong>. This pane mirrors that window.
                </p>
              )}
              {run && !run.screenshot && (
                <>
                  <p className="text-[#fbbf24]">Waiting for first live frame…</p>
                  <p>
                    Look for a <strong className="text-[#ddd]">Chromium</strong> window on the taskbar (it may be behind Cursor). Sign in
                    there once it opens.
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
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 space-y-2 rounded-[8px] border border-[#E6E1F5] bg-[#FAFAFA] p-2.5 dark:border-[#2a2a2a] dark:bg-[#1a1a1a]">
        <div className="text-[11.5px] font-semibold uppercase tracking-wide text-[#8664F2]">
          {lab === "jwt" ? "JWT — live site + forge tools" : "IDOR — live site + victim target"}
        </div>
        {!run && (
          <LabBtn onClick={start} disabled={busy} primary>
            {busy ? "Starting…" : "Start live browser"}
          </LabBtn>
        )}
        {run && lab === "jwt" && (
          <>
            <p className="text-[11px] text-[#7E7E7E]">
              Sign in on the <strong>Chromium</strong> window (not this panel). When the mirror shows dashboard and Decode enables, continue
              here.
            </p>
            <div className="flex flex-wrap gap-1.5">
              <LabBtn onClick={() => act({ type: "jwt_decode" })} disabled={busy || !flags.token_captured}>
                Decode
              </LabBtn>
              <LabBtn onClick={() => act({ type: "jwt_forge", mode: "none" })} disabled={busy || !flags.token_captured}>
                Forge alg:none
              </LabBtn>
              <LabBtn onClick={() => act({ type: "jwt_forge", mode: "claim" })} disabled={busy || !flags.token_captured}>
                Forge claim
              </LabBtn>
              <LabBtn onClick={() => act({ type: "jwt_probe" })} disabled={busy || !flags.forged} primary>
                Probe /auth/me
              </LabBtn>
            </div>
            {decoded && <pre className="max-h-24 overflow-auto rounded bg-[#0a0a0a] p-2 text-[10px] text-[#A7F3D0]">{decoded}</pre>}
            {probeOut && <pre className="max-h-20 overflow-auto rounded border p-2 text-[10px] dark:border-[#2a2a2a]">{probeOut}</pre>}
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
