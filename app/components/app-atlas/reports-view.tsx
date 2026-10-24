"use client";

import { useMemo, useState } from "react";
import { TbAlertTriangle, TbBolt, TbChartLine, TbCheck, TbDownload, TbLink, TbUser } from "react-icons/tb";
import {
  API_TOTALS,
  CURRENT_SPRINT,
  EPIC_TRENDS,
  FAILING_TESTS,
  SECURITY_TOTALS,
  SPRINTS,
  TICKETS,
  bandOf,
  buildMarkdown,
  projectTrend,
  summarize,
  type Band,
  type FailingTest,
} from "@/app/lib/report-data";

type ReportView = "readiness" | "trends" | "stakeholder";
const VIEWS = [
  { id: "readiness", label: "Sprint Readiness", icon: TbBolt },
  { id: "trends", label: "Trend Charts", icon: TbChartLine },
  { id: "stakeholder", label: "Stakeholder View", icon: TbUser },
] as const;

const BAND = {
  good: { dot: "bg-[#22C55E]", bar: "bg-[#22C55E]", text: "text-[#16A34A]", hex: "#22C55E", chip: "border-[#16A34A] bg-[#F0FDF4] text-[#16A34A] dark:bg-[#0f2418]" },
  partial: { dot: "bg-[#EAB308]", bar: "bg-[#EAB308]", text: "text-[#CA8A04]", hex: "#EAB308", chip: "border-[#D97706] bg-[#FFFBEB] text-[#D97706] dark:bg-[#2a2008]" },
  low: { dot: "bg-[#EF4444]", bar: "bg-[#EF4444]", text: "text-[#DC2626]", hex: "#EF4444", chip: "border-[#DC2626] bg-[#FEF2F2] text-[#DC2626] dark:bg-[#2a0f0f]" },
} satisfies Record<Band, { dot: string; bar: string; text: string; hex: string; chip: string }>;

const card = "rounded-[10px] border border-[#E5E7EB] bg-white dark:border-[#2a2a2a] dark:bg-[#0f0f0f]";
const label = "text-[11px] font-semibold tracking-[0.08em] text-[#5E6066] uppercase dark:text-[#9ca3af]";
const KIND_TONE: Record<FailingTest["kind"], string> = {
  functional: "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB] dark:bg-[#0f1a2e]",
  edge: "border-[#D97706] bg-[#FFFBEB] text-[#D97706] dark:bg-[#2a2008]",
  security: "border-[#DC2626] bg-[#FEF2F2] text-[#DC2626] dark:bg-[#2a0f0f]",
  perf: "border-[#8664F2] bg-[#F4EFFE] text-[#8664F2] dark:bg-[#1e1a2e]",
};

function Kpi({ value, name, note, tone }: { value: string; name: string; note: string; tone: string }) {
  return (
    <div className={`${card} px-5 py-4`}>
      <div className={`text-[30px] leading-none font-semibold ${tone}`}>{value}</div>
      <div className={`${label} mt-2`}>{name}</div>
      <div className="mt-1 text-[11.5px] text-[#7E7E7E]">{note}</div>
    </div>
  );
}

function CoverageBar({ value, band }: { value: number; band: Band }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-[6px] w-[120px] overflow-hidden rounded-full bg-[#E5E7EB] dark:bg-[#2a2a2a]"><div className={`h-full ${BAND[band].bar}`} style={{ width: `${value}%` }} /></div>
      <span className={`w-[34px] text-right text-[12px] font-semibold ${BAND[band].text}`}>{value}%</span>
    </div>
  );
}

