"use client";

import { useState, type ReactNode } from "react";
import { apiBaseFromAppUrl } from "@/app/lib/security-live-checks";
import { decodeJwt, forgeAlgNone, forgeTamperedClaim, looksLikeJwt } from "@/app/lib/jwt-lab";
import { securityAgent, SecurityAgentError } from "@/app/services/security-agent";

type LabProps = {
  loginUrl: string;
  /** Fire autoOn event names from the guided procedure — parent marks steps Done. */
  onEvent: (event: string, detail?: string) => void;
};

type TxnRow = { transactionId: string; label: string };

async function demoLogin(apiBase: string, mobile: string, password: string) {
  const res = await securityAgent.httpProbe({
    url: `${apiBase}/auth/login`,
    method: "POST",
    jsonBody: { mobileNumber: mobile.trim(), password },
  });
  const token = (res.body as { token?: string } | null)?.token;
  if (res.status >= 400 || !token) {
    throw new Error(res.bodyPreview || `Login failed (HTTP ${res.status})`);
  }
  return token;
}

/** All actions stay inside App Atlas — no DevTools, no second browser. */
export function JwtLab({ loginUrl, onEvent }: LabProps) {
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [forged, setForged] = useState("");
  const [decoded, setDecoded] = useState("");
  const [probeOut, setProbeOut] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const apiBase = apiBaseFromAppUrl(loginUrl);

  const signIn = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (!apiBase) throw new Error("Application URL missing on the project.");
      if (!mobile.trim() || !password) throw new Error("Enter demo mobile and password.");
      const t = await demoLogin(apiBase, mobile, password);
      setToken(t);
      onEvent("lab_signed_in", "session token obtained in-lab");
      onEvent("token_ready");
    } catch (e) {
      setErr(e instanceof SecurityAgentError ? e.message : e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  const decode = () => {
    setErr(null);
    try {
      const d = decodeJwt(token);
      setDecoded(JSON.stringify({ header: d.header, payload: d.payload }, null, 2));
      onEvent("decoded", `alg=${String(d.header.alg)}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Decode failed");
    }
  };

  const forgeNone = () => {
    setErr(null);
    try {
      setForged(forgeAlgNone(token));
      onEvent("forged", "alg:none");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Forge failed");
    }
  };

  const forgeClaim = () => {
    setErr(null);
    try {
      setForged(forgeTamperedClaim(token));
      onEvent("forged", "tampered claim");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Forge failed");
    }
  };

  const probe = async () => {
    setBusy(true);
    setErr(null);
    setProbeOut("");
    onEvent("probed");
    try {
      if (!apiBase) throw new Error("Application URL missing.");
      if (!forged.trim()) throw new Error("Forge a token first.");
      const res = await securityAgent.httpProbe({
        url: `${apiBase}/auth/me`,
        authorization: forged.trim(),
      });
      setProbeOut(`HTTP ${res.status} ${res.statusText}\n${res.bodyPreview || "(empty)"}`);
      const rejected = res.status === 401 || res.status === 403;
      onEvent("verdict_ready", rejected ? "rejected → lean PASS" : "accepted → lean FAIL");
    } catch (e) {
      setErr(e instanceof SecurityAgentError ? e.message : e instanceof Error ? e.message : "Probe failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-[8px] border border-[#E6E1F5] bg-[#FAFAFA] p-2.5 dark:border-[#2a2a2a] dark:bg-[#1a1a1a]">
      <div className="text-[11.5px] font-semibold uppercase tracking-wide text-[#8664F2]">JWT lab — all inside App Atlas</div>
      <p className="text-[11px] text-[#7E7E7E]">
        Sign in here (no DevTools). Then Decode → Forge → Probe. Steps tick only when you click.
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        <Field label="Demo mobile" value={mobile} onChange={setMobile} placeholder="10-digit mobile" />
        <Field label="Password" value={password} onChange={setPassword} placeholder="password" type="password" />
      </div>
      <LabBtn onClick={signIn} disabled={busy || !mobile.trim() || !password} primary>
        {busy && !forged ? "Signing in…" : "1. Sign in (get token)"}
      </LabBtn>
      {looksLikeJwt(token) && (
        <p className="truncate font-mono text-[10px] text-[#16A34A]">Token ready ({token.slice(0, 24)}…)</p>
      )}
      <div className="flex flex-wrap gap-1.5">
        <LabBtn onClick={decode} disabled={!looksLikeJwt(token)}>
          2. Decode
        </LabBtn>
        <LabBtn onClick={forgeNone} disabled={!looksLikeJwt(token)}>
          3. Forge alg:none
        </LabBtn>
        <LabBtn onClick={forgeClaim} disabled={!looksLikeJwt(token)}>
          3. Forge claim
        </LabBtn>
        <LabBtn onClick={probe} disabled={busy || !forged} primary>
          {busy && forged ? "Probing…" : "4. Probe /auth/me"}
        </LabBtn>
      </div>
      {decoded && <pre className="max-h-28 overflow-auto rounded-[6px] bg-[#0a0a0a] p-2 text-[10px] text-[#A7F3D0]">{decoded}</pre>}
      {forged && (
        <p className="truncate font-mono text-[10px] text-[#7E7E7E]">Forged: {forged.slice(0, 40)}…</p>
      )}
      {probeOut && (
        <pre className="max-h-24 overflow-auto rounded-[6px] border border-[#E5E7EB] bg-white p-2 text-[10px] dark:border-[#2a2a2a] dark:bg-[#0a0a0a]">
          {probeOut}
        </pre>
      )}
      {err && <p className="text-[11px] text-red-600">{err}</p>}
    </div>
  );
}

/** Dual account login + pick B’s txn + probe as A — fully in this panel. */
export function IdorLab({ loginUrl, onEvent }: LabProps) {
  const [mobileA, setMobileA] = useState("");
  const [passA, setPassA] = useState("");
  const [mobileB, setMobileB] = useState("");
  const [passB, setPassB] = useState("");
  const [tokenA, setTokenA] = useState("");
  const [tokenB, setTokenB] = useState("");
  const [txns, setTxns] = useState<TxnRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [probeOut, setProbeOut] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const apiBase = apiBaseFromAppUrl(loginUrl);

  const signInA = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (!apiBase) throw new Error("Application URL missing.");
      const t = await demoLogin(apiBase, mobileA, passA);
      setTokenA(t);
      onEvent("user_a_signed_in");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "User A sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  const signInB = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (!apiBase) throw new Error("Application URL missing.");
      const t = await demoLogin(apiBase, mobileB, passB);
      setTokenB(t);
      onEvent("user_b_signed_in");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "User B sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  const loadBTxns = async () => {
    setBusy(true);
    setErr(null);
    setTxns([]);
    setSelectedId("");
    try {
      if (!apiBase) throw new Error("Application URL missing.");
      if (!tokenB) throw new Error("Sign in User B first.");
      const res = await securityAgent.httpProbe({
        url: `${apiBase}/transactions`,
        authorization: tokenB,
      });
      if (res.status >= 400) throw new Error(res.bodyPreview || `List failed (HTTP ${res.status})`);
      const raw = res.body as { items?: unknown[]; data?: unknown[]; transactions?: unknown[] } | unknown[] | null;
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.items)
          ? raw.items
          : Array.isArray(raw?.data)
            ? raw.data
            : Array.isArray(raw?.transactions)
              ? raw.transactions
              : [];
      const rows: TxnRow[] = list
        .map((row) => {
          const r = row as Record<string, unknown>;
          const id = String(r.transactionId || r.id || "");
          if (!id) return null;
          const amt = r.amount != null ? ` · ${r.amount}` : "";
          const typ = r.type != null ? String(r.type) : r.description != null ? String(r.description) : "txn";
          return { transactionId: id, label: `${id.slice(0, 8)}… ${typ}${amt}` };
        })
        .filter(Boolean) as TxnRow[];
      if (!rows.length) throw new Error("User B has no transactions yet — add money / send once on the demo, then retry.");
      setTxns(rows);
      onEvent("b_txns_loaded", `${rows.length} txn(s)`);
    } catch (e) {
      setErr(e instanceof SecurityAgentError ? e.message : e instanceof Error ? e.message : "Load failed");
    } finally {
      setBusy(false);
    }
  };

  const pickTxn = (id: string) => {
    setSelectedId(id);
    onEvent("object_id_set", id);
  };

  const probe = async () => {
    setBusy(true);
    setErr(null);
    setProbeOut("");
    onEvent("probed");
    try {
      if (!apiBase) throw new Error("Application URL missing.");
      if (!tokenA) throw new Error("Sign in User A first.");
      if (!selectedId) throw new Error("Pick one of User B’s transactions.");
      const res = await securityAgent.httpProbe({
        url: `${apiBase}/transactions/${encodeURIComponent(selectedId)}`,
        authorization: tokenA,
      });
      setProbeOut(`HTTP ${res.status} ${res.statusText}\n${res.bodyPreview || "(empty)"}`);
      const blocked = res.status === 401 || res.status === 403 || res.status === 404;
      onEvent("verdict_ready", blocked ? "blocked → lean PASS" : "data returned → lean FAIL");
    } catch (e) {
      setErr(e instanceof SecurityAgentError ? e.message : e instanceof Error ? e.message : "Probe failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-[8px] border border-[#E6E1F5] bg-[#FAFAFA] p-2.5 dark:border-[#2a2a2a] dark:bg-[#1a1a1a]">
      <div className="text-[11.5px] font-semibold uppercase tracking-wide text-[#8664F2]">IDOR lab — all inside App Atlas</div>
      <p className="text-[11px] text-[#7E7E7E]">
        Sign in User A and User B here. Load B’s transactions, pick one, probe as A. No second window.
      </p>

      <div className="rounded-[6px] border border-[#E5E7EB] p-2 dark:border-[#2a2a2a]">
        <div className="mb-1 text-[11px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">User A (attacker session)</div>
        <div className="grid grid-cols-2 gap-1.5">
          <Field label="Mobile" value={mobileA} onChange={setMobileA} />
          <Field label="Password" value={passA} onChange={setPassA} type="password" />
        </div>
        <div className="mt-1.5">
          <LabBtn onClick={signInA} disabled={busy || !mobileA.trim() || !passA} primary>
            {tokenA ? "A signed in ✓" : "Sign in A"}
          </LabBtn>
        </div>
      </div>

      <div className="rounded-[6px] border border-[#E5E7EB] p-2 dark:border-[#2a2a2a]">
        <div className="mb-1 text-[11px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">User B (victim — has a transaction)</div>
        <div className="grid grid-cols-2 gap-1.5">
          <Field label="Mobile" value={mobileB} onChange={setMobileB} />
          <Field label="Password" value={passB} onChange={setPassB} type="password" />
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <LabBtn onClick={signInB} disabled={busy || !mobileB.trim() || !passB} primary>
            {tokenB ? "B signed in ✓" : "Sign in B"}
          </LabBtn>
          <LabBtn onClick={loadBTxns} disabled={busy || !tokenB}>
            Load B’s transactions
          </LabBtn>
        </div>
      </div>

      {txns.length > 0 && (
        <div className="space-y-1">
          <div className="text-[11px] text-[#7E7E7E]">Pick B’s transaction id:</div>
          <div className="flex max-h-28 flex-col gap-1 overflow-y-auto">
            {txns.map((t) => (
              <button
                key={t.transactionId}
                type="button"
                onClick={() => pickTxn(t.transactionId)}
                className={`rounded-[5px] border px-2 py-1 text-left font-mono text-[11px] ${
                  selectedId === t.transactionId
                    ? "border-[#8664F2] bg-[#F3EEFF] text-[#8664F2]"
                    : "border-[#E5E7EB] bg-white dark:border-[#2a2a2a] dark:bg-[#0a0a0a]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <LabBtn onClick={probe} disabled={busy || !tokenA || !selectedId} primary>
        {busy ? "Probing…" : "Probe this id as User A"}
      </LabBtn>
      {probeOut && (
        <pre className="max-h-28 overflow-auto rounded-[6px] border border-[#E5E7EB] bg-white p-2 text-[10px] dark:border-[#2a2a2a] dark:bg-[#0a0a0a]">
          {probeOut}
        </pre>
      )}
      {err && <p className="text-[11px] text-red-600">{err}</p>}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block text-[10.5px] text-[#7E7E7E]">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-0.5 w-full rounded-[5px] border border-[#E5E7EB] bg-white px-2 py-1 text-[12px] text-[#1F1F1F] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] dark:text-[#ededed]"
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
