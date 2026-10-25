"use client";

import { useEffect, useMemo, useState } from "react";
import { TbDeviceMobile, TbServer } from "react-icons/tb";
import { SECURITY_CATEGORIES, type CheckMode, type SecurityCategory, type SecurityCheck } from "@/app/lib/security-checklist";
import { isLiveRunnable, liveKindFor, type LiveKind } from "@/app/lib/security-live-checks";
import type { AtlasClient } from "@/app/services/appatlas";
import { SecurityCheckSession } from "./security-check-session";

const AUTO = "text-[#16A34A] border-[#16A34A] bg-[#F0FDF4] dark:bg-[#0f2418]";
const GUIDED = "text-[#D97706] border-[#D97706] bg-[#FFFBEB] dark:bg-[#2a2008]";
const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);

function SplitBar({ automated, guided, height = 6 }: { automated: number; guided: number; height?: number }) {
  const total = automated + guided;
  return (
    <div className="flex w-full overflow-hidden rounded-full bg-[#E5E7EB] dark:bg-[#2a2a2a]" style={{ height }} role="img" aria-label={`${automated} automated, ${guided} guided`}>
      <div className="bg-[#16A34A]" style={{ width: `${pct(automated, total)}%` }} />
      <div className="bg-[#D97706]" style={{ width: `${pct(guided, total)}%` }} />
    </div>
  );
}

function Stat({ value, label, tone }: { value: string | number; label: string; tone?: string }) {
  return (
    <div className="min-w-[110px] rounded-[10px] border border-[#E5E7EB] px-4 py-2.5 dark:border-[#2a2a2a]">
      <div className={`text-[20px] font-semibold ${tone ?? "text-[#1F1F1F] dark:text-[#ededed]"}`}>{value}</div>
      <div className="text-[11.5px] text-[#7E7E7E]">{label}</div>
    </div>
  );
}

const ModeBadge = ({ mode }: { mode: CheckMode }) => (
  <span className={`shrink-0 rounded-[4px] border px-2 py-0.5 text-[10.5px] font-bold tracking-wide ${mode === "automated" ? AUTO : GUIDED}`}>
    {mode === "automated" ? "AUTOMATED" : "GUIDED"}
  </span>
);

/**
 * Security plan. When logs dashboard has "Live Security checks" on, runnable rows open a canvas-style session
 * (headed stuffing for automated brute-force/stuffing; guided procedures for guided rows). Off = static list only.
 */