function CoverageByTicket() {
  return (
    <div className="space-y-4">
      {EPIC_TRENDS.map((e) => (
        <div key={e.key}>
          <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold tracking-[0.08em] text-[#8664F2] uppercase"><span>{e.key}</span><span className="text-[#5E6066] dark:text-[#9ca3af]">{e.name}</span></div>
          {TICKETS.filter((t) => t.epicKey === e.key).map((t) => (
            <div key={t.key} className="flex items-center justify-between gap-3 border-b border-[#EEE] py-1.5 text-[12.5px] last:border-0 dark:border-[#1a1a1a]">
              <span className="flex min-w-0 items-center gap-2 text-[#1F1F1F] dark:text-[#ededed]"><i className={`h-2.5 w-2.5 shrink-0 rounded-full ${BAND[bandOf(t.coverage)].dot}`} /><b className="shrink-0 text-[11.5px] text-[#2563EB]">{t.key}</b><span className="truncate">{t.name.replace(/^WALLET-\d+: /, "")}</span></span>
              <CoverageBar value={t.coverage} band={bandOf(t.coverage)} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Ring({ value, band }: { value: number; band: Band }) {
  const r = 62;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 160 160" className="h-[170px] w-[170px]" role="img" aria-label={`Readiness ${value}%`}>
      <circle cx="80" cy="80" r={r} fill="none" strokeWidth="12" className="stroke-[#E5E7EB] dark:stroke-[#2a2a2a]" />
      <circle cx="80" cy="80" r={r} fill="none" strokeWidth="12" strokeLinecap="round" stroke={BAND[band].hex} strokeDasharray={`${(value / 100) * c} ${c}`} transform="rotate(-90 80 80)" />
      <text x="80" y="82" textAnchor="middle" className="fill-[#1F1F1F] text-[34px] font-semibold dark:fill-[#ededed]">{value}%</text>
      <text x="80" y="102" textAnchor="middle" className="fill-[#7E7E7E] text-[10px] tracking-[0.12em]">READINESS</text>
    </svg>
  );
}

/** Lines for one or more series across the sprints, drawn on one shared scale. The first series also gets an area fill. */
function Spark({ series }: { series: { values: number[]; color: string }[] }) {
  const w = 300;
  const h = 96;
  const all = series.flatMap((s) => s.values);
  const lo = Math.min(...all) - 6;
  const hi = Math.max(...all) + 6;
  const n = series[0]!.values.length;
  const x = (i: number) => 8 + (i * (w - 16)) / (n - 1);
  const y = (v: number) => h - 6 - ((v - lo) / (hi - lo)) * (h - 14);
  const gid = `area-${series[0]!.color.replace("#", "")}-${Math.round(series[0]!.values[0]!)}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[96px] w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={series[0]!.color} stopOpacity="0.22" /><stop offset="100%" stopColor={series[0]!.color} stopOpacity="0" /></linearGradient>
      </defs>
      <polygon points={`${x(0)},${h} ${series[0]!.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} ${x(n - 1)},${h}`} fill={`url(#${gid})`} />
      {series.map((s) => (
        <g key={s.color}>
          <polyline points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" />
          {s.values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={i === n - 1 ? 3.5 : 2.2} fill={s.color} />)}
        </g>
      ))}
    </svg>
  );
}

function Bars({ title, values, color, now }: { title: string; values: number[]; color: string; now: string }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex h-[96px] items-end gap-2">
        {values.map((v, i) => (
          <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <div className="w-full rounded-t-[4px]" style={{ height: `${v}%`, background: color, opacity: i === values.length - 1 ? 1 : 0.35 }} title={`${SPRINTS[i]}: ${v}`} />
            <span className="text-[9.5px] text-[#7E7E7E]">{SPRINTS[i]}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 text-center text-[11.5px] text-[#5E6066] dark:text-[#9ca3af]">{title} · now: <b style={{ color }}>{now}</b></div>
    </div>
  );
}

function ReadinessView({ onExport }: { onExport: React.ReactNode }) {
  const s = summarize();
  const band: Band = s.readiness >= 80 ? "good" : s.readiness >= 60 ? "partial" : "low";
  const withoutTests = TICKETS.filter((t) => t.tests === 0);
  return (
    <>
      <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi value={`${s.readiness}%`} name="Readiness score" note={s.state} tone={BAND[band].text} />
          <Kpi value={`${s.coverage}%`} name="Avg test coverage" note={s.coverage >= 80 ? "Meets the 80% target" : "Below the 80% target"} tone={BAND[bandOf(s.coverage)].text} />
          <Kpi value={`${s.passed}/${s.tests}`} name="Tests passing" note={`${s.failed} failing`} tone={BAND[bandOf(s.passRate)].text} />
          <Kpi value={`${SECURITY_TOTALS.verified}%`} name="Security checks" note={`${SECURITY_TOTALS.verified}/${SECURITY_TOTALS.total} verified`} tone="text-[#8664F2]" />
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="space-y-5">
            <section className={`${card} p-5`}>
              <div className="mb-3 flex items-center justify-between">
                <div className={`${label} flex items-center gap-2 text-[#DC2626]`}><TbAlertTriangle size={15} /> Failing tests</div>
                <span className="rounded-full bg-[#FEF2F2] px-2 py-0.5 text-[11px] font-semibold text-[#DC2626] dark:bg-[#2a0f0f]">{s.failed}</span>
              </div>
              <div className="space-y-2">
                {FAILING_TESTS.map((f) => (
                  <div key={f.name} className="rounded-[8px] border border-[#EEE] px-3 py-2.5 dark:border-[#1f1f1f]">
                    <div className="mb-1 flex items-center justify-between">
                      <span className={`rounded-[4px] border px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${KIND_TONE[f.kind]}`}>{f.kind}</span>
                      <span className="text-[11px] text-[#7E7E7E]"><b className="text-[#2563EB]">{f.ticket}</b> · {f.screen}</span>
                    </div>
                    <div className="text-[13px] font-medium text-[#1F1F1F] dark:text-[#ededed]">{f.name}</div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11.5px] text-[#7E7E7E]">Showing {FAILING_TESTS.length} of {s.failed} failing tests, highest impact first.</p>
            </section>

            <section className={`${card} p-5`}>
              <div className="mb-3 flex items-center justify-between">
                <div className={label}>Jira tickets without tests</div>
                <span className="rounded-full bg-[#F4EFFE] px-2 py-0.5 text-[11px] font-semibold text-[#8664F2] dark:bg-[#1e1a2e]">{withoutTests.length}</span>
              </div>
              <p className="flex items-center gap-2 text-[12.5px] text-[#16A34A]"><TbCheck size={15} /> All {TICKETS.length} tickets in project DW have test coverage.</p>
            </section>
          </div>

          <div className="space-y-5">
            <section className={`${card} p-5`}>
              <div className={`${label} mb-3`}>Coverage by ticket</div>
              <CoverageByTicket />
            </section>
            <section className={`${card} p-5`}>
              <div className="mb-3 flex items-center justify-between">
                <div className={label}>Security gaps</div>
                <span className="rounded-full bg-[#F4EFFE] px-2 py-0.5 text-[11px] font-semibold text-[#8664F2] dark:bg-[#1e1a2e]">{SECURITY_TOTALS.total - SECURITY_TOTALS.verified}</span>
              </div>
              <p className="text-[12.5px] text-[#5E6066] dark:text-[#9ca3af]">None of the {SECURITY_TOTALS.total} planned checks ({SECURITY_TOTALS.automated} automated, {SECURITY_TOTALS.guided} guided) has been verified yet. Open the Security tab to plan them.</p>
            </section>
          </div>
        </div>
      </div>
      {onExport}
    </>
  );
}

function TrendsView() {
  const cov = projectTrend("coverage");
  const q = projectTrend("quality");
  return (
    <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
      <section className={`${card} p-5`}>
        <div className={`${label} mb-4`}>Project-wide trend · last 7 sprints</div>
        <div className="flex flex-col gap-8 md:flex-row">
          <Bars title="Average coverage %" values={cov} color="#2563EB" now={`${cov[cov.length - 1]}%`} />
          <Bars title="Average quality score" values={q} color="#8664F2" now={`${q[q.length - 1]}`} />
        </div>
      </section>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {EPIC_TRENDS.map((e) => {
          const c = e.coverage.map(Math.round);
          const ql = e.quality.map(Math.round);
          const now = c[c.length - 1]!;
          const delta = now - c[c.length - 2]!;
          const b = bandOf(now);
          return (
            <section key={e.key} className={`${card} overflow-hidden`}>
              <div className="flex items-center justify-between px-5 pt-4">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-[#1F1F1F] dark:text-[#ededed]"><i className={`h-2.5 w-2.5 rounded-full ${BAND[b].dot}`} /><span className="text-[#8664F2]">{e.key}</span>{e.name}</div>
                <span className="rounded-full bg-[#F0FDF4] px-2 py-0.5 text-[11px] font-semibold text-[#16A34A] dark:bg-[#0f2418]">{delta >= 0 ? "+" : ""}{delta}%</span>
              </div>
              <div className="px-3 pt-2">
                <Spark series={[{ values: e.coverage, color: BAND[b].hex }, { values: e.quality, color: "#8664F2" }]} />
              </div>
              <div className="flex gap-4 px-5 pt-1 text-[10px] text-[#7E7E7E]">
                <span className="flex items-center gap-1"><i className="h-[2px] w-3" style={{ background: BAND[b].hex }} /> Coverage</span>
                <span className="flex items-center gap-1"><i className="h-[2px] w-3 bg-[#8664F2]" /> Quality score</span>
              </div>
              <div className="flex justify-between px-5 pb-1 text-[9.5px] text-[#7E7E7E]">{SPRINTS.map((sp) => <span key={sp}>{sp}</span>)}</div>
              <div className="mt-2 grid grid-cols-3 divide-x divide-[#EEE] border-t border-[#EEE] text-center dark:divide-[#1a1a1a] dark:border-[#1a1a1a]">
                <div className="py-2.5"><div className={`text-[18px] font-semibold ${BAND[b].text}`}>{now}%</div><div className="text-[10px] text-[#7E7E7E]">Coverage</div></div>
                <div className="py-2.5"><div className="text-[18px] font-semibold text-[#8664F2]">{ql[ql.length - 1]}</div><div className="text-[10px] text-[#7E7E7E]">Quality score</div></div>
                <div className="py-2.5"><div className="text-[18px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">{e.tickets}</div><div className="text-[10px] text-[#7E7E7E]">Tickets</div></div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function StakeholderView({ projectName, date, onExport }: { projectName?: string | null; date: string; onExport: React.ReactNode }) {
  const s = summarize();
  const band: Band = s.readiness >= 80 ? "good" : s.readiness >= 60 ? "partial" : "low";
  const health = EPIC_TRENDS.map((e) => {
    const ts = TICKETS.filter((t) => t.epicKey === e.key);
    const cov = Math.round(ts.reduce((n, t) => n + t.coverage, 0) / ts.length);
    const b = bandOf(cov);
    return { name: e.name, note: `${e.key} · ${ts.length} ${ts.length === 1 ? "ticket" : "tickets"}`, text: b === "good" ? "Good" : b === "partial" ? "At risk" : "Gaps", band: b };
  });
  health.push(
    { name: "API Testing", note: `${API_TOTALS.modules} modules · ${API_TOTALS.endpoints} endpoints`, text: "Ready", band: "good" },
    { name: "Security posture", note: `${SECURITY_TOTALS.verified}/${SECURITY_TOTALS.total} checks verified`, text: "Gaps", band: "low" },
  );
  return (
    <>
      <div className="min-h-0 flex-1 overflow-auto px-6 py-6">
        <div className="mx-auto max-w-[1000px]">
          <div className="text-center">
            <div className="text-[10.5px] font-semibold tracking-[0.2em] text-[#7E7E7E] uppercase">AppAtlas · Quality report</div>
            <h2 className="mt-1 text-[26px] font-semibold text-[#8664F2]">Quality &amp; Readiness Report</h2>
            <div className="mt-1 text-[12.5px] text-[#5E6066] dark:text-[#9ca3af]">{projectName || "Pro-Test Digital Wallet"} · {CURRENT_SPRINT}</div>
            <div className="text-[11px] text-[#9ca3af]">Generated {date}</div>
            <div className="mt-3 flex justify-center"><Ring value={s.readiness} band={band} /></div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi value={`${s.coverage}%`} name="Test coverage" note="Average across tickets" tone="text-[#2563EB]" />
            <Kpi value={`${s.passed}/${s.tests}`} name="Tests passing" note={`${s.failed} failing`} tone={BAND[bandOf(s.passRate)].text} />
            <Kpi value={`${s.quality}/100`} name="Avg quality score" note="Across all tickets" tone="text-[#8664F2]" />
            <Kpi value={`${SECURITY_TOTALS.verified}%`} name="Security verified" note={`${SECURITY_TOTALS.verified}/${SECURITY_TOTALS.total} checks done`} tone="text-[#CA8A04]" />
          </div>

          <div className={`${label} mt-7 mb-2`}>System health indicators</div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {health.map((h) => (
              <div key={h.name} className={`${card} flex items-center justify-between gap-3 px-4 py-3`}>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-[#1F1F1F] dark:text-[#ededed]">{h.name}</div>
                  <div className="truncate text-[11px] text-[#7E7E7E]">{h.note}</div>
                </div>
                <span className={`shrink-0 rounded-[4px] border px-2 py-0.5 text-[10.5px] font-bold tracking-wide uppercase ${BAND[h.band].chip}`}>{h.text}</span>
              </div>
            ))}
          </div>

          <div className={`${label} mt-7 mb-2`}>Coverage by Jira ticket</div>
          <section className={`${card} p-5`}><CoverageByTicket /></section>
        </div>
      </div>
      {onExport}
    </>
  );
}

/**
 * Reporting Center: sprint readiness, trend charts and a read-only stakeholder view for the Digital Wallet project.
 * All figures are hardcoded sample data (see app/lib/report-data.ts) and agree with the Coverage tab.
 */
export function ReportsView({ projectName }: { projectName?: string | null }) {
  const [view, setView] = useState<ReportView>("readiness");
  const [copied, setCopied] = useState(false);
  const date = useMemo(() => new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }), []);

  const download = () => {
    const url = URL.createObjectURL(new Blob([buildMarkdown(date)], { type: "text/markdown" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `quality-readiness-report-${CURRENT_SPRINT.toLowerCase().replace(" ", "-")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: nothing to do */
    }
  };

  const btn = "flex h-[34px] items-center gap-2 rounded-[8px] px-4 text-[12.5px] font-medium";
  const exportBar = (
    <footer className="flex shrink-0 flex-wrap items-center gap-3 border-t border-[#EEE] bg-white px-6 py-3 dark:border-[#1a1a1a] dark:bg-[#0a0a0a]">
      <span className="text-[12px] text-[#7E7E7E]">Export this {view === "stakeholder" ? "report" : "sprint readiness report"} as:</span>
      <button type="button" onClick={() => window.print()} className={`${btn} bg-[#8664F2] text-white hover:bg-[#7451e8]`}><TbDownload size={15} /> PDF Report</button>
      <button type="button" onClick={download} className={`${btn} border border-[#C9B8F7] bg-[#F4EFFE] text-[#8664F2] hover:bg-[#EDE4FD] dark:border-[#3a3060] dark:bg-[#1e1a2e]`}><TbDownload size={15} /> Markdown</button>
      <button type="button" onClick={share} className={`${btn} border border-[#E5E7EB] text-[#1F1F1F] hover:text-[#8664F2] dark:border-[#2a2a2a] dark:text-[#ededed]`}><TbLink size={15} /> {copied ? "Link copied" : "Share View"}</button>
      <span className="ml-auto text-[11px] text-[#9ca3af]">Generated {date} · AppAtlas</span>
    </footer>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#EEE] px-6 py-3 dark:border-[#1a1a1a]">
        <div className="flex items-center gap-2 text-[15px] font-medium text-[#1F1F1F] dark:text-[#ededed]"><TbChartLine size={17} className="text-[#8664F2]" /> Reporting Center</div>
        <div className="flex items-center gap-1">
          {VIEWS.map(({ id, label: text, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              aria-pressed={view === id}
              className={`flex h-[32px] items-center gap-1.5 rounded-[8px] border px-3 text-[12.5px] ${view === id ? "border-[#C9B8F7] bg-[#F2EBFB] text-[#8664F2] dark:border-[#3a3060] dark:bg-[#2a2440]" : "border-[#E5E7EB] text-[#1F1F1F] hover:text-[#8664F2] dark:border-[#2a2a2a] dark:text-[#ededed]"}`}
            >
              <Icon size={14} /> {text}
            </button>
          ))}
        </div>
      </header>
      {view === "readiness" && <ReadinessView onExport={exportBar} />}
      {view === "trends" && <TrendsView />}
      {view === "stakeholder" && <StakeholderView projectName={projectName} date={date} onExport={exportBar} />}
    </div>
  );
}
