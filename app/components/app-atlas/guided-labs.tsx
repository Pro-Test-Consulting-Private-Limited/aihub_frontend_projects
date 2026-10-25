"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { SessionSnapshot } from "@/app/interfaces/appatlas";
import { apiBaseFromAppUrl, appOrigin } from "@/app/lib/security-live-checks";
import { decodeJwt, forgeAlgNone, looksLikeJwt } from "@/app/lib/jwt-lab";
import { atlasUrl, type AtlasClient } from "@/app/services/appatlas";
import { securityAgent, SecurityAgentError } from "@/app/services/security-agent";

type LabProps = {
  loginUrl: string;
  lab: "jwt" | "idor";
  client: AtlasClient;
  onEvent: (event: string, detail?: string) => void;
  onClose: () => void;
  onOutcome?: (pass: boolean, detail: string) => void;
};

type TxnRow = { transactionId: string; label: string };

/**
 * Guided JWT/IDOR using the same App Atlas remote browser as Canvas —
 * interact in the center pane (no Chromium window on your laptop).
 */
export function GuidedLiveLab({ loginUrl, lab, client, onEvent, onClose, onOutcome }: LabProps) {
  const [snap, setSnap] = useState<SessionSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [forged, setForged] = useState("");
  const [decoded, setDecoded] = useState<{ header: Record<string, unknown>; payload: Record<string, unknown> } | null>(null);
  const [probeOut, setProbeOut] = useState<{ status?: number; body?: string; rejected?: boolean } | null>(null);
  const [forgedNote, setForgedNote] = useState<string | null>(null);
  const [mobileB, setMobileB] = useState("");
  const [passB, setPassB] = useState("");
  const [txns, setTxns] = useState<TxnRow[]>([]);
  const startedFlag = useRef(false);
  const autoStarted = useRef(false);
  const outcomeSent = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const seen = useRef<Set<string>>(new Set());

  const mark = useCallback(
    (event: string, detail?: string) => {
      if (seen.current.has(event)) return;
      seen.current.add(event);
      onEvent(event, detail);
    },
    [onEvent],
  );

  const discardRemote = useCallback(async () => {
    const id = sessionIdRef.current;
    sessionIdRef.current = null;
    if (!id) return;
    try {
      await client.discardSession(id);
    } catch {
      /* ignore */
    }
  }, [client]);

  useEffect(() => {
    return () => {
      void discardRemote();
    };
  }, [discardRemote]);

  const applyPageState = useCallback(
    (state: { url: string; token: string; bodyText: string }) => {
      if (state.token && looksLikeJwt(state.token)) {
        setToken(state.token);
        mark("token_captured");
      }
      const path = (() => {
        try {
          return new URL(state.url).pathname;
        } catch {
          return "";
        }
      })();
      const loggedIn =
        Boolean(state.token) || /\/(dashboard|wallet|transactions|profile|kyc|send-money|add-money)/i.test(path);
      if (loggedIn) mark("logged_in");
      const forbidden =
        /not your transaction/i.test(state.bodyText) ||
        /forbidden/i.test(state.bodyText) ||
        /access denied/i.test(state.bodyText);
      const txnDetail = /\/transactions\/[^/]+/i.test(path);
      const hasDetail = txnDetail && /ledger|amount|counterparty|transaction/i.test(state.bodyText);
      if (txnDetail) mark("idor_navigated");
      if (forbidden) {
        mark("idor_result");
        mark("verdict_ready");
        if (!outcomeSent.current && onOutcome) {
          outcomeSent.current = true;
          onOutcome(true, "Live site blocked other user’s txn");
        }
      } else if (hasDetail && lab === "idor") {
        mark("idor_result");
        mark("verdict_ready");
        if (!outcomeSent.current && onOutcome) {
          outcomeSent.current = true;
          onOutcome(false, "Live site showed other user’s txn");
        }
      }
    },
    [lab, mark, onOutcome],
  );

  const start = useCallback(async () => {
    setBusy(true);
    setErr(null);
    seen.current = new Set();
    outcomeSent.current = false;
    try {
      if (!loginUrl) throw new Error("Application URL required on the project.");
      const viewer = typeof window !== "undefined" && localStorage.getItem("appatlas-viewer") === "vnc" ? "vnc" : "auto";
      const next = await client.startSession({
        url: loginUrl,
        devicePreset: "desktop",
        networkPreset: "none",
        viewer,
      });
      sessionIdRef.current = next.id;
      setSnap(next);
      mark("browser_started");
      startedFlag.current = true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not start remote browser");
    } finally {
      setBusy(false);
    }
  }, [client, loginUrl, mark]);

  useEffect(() => {
    if (autoStarted.current || !loginUrl) return;
    autoStarted.current = true;
    void start();
  }, [loginUrl, start]);

  // Poll page state from the remote browser (URL / token / text).
  useEffect(() => {
    if (!snap?.id || snap.status !== "recording") return;
    let cancelled = false;
    const tick = async () => {
      try {
        const [fresh, state] = await Promise.all([client.getSession(snap.id), client.sessionPageState(snap.id)]);
        if (cancelled) return;
        setSnap(fresh);
        applyPageState(state);
      } catch {
        /* brief blip while navigating */
      }
    };
    tick();
    const t = setInterval(tick, 1200);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [snap?.id, snap?.status, client, applyPageState]);

  const decode = () => {
    setErr(null);
    try {
      const t = token;
      if (!looksLikeJwt(t)) throw new Error("No session token yet — sign in in the center pane first.");
      const d = decodeJwt(t);
      setDecoded({ header: d.header, payload: d.payload });
      mark("decoded", `alg=${String(d.header.alg)}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Decode failed");
    }
  };

  const forge = () => {
    setErr(null);
    try {
      if (!looksLikeJwt(token)) throw new Error("No token yet.");
      setForged(forgeAlgNone(token));
      setForgedNote("Forged alg:none token ready — signature emptied. Next: Probe.");
      mark("forged", "alg:none");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Forge failed");
    }
  };

  const probe = async () => {
    setBusy(true);
    setErr(null);
    mark("probed");
    try {
      const apiBase = apiBaseFromAppUrl(loginUrl);
      if (!apiBase) throw new Error("Application URL missing.");
      if (!forged) throw new Error("Forge a token first.");
      const res = await securityAgent.httpProbe({ url: `${apiBase}/auth/me`, authorization: forged });
      const rejected = res.status === 401 || res.status === 403;
      setProbeOut({ status: res.status, body: res.bodyPreview, rejected });
      mark("verdict_ready");
      if (!outcomeSent.current && onOutcome) {
        outcomeSent.current = true;
        onOutcome(rejected, rejected ? "Forged JWT rejected by API" : "Forged JWT was accepted");
      }
    } catch (e) {
      setErr(e instanceof SecurityAgentError ? e.message : e instanceof Error ? e.message : "Probe failed");
    } finally {
      setBusy(false);
    }
  };

  const loadBTxns = async () => {
    setBusy(true);
    setErr(null);
    try {
      const apiBase = apiBaseFromAppUrl(loginUrl);
      if (!apiBase) throw new Error("Application URL missing.");
      const loginRes = await securityAgent.httpProbe({
        url: `${apiBase}/auth/login`,
        method: "POST",
        jsonBody: { mobileNumber: mobileB.trim(), password: passB },
      });
      const bToken = (loginRes.body as { token?: string } | null)?.token;
      if (loginRes.status >= 400 || !bToken) throw new Error(loginRes.bodyPreview || "User B login failed");
      const listRes = await securityAgent.httpProbe({ url: `${apiBase}/transactions`, authorization: bToken });
      if (listRes.status >= 400) throw new Error(listRes.bodyPreview || "Could not list B’s transactions");
      const raw = listRes.body as { data?: Record<string, unknown>[] } | null;
      const rows = (Array.isArray(raw?.data) ? raw!.data : [])
        .map((r) => {
          const id = String(r.transactionId || r.id || "");
          if (!id) return null;
          return {
            transactionId: id,
            label: `${id.slice(0, 8)}… ${r.type || ""} ${r.amount ?? ""}`.trim(),
          };
        })
        .filter(Boolean) as TxnRow[];
      if (!rows.length) throw new Error("User B has no transactions yet.");
      setTxns(rows);
      mark("victim_loaded", `${rows.length} txn(s)`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Load failed");
    } finally {
      setBusy(false);
    }
  };

  const openTxnInRemote = async (transactionId: string) => {
    if (!snap?.id) return;
    setBusy(true);
    setErr(null);
    try {
      const origin = appOrigin(loginUrl);
      const state = await client.sessionGoto(snap.id, `${origin}/transactions/${encodeURIComponent(transactionId)}`);
      applyPageState(state);
      mark("idor_navigated");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Navigate failed");
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    await discardRemote();
    onClose();
  };

  const viewer = snap?.viewer;
  const SCREEN_RATIO: Record<string, number> = { neko: 16 / 9, vnc: 16 / 10 };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[10px] border border-[#E6E1F5] bg-[#111] dark:border-[#2a2a2a]">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#333] bg-[#1a1a1a] px-3 py-1.5 text-[11.5px] text-[#ccc]">
          <span className="truncate font-mono">
            {snap?.currentUrl || snap?.startUrl || (busy ? "Starting remote browser…" : "Preparing…")}
          </span>
          {snap && (
            <button type="button" onClick={() => void stop()} className="shrink-0 text-[#f87171] underline">
              Stop browser
            </button>
          )}
        </div>
        <div className="flex min-h-[420px] flex-1 items-center justify-center bg-[#0a0a0a] p-2">
          {viewer && viewer.kind !== "local" ? (
            <iframe
              src={atlasUrl(viewer.url)}
              allow="autoplay; clipboard-read; clipboard-write; fullscreen"
              className="h-full max-h-full w-full rounded-[8px] border border-[#333] bg-black"
              style={{ aspectRatio: SCREEN_RATIO[viewer.kind] ?? 16 / 9 }}
              title="Remote browser — interact here"
            />
          ) : viewer?.kind === "local" ? (
            <div className="max-w-md p-6 text-center text-[13px] text-[#9ca3af]">
              Backend is in local provider mode (Chromium on the server). Prefer VNC/neko so the browser appears in this pane like Canvas.
            </div>
          ) : (
            <div className="max-w-md space-y-2 p-6 text-center text-[13px] text-[#9ca3af]">
              <p className="text-[#fbbf24]">{busy ? "Starting remote browser…" : "Waiting for browser…"}</p>
              <p>Same live browser as Canvas — sign in and browse in this pane.</p>
              {err && <p className="text-red-400">{err}</p>}
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 space-y-2 rounded-[8px] border border-[#E6E1F5] bg-[#FAFAFA] p-2.5 dark:border-[#2a2a2a] dark:bg-[#1a1a1a]">
        <div className="text-[11.5px] font-semibold uppercase tracking-wide text-[#8664F2]">
          {lab === "jwt" ? "JWT — decode / forge / probe" : "IDOR — victim target"}
        </div>
        {lab === "jwt" && (
          <>
            <p className="text-[11px] text-[#7E7E7E]">
              Sign in in the <strong>center pane</strong>. When Decode enables: Decode → Forge alg:none → Probe.
            </p>
            <div className="flex flex-wrap gap-1.5">
              <LabBtn onClick={decode} disabled={busy || !looksLikeJwt(token)}>
                Decode
              </LabBtn>
              <LabBtn onClick={forge} disabled={busy || !looksLikeJwt(token)}>
                Forge alg:none
              </LabBtn>
              <LabBtn onClick={() => void probe()} disabled={busy || !forged} primary>
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
        {lab === "idor" && (
          <>
            <p className="text-[11px] text-[#7E7E7E]">
              Sign in as <strong>User A</strong> in the center pane. Load User B’s txns, then open one — the remote browser navigates
              there.
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              <TinyField label="User B mobile" value={mobileB} onChange={setMobileB} />
              <TinyField label="User B password" value={passB} onChange={setPassB} type="password" />
            </div>
            <LabBtn onClick={() => void loadBTxns()} disabled={busy || !mobileB.trim() || !passB || !looksLikeJwt(token)}>
              Load B’s transactions
            </LabBtn>
            {txns.length > 0 && (
              <div className="max-h-28 space-y-1 overflow-y-auto">
                {txns.map((t) => (
                  <button
                    key={t.transactionId}
                    type="button"
                    disabled={busy}
                    onClick={() => void openTxnInRemote(t.transactionId)}
                    className="block w-full rounded border border-[#E5E7EB] bg-white px-2 py-1 text-left font-mono text-[11px] hover:border-[#8664F2] dark:border-[#2a2a2a] dark:bg-[#0a0a0a]"
                  >
                    Open in center browser: {t.label}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        {err && <p className="text-[11px] text-red-600">{err}</p>}
        <button type="button" onClick={() => void stop()} className="text-[11px] text-[#7E7E7E] underline">
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
        <KvRows rows={Object.entries(header).map(([k, v]) => ({ k, v: String(v), hot: k === "alg" }))} />
      </div>
      <div className="rounded-[8px] border border-[#E5E7EB] bg-white p-2 dark:border-[#2a2a2a] dark:bg-[#0a0a0a]">
        <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[#8664F2]">Payload</div>
        <KvRows
          rows={Object.entries(payload).map(([k, v]) => ({
            k,
            v: formatClaim(v),
            hot: k === "sub" || k === "exp",
          }))}
        />
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
          <dd
            className={`min-w-0 break-all font-mono ${r.hot ? "font-semibold text-[#1F1F1F] dark:text-[#ededed]" : "text-[#5E6066] dark:text-[#9ca3af]"}`}
          >
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