export function SecurityOverview({
  targetUrl,
  projectName,
  client,
}: {
  targetUrl?: string | null;
  projectName?: string | null;
  client: AtlasClient;
}) {
  const [selectedId, setSelectedId] = useState(SECURITY_CATEGORIES[0].id);
  const [filter, setFilter] = useState<"all" | CheckMode>("all");
  const [liveEnabled, setLiveEnabled] = useState(true);
  const [active, setActive] = useState<{ check: SecurityCheck; kind: LiveKind } | null>(null);

  useEffect(() => {
    let cancelled = false;
    client
      .getSettings()
      .then((s) => {
        if (cancelled) return;
        // Older backends omit the flag — keep live on until logs can turn it off.
        setLiveEnabled(typeof s.securityLiveChecks === "boolean" ? s.securityLiveChecks : true);
      })
      .catch(() => {
        /* keep default; backend may be older without the flag */
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  const totals = useMemo(() => {
    const automated = SECURITY_CATEGORIES.reduce((n, c) => n + c.automated, 0);
    const guided = SECURITY_CATEGORIES.reduce((n, c) => n + c.guided, 0);
    return { automated, guided, total: automated + guided };
  }, []);
  const selected: SecurityCategory = SECURITY_CATEGORIES.find((c) => c.id === selectedId) ?? SECURITY_CATEGORIES[0];
  const visible = selected.checks.filter((c) => filter === "all" || c.mode === filter);
  const chip = (id: typeof filter, text: string, tone: string) => (
    <button key={id} type="button" onClick={() => setFilter(id)} aria-pressed={filter === id} className={`rounded-[6px] border px-3 py-1 text-[12px] ${filter === id ? tone : "border-[#E5E7EB] text-[#5E6066] hover:text-[#1F1F1F] dark:border-[#2a2a2a] dark:text-[#9ca3af]"}`}>
      {text}
    </button>
  );

  if (active) {
    return (
      <SecurityCheckSession
        check={active.check}
        kind={active.kind}
        targetUrl={targetUrl}
        onClose={() => setActive(null)}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-[#EEE] px-6 py-4 dark:border-[#1a1a1a]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">Security testing plan</h2>
            <p className="mt-0.5 truncate text-[12.5px] text-[#5E6066] dark:text-[#9ca3af]" title={targetUrl ?? undefined}>
              {targetUrl ? (
                <>
                  For <span className="font-mono text-[#1F1F1F] dark:text-[#ededed]">{targetUrl}</span>
                  {projectName ? ` · ${projectName}` : ""}
                </>
              ) : (
                "No Application URL set for this project yet. Add one in the project setup to tie this plan to your app."
              )}
            </p>
            {liveEnabled ? (
              <p className="mt-1 text-[11.5px] text-[#8664F2]">Live checks on — click a runnable row to open a session. Toggle from the logs dashboard.</p>
            ) : (
              <p className="mt-1 text-[11.5px] text-[#7E7E7E]">Static plan only. Enable “Live Security checks” on the logs dashboard to run headed / guided sessions.</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Stat value={SECURITY_CATEGORIES.length} label="categories" />
            <Stat value={totals.total} label="checks" />
            <Stat value={`${totals.automated} · ${pct(totals.automated, totals.total)}%`} label="automated" tone="text-[#16A34A]" />
            <Stat value={`${totals.guided} · ${pct(totals.guided, totals.total)}%`} label="guided" tone="text-[#D97706]" />
          </div>
        </div>
        <div className="mt-3 max-w-[720px]">
          <SplitBar automated={totals.automated} guided={totals.guided} height={8} />
          <p className="mt-1.5 text-[11.5px] text-[#7E7E7E]">Automated checks run headed in the Security agent. Guided checks are step-by-step procedures you complete and record.</p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav aria-label="Security categories" className="w-[300px] shrink-0 overflow-y-auto border-r border-[#EEE] py-2 dark:border-[#1a1a1a]">
          {SECURITY_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setSelectedId(c.id);
                setFilter("all");
              }}
              aria-current={c.id === selected.id}
              className={`block w-full px-4 py-2.5 text-left ${c.id === selected.id ? "bg-[#F2EBFB] dark:bg-[#2a2440]" : "hover:bg-[#F5F6F6] dark:hover:bg-[#141414]"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className={`text-[13px] ${c.id === selected.id ? "font-semibold text-[#8664F2]" : "text-[#1F1F1F] dark:text-[#ededed]"}`}>{c.name}</span>
                <span className="shrink-0 rounded-full bg-[#F5F6F6] px-2 py-0.5 text-[11px] text-[#5E6066] dark:bg-[#1a1a1a] dark:text-[#9ca3af]">{c.automated + c.guided}</span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex-1">
                  <SplitBar automated={c.automated} guided={c.guided} height={4} />
                </div>
                <span className="shrink-0 text-[10.5px] text-[#7E7E7E]">
                  <span className="text-[#16A34A]">{c.automated} auto</span> · <span className="text-[#D97706]">{c.guided} guided</span>
                </span>
              </div>
            </button>
          ))}
        </nav>

        <section className="min-w-0 flex-1 overflow-y-auto px-6 py-4" aria-label={selected.name}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">{selected.name}</h3>
              <p className="mt-1 max-w-[760px] text-[12.5px] leading-relaxed text-[#5E6066] dark:text-[#9ca3af]">{selected.covers}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px] text-[#7E7E7E]">
                <span>Brief §{selected.brief}</span>
                {selected.note && (
                  <span className="inline-flex items-center gap-1 rounded-[4px] border border-[#E5E7EB] px-1.5 py-0.5 dark:border-[#2a2a2a]">
                    {selected.note.includes("device") ? <TbDeviceMobile size={12} /> : <TbServer size={12} />} {selected.note}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Stat value={selected.automated} label="automated" tone="text-[#16A34A]" />
              <Stat value={selected.guided} label="guided" tone="text-[#D97706]" />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            {chip("all", `All (${selected.checks.length})`, "border-[#8664F2] bg-[#F5F1FF] font-semibold text-[#8664F2] dark:bg-[#1c1530]")}
            {selected.itemised && chip("automated", `Automated (${selected.automated})`, AUTO)}
            {selected.itemised && chip("guided", `Guided (${selected.guided})`, GUIDED)}
          </div>

          {!selected.itemised && (
            <p className="mt-3 rounded-[8px] bg-[#F5F6F6] px-3 py-2 text-[12px] text-[#5E6066] dark:bg-[#141414] dark:text-[#9ca3af]">
              The AppAtlas brief gives only totals for this category: {selected.automated} automated and {selected.guided} guided. It doesn&apos;t say which check is which, so the checks below show no mode yet.
            </p>
          )}

          <ul className="mt-3 divide-y divide-[#EEE] dark:divide-[#1a1a1a]">
            {visible.map((c) => {
              const runnable = isLiveRunnable(c, liveEnabled);
              const kind = liveKindFor(c);
              const row = (
                <>
                  <span className="mt-1 h-3.5 w-3.5 shrink-0 rounded-[3px] border border-[#D9D9D9] dark:border-[#3a3a3a]" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] text-[#1F1F1F] dark:text-[#ededed]">
                      {c.name}
                      {runnable && <span className="ml-2 text-[10.5px] font-medium text-[#8664F2]">Open session</span>}
                    </div>
                    <div className="mt-0.5 text-[12px] text-[#7E7E7E]">{c.does}</div>
                  </div>
                  {c.mode ? <ModeBadge mode={c.mode} /> : <span className="shrink-0 text-[10.5px] text-[#9CA3AF]">not itemised</span>}
                </>
              );
              return (
                <li key={c.name}>
                  {runnable && kind ? (
                    <button
                      type="button"
                      onClick={() => setActive({ check: c, kind })}
                      className="flex w-full items-start gap-3 py-2.5 text-left hover:bg-[#F5F6F6] dark:hover:bg-[#141414]"
                    >
                      {row}
                    </button>
                  ) : (
                    <div className="flex items-start gap-3 py-2.5">{row}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
