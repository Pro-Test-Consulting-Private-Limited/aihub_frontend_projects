"use client";

import { useEffect, useState } from "react";
import type { SessionSnapshot } from "@/app/interfaces/appatlas";
import type { AtlasClient } from "@/app/services/appatlas";

const MODES: { id: string; label: string }[] = [
  { id: "fail-500", label: "Fail with 500" },
  { id: "return-404", label: "Return 404" },
  { id: "timeout", label: "Time out" },
  { id: "slow-5s", label: "Slow 5 s" },
  { id: "return-empty", label: "Return empty" },
  { id: "offline", label: "Go offline" },
];

export function WhatIfPanel({
  client,
  sessionId,
  simulate,
}: {
  client: AtlasClient;
  sessionId: string;
  simulate: NonNullable<SessionSnapshot["simulate"]>;
}) {
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
  }, [simulate.armed?.id, simulate.observed.length]);

  if (simulate.locked) {
    return (
      <div className="rounded-[8px] border border-[#FDE68A] bg-[#FFFBEB] p-3 text-[11px] text-[#92400E] dark:border-[#78350f] dark:bg-[#1c1408] dark:text-[#FBBF24]">
        What if? locked — environment is <strong>{simulate.environment}</strong>. Simulation is only
        allowed for dev, test, or staging.
      </div>
    );
  }
  if (!simulate.enabled) return null;

  const arm = async (method: string, path: string, mode: string) => {
    setBusy(`${method} ${path} ${mode}`);
    setError(null);
    try {
      await client.armSimulate(sessionId, { method, path, mode });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Arm failed");
    } finally {
      setBusy(null);
    }
  };

  const disarm = async () => {
    setBusy("disarm");
    try {
      await client.disarmSimulate(sessionId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Disarm failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-[8px] border border-[#EEE] bg-white text-[11px] dark:border-[#2a2a2a] dark:bg-[#141414]">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2 font-medium text-[#1F1F1F] dark:text-[#ededed]"
        onClick={() => setOpen((o) => !o)}
      >
        <span>What if?</span>
        <span className="text-[#9ca3af]">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="border-t border-[#EEE] px-3 py-2 dark:border-[#2a2a2a]">
          {simulate.armed && (
            <div className="mb-2 flex items-center gap-2 rounded-[6px] bg-[#FEF3C7] px-2 py-1 text-[#92400E] dark:bg-[#3b2f14] dark:text-[#FBBF24]">
              <span className="font-semibold">Armed</span>
              <span className="truncate">
                {simulate.armed.mode} · {simulate.armed.method} {simulate.armed.path}
              </span>
              <button type="button" className="ml-auto underline" onClick={() => void disarm()} disabled={!!busy}>
                Cancel
              </button>
            </div>
          )}
          {error && <div className="mb-2 text-[#B45309]">{error}</div>}
          {simulate.observed.length === 0 && (
            <div className="text-[#9ca3af]">API calls (fetch/XHR) will appear here as you use the app.</div>
          )}
          <ul className="max-h-[220px] space-y-2 overflow-y-auto">
            {simulate.observed.map((o) => (
              <li key={`${o.method} ${o.path}`} className="rounded-[6px] bg-[#F9FAFC] p-2 dark:bg-[#0a0a0a]">
                <div className="flex items-center gap-2 font-medium text-[#1F1F1F] dark:text-[#ededed]">
                  <span className="text-[#8664F2]">{o.method}</span>
                  <span className="truncate" title={o.path}>
                    {o.path}
                  </span>
                  <span className="ml-auto text-[#9ca3af]">
                    {o.lastStatus || "—"} · ×{o.count}
                    {(o.simulatedCount || 0) > 0 ? ` · sim×${o.simulatedCount}` : ""}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {MODES.map((m) => {
                    const emptyDisabled = m.id === "return-empty" && !o.emptyCapable;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        title={emptyDisabled ? o.emptyDisabledReason || "Unavailable" : m.label}
                        disabled={!!busy || emptyDisabled}
                        className="rounded-[4px] border border-[#E5E7EB] px-1.5 py-0.5 text-[10px] hover:border-[#8664F2] hover:text-[#8664F2] disabled:opacity-40 dark:border-[#333]"
                        onClick={() => void arm(o.method, o.path, m.id)}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
