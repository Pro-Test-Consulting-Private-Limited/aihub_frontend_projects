"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { apiBaseFromAppUrl, appOrigin } from "@/app/lib/security-live-checks";
import { decodeJwt, forgeAlgNone, forgeTamperedClaim, looksLikeJwt } from "@/app/lib/jwt-lab";
import { securityAgent, SecurityAgentError } from "@/app/services/security-agent";

type LabProps = {
  loginUrl: string;
  /** Fire autoOn event names from the guided procedure — parent marks steps Done. */
  onEvent: (event: string, detail?: string) => void;
  /** Let parent navigate the iframe (IDOR open-in-frame). */
  onNavigateFrame?: (url: string) => void;
};

export function JwtLab({ loginUrl, onEvent }: LabProps) {
  const [token, setToken] = useState("");
  const [forged, setForged] = useState("");
  const [decoded, setDecoded] = useState<string>("");
  const [probeOut, setProbeOut] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const apiBase = apiBaseFromAppUrl(loginUrl);

  useEffect(() => {
    onEvent("logged_in_hint");
  }, [onEvent]);

  useEffect(() => {
    if (looksLikeJwt(token)) onEvent("token_pasted");
  }, [token, onEvent]);

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
      const f = forgeAlgNone(token);
      setForged(f);
      onEvent("forged", "alg:none");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Forge failed");
    }
  };

  const forgeClaim = () => {
    setErr(null);
    try {
      const f = forgeTamperedClaim(token);
      setForged(f);
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
      if (!apiBase) throw new Error("Application URL missing — cannot build API base.");
      if (!forged.trim()) throw new Error("Forge a token first.");
      const url = `${apiBase}/auth/me`;
      const res = await securityAgent.httpProbe({ url, authorization: forged.trim() });
      const line = `HTTP ${res.status} ${res.statusText}\n${res.bodyPreview || "(empty)"}`;
      setProbeOut(line);
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
      <div className="text-[11.5px] font-semibold uppercase tracking-wide text-[#8664F2]">JWT lab — actions update steps</div>
      <p className="text-[11px] text-[#7E7E7E]">
        After login, paste Local Storage <code className="text-[10px]">token</code>. Decode → Forge → Probe{" "}
        <code className="text-[10px]">/auth/me</code>.
      </p>
      <label className="block text-[11px] text-[#7E7E7E]">
        Session JWT
        <textarea
          value={token}
          onChange={(e) => setToken(e.target.value.trim())}
          rows={3}
          placeholder="eyJhbGciOi…"
          className="mt-1 w-full rounded-[6px] border border-[#E5E7EB] bg-white px-2 py-1.5 font-mono text-[11px] dark:border-[#2a2a2a] dark:bg-[#0a0a0a]"
        />
      </label>
      <div className="flex flex-wrap gap-1.5">
        <LabBtn onClick={decode} disabled={!looksLikeJwt(token)}>
          Decode
        </LabBtn>
        <LabBtn onClick={forgeNone} disabled={!looksLikeJwt(token)}>
          Forge alg:none
        </LabBtn>
        <LabBtn onClick={forgeClaim} disabled={!looksLikeJwt(token)}>
          Forge claim
        </LabBtn>
        <LabBtn onClick={probe} disabled={busy || !forged} primary>
          {busy ? "Probing…" : "Probe API"}
        </LabBtn>
      </div>
      {decoded && (
        <pre className="max-h-28 overflow-auto rounded-[6px] bg-[#0a0a0a] p-2 text-[10px] text-[#A7F3D0]">{decoded}</pre>
      )}
      {forged && (
        <label className="block text-[11px] text-[#7E7E7E]">
          Forged token
          <textarea
            readOnly
            value={forged}
            rows={2}
            className="mt-1 w-full rounded-[6px] border border-[#E5E7EB] bg-white px-2 py-1.5 font-mono text-[11px] dark:border-[#2a2a2a] dark:bg-[#0a0a0a]"
          />
        </label>
      )}
      {probeOut && (
        <pre className="max-h-24 overflow-auto rounded-[6px] border border-[#E5E7EB] bg-white p-2 text-[10px] text-[#1F1F1F] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] dark:text-[#ededed]">
          {probeOut}
        </pre>
      )}
      {err && <p className="text-[11px] text-red-600">{err}</p>}
    </div>
  );
}

export function IdorLab({ loginUrl, onEvent, onNavigateFrame }: LabProps) {
  const [token, setToken] = useState("");
  const [objectId, setObjectId] = useState("");
  const [probeOut, setProbeOut] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const apiBase = apiBaseFromAppUrl(loginUrl);
  const origin = appOrigin(loginUrl);

  useEffect(() => {
    onEvent("logged_in_hint");
  }, [onEvent]);

  useEffect(() => {
    if (looksLikeJwt(token)) onEvent("token_pasted");
  }, [token, onEvent]);

  useEffect(() => {
    if (objectId.trim().length >= 4) onEvent("object_id_set");
  }, [objectId, onEvent]);

  const openFrame = () => {
    if (!origin || !objectId.trim()) return;
    const url = `${origin}/transactions/${encodeURIComponent(objectId.trim())}`;
    onNavigateFrame?.(url);
    onEvent("frame_opened", url);
  };

  const probe = async () => {
    setBusy(true);
    setErr(null);
    setProbeOut("");
    onEvent("probed");
    try {
      if (!apiBase) throw new Error("Application URL missing.");
      if (!looksLikeJwt(token)) throw new Error("Paste User A’s JWT first.");
      if (!objectId.trim()) throw new Error("Enter another user’s transaction id.");
      const url = `${apiBase}/transactions/${encodeURIComponent(objectId.trim())}`;
      const res = await securityAgent.httpProbe({ url, authorization: token.trim() });
      const line = `HTTP ${res.status} ${res.statusText}\n${res.bodyPreview || "(empty)"}`;
      setProbeOut(line);
      const blocked = res.status === 401 || res.status === 403 || res.status === 404;
      onEvent("verdict_ready", blocked ? "blocked → lean PASS" : "data returned → lean FAIL");
    } catch (e) {
      setErr(e instanceof SecurityAgentError ? e.message : e instanceof Error ? e.message : "Probe failed");
    } finally {
      setBusy(false);
    }
  };

  const hint = useMemo(() => "Use a transaction id from User B’s History (second login).", []);

  return (
    <div className="space-y-2 rounded-[8px] border border-[#E6E1F5] bg-[#FAFAFA] p-2.5 dark:border-[#2a2a2a] dark:bg-[#1a1a1a]">
      <div className="text-[11.5px] font-semibold uppercase tracking-wide text-[#8664F2]">IDOR lab — actions update steps</div>
      <p className="text-[11px] text-[#7E7E7E]">{hint}</p>
      <label className="block text-[11px] text-[#7E7E7E]">
        User A JWT
        <textarea
          value={token}
          onChange={(e) => setToken(e.target.value.trim())}
          rows={2}
          placeholder="eyJhbGciOi…"
          className="mt-1 w-full rounded-[6px] border border-[#E5E7EB] bg-white px-2 py-1.5 font-mono text-[11px] dark:border-[#2a2a2a] dark:bg-[#0a0a0a]"
        />
      </label>
      <label className="block text-[11px] text-[#7E7E7E]">
        Other user’s transaction id
        <input
          value={objectId}
          onChange={(e) => setObjectId(e.target.value.trim())}
          placeholder="transactionId from User B"
          className="mt-1 w-full rounded-[6px] border border-[#E5E7EB] bg-white px-2 py-1.5 font-mono text-[12px] dark:border-[#2a2a2a] dark:bg-[#0a0a0a]"
        />
      </label>
      <div className="flex flex-wrap gap-1.5">
        <LabBtn onClick={openFrame} disabled={!objectId.trim() || !origin}>
          Open in app frame
        </LabBtn>
        <LabBtn onClick={probe} disabled={busy || !objectId.trim() || !looksLikeJwt(token)} primary>
          {busy ? "Probing…" : "Probe API"}
        </LabBtn>
      </div>
      {probeOut && (
        <pre className="max-h-28 overflow-auto rounded-[6px] border border-[#E5E7EB] bg-white p-2 text-[10px] text-[#1F1F1F] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] dark:text-[#ededed]">
          {probeOut}
        </pre>
      )}
      {err && <p className="text-[11px] text-red-600">{err}</p>}
    </div>
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
