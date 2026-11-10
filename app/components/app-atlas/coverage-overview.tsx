"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import {
  TbBolt,
  TbBookmarkFilled,
  TbChevronDown,
  TbChevronRight,
  TbInfoCircle,
  TbLoader2,
  TbSparkles,
  TbX,
} from "react-icons/tb";
import type { SitEpic, SitJob, SitWorkbook } from "@/app/interfaces/appatlas";
import type { AtlasClient } from "@/app/services/appatlas";
import { SitCaseDrawer } from "./sit-case-drawer";
import { SitJobsChip } from "./sit-jobs-chip";

/** Freshness thresholds (ms): configurable. */
const FRESH_MS = 24 * 60 * 60 * 1000;
const AGING_MS = 7 * 24 * 60 * 60 * 1000;
const FRESH_HOURS = Math.round(FRESH_MS / (60 * 60 * 1000));
const AGING_DAYS = Math.round(AGING_MS / (24 * 60 * 60 * 1000));
const HOUR_MS = 60 * 60 * 1000;

/** Case-count target for Test depth volume term. */
const CASE_TARGET = 8;

/** Types that count toward Test depth / Quality / matrix (Security is excluded: lives on Security tab). */
const DEPTH_TYPES = ["Positive", "Negative", "Boundary", "Validation", "Business Rule", "Concurrency"] as const;
const TYPE_COUNT = DEPTH_TYPES.length;

const MATRIX_COLLAPSE_KEY = "appatlas-coverage-matrix-collapsed";
const PRIOSEV_VIEW_KEY = "appatlas-coverage-priosev-view";

const TYPE_CHIP: Record<string, string> = {
  Positive: "bg-[#E2EFDA] text-[#375623] border-[#c5e0b4]",
  Negative: "bg-[#FCE4E4] text-[#9b1c1c] border-[#f5c2c7]",
  Boundary: "bg-[#FFF2CC] text-[#7a5b00] border-[#ffe08a]",
  Validation: "bg-[#DDEBF7] text-[#1e3a5f] border-[#b7d3ea]",
  "Business Rule": "bg-[#E4DFEC] text-[#4a3a6b] border-[#cbb8e0]",
  Concurrency: "bg-[#dde7f5] text-[#1e3a5f] border-[#b3c7e6]",
};

const band = (c: number) =>
  c >= 80
    ? { name: "good", dot: "bg-[#22C55E]", bar: "bg-[#22C55E]", text: "text-[#16A34A]" }
    : c >= 40
      ? { name: "partial", dot: "bg-[#EAB308]", bar: "bg-[#EAB308]", text: "text-[#CA8A04]" }
      : { name: "low", dot: "bg-[#EF4444]", bar: "bg-[#EF4444]", text: "text-[#DC2626]" };

const th =
  "px-3 py-3 text-left text-[11px] font-semibold tracking-[0.08em] text-[#5E6066] uppercase dark:text-[#9ca3af]";

function typesPresent(byType: Record<string, number>) {
  return DEPTH_TYPES.filter((t) => (byType[t] || 0) > 0).length;
}

/**
 * Test depth: volume (40%) + type breadth (60%).
 * score% = round(40 × min(1, cases/CASE_TARGET) + 60 × (types_present / TYPE_COUNT))
 */
function testDepthPct(tests: number, byType: Record<string, number>) {
  if (!tests) return 0;
  const volume = Math.min(1, tests / CASE_TARGET);
  const breadth = typesPresent(byType) / TYPE_COUNT;
  return Math.round(40 * volume + 60 * breadth);
}

/**
 * Quality: 50% volume + 50% breadth over the 6 depth types.
 * Missing any type caps below 100 (breadth ≤ 5/6 → max 92).
 */
function qualityFromTypes(byType: Record<string, number>, tests: number) {
  if (!tests) return 0;
  const present = typesPresent(byType);
  const volume = Math.min(1, tests / CASE_TARGET);
  const breadth = present / TYPE_COUNT;
  return Math.round(50 * volume + 50 * breadth);
}

function agoShort(ts: number | null) {
  if (!ts) return "never";
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? "1 day ago" : `${d}d ago`;
}

function agoPlain(ts: number) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? "1 day ago" : `${d} days ago`;
}

/** e.g. "21 Oct 2026, 9:30 PM IST" */
function formatLocalTs(ts: number) {
  const d = new Date(ts);
  const datePart = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
  const tz =
    new Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
      .formatToParts(d)
      .find((p) => p.type === "timeZoneName")?.value || "";
  return `${datePart}${tz ? ` ${tz}` : ""}`.replace(/\u202f/g, " ").trim();
}

function toDatetimeLocal(ts: number) {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fromDatetimeLocal(v: string) {
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

function freshnessOf(updatedAt: number | null): {
  key: "fresh" | "aging" | "stale" | "never";
  label: string;
  className: string;
  dot: string;
} {
  if (!updatedAt) {
    return { key: "never", label: "never generated", className: "text-[#9ca3af]", dot: "bg-[#d1d5db]" };
  }
  const age = Date.now() - updatedAt;
  if (age < FRESH_MS) {
    return { key: "fresh", label: "fresh", className: "text-[#166534]", dot: "bg-[#22C55E]" };
  }
  if (age < AGING_MS) {
    return { key: "aging", label: "aging", className: "text-[#a16207]", dot: "bg-[#EAB308]" };
  }
  return { key: "stale", label: "stale", className: "text-[#6b7280]", dot: "bg-[#9ca3af]" };
}

function generatedTip(updatedAt: number | null) {
  if (!updatedAt) return "Never generated";
  return `Generated ${formatLocalTs(updatedAt)}`;
}

function freshnessTip(updatedAt: number | null) {
  if (!updatedAt) return "Never generated";
  const age = agoPlain(updatedAt);
  const key = freshnessOf(updatedAt).key;
  if (key === "fresh") return `Fresh: generated ${age} (under ${FRESH_HOURS}h)`;
  if (key === "aging") return `Aging: generated ${age} (1 to ${AGING_DAYS} days)`;
  return `Stale: generated ${age} (over ${AGING_DAYS} days), consider regenerating`;
}

function epicFreshnessTip(tickets: Row[]) {
  const generated = tickets.filter((t) => t.generatedAt);
  const never = tickets.length - generated.length;
  if (!generated.length) {
    return `No generated tickets. ${never} of ${tickets.length} tickets never generated.`;
  }
  const oldest = generated.reduce((a, b) => ((a.generatedAt! <= b.generatedAt!) ? a : b));
  return `Based on the oldest generated ticket: ${oldest.key}, generated ${agoPlain(oldest.generatedAt!)}, ${formatLocalTs(oldest.generatedAt!)}. ${never} of ${tickets.length} tickets never generated.`;
}

function prioSevMapsEqual(a: Record<string, number>, b: Record<string, number>) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if ((a[k] || 0) !== (b[k] || 0)) return false;
  }
  return true;
}

function bandLine(prefix: string, map: Record<string, number>) {
  const other = Object.entries(map)
    .filter(([k]) => !["High", "Medium", "Low"].includes(k))
    .reduce((n, [, v]) => n + (v || 0), 0);
  const base = `${prefix}: High ${map.High || 0}, Med ${map.Medium || 0}, Low ${map.Low || 0}`;
  return other ? `${base}, Other ${other}` : base;
}

function prioSevNumbersLines(row: {
  byPriority: Record<string, number>;
  bySeverity: Record<string, number>;
  notAssessed: number;
}) {
  const lines = [bandLine("P", row.byPriority), bandLine("S", row.bySeverity)];
  if (row.notAssessed > 0) lines.push(`${row.notAssessed} not assessed`);
  return lines;
}

function prioSevTip(row: { byPriority: Record<string, number>; bySeverity: Record<string, number>; notAssessed: number }) {
  const base = `Priority: High ${row.byPriority.High || 0}, Medium ${row.byPriority.Medium || 0}, Low ${row.byPriority.Low || 0}\nSeverity: High ${row.bySeverity.High || 0}, Medium ${row.bySeverity.Medium || 0}, Low ${row.bySeverity.Low || 0}`;
  return row.notAssessed > 0 ? `${base}\n${row.notAssessed} not assessed` : base;
}

const BETA_TIP = "AI-assisted estimate. Review before relying on it.";

function BetaBadge() {
  return (
    <span
      title={BETA_TIP}
      className="rounded border border-[#e9d5ff] bg-[#f5f3ff] px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-[#7c3aed]"
    >
      beta
    </span>
  );
}

type RiskRubric = {
  version?: number;
  severity?: { definition?: string };
  priority?: { definition?: string; floor?: string };
};

function AnchoredPopover({
  open,
  anchorRef,
  onClose,
  width,
  children,
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  width: number;
  children: ReactNode;
}) {
  const [box, setBox] = useState<{ top: number; left: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
      let top = r.bottom + 6;
      if (top + 320 > window.innerHeight - 8 && r.top > 200) top = Math.max(8, r.top - 320 - 6);
      setBox({ top, left });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, anchorRef, width]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !box || typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={panelRef}
      style={{ position: "fixed", top: box.top, left: box.left, width }}
      className="z-[80] max-h-[min(480px,calc(100vh-16px))] overflow-auto rounded-[10px] border border-[#e2e6ef] bg-white p-3 text-left text-[12px] font-normal normal-case tracking-normal text-[#374151] shadow-xl dark:border-[#2a2a2a] dark:bg-[#151515] dark:text-[#d1d5db]"
    >
      {children}
    </div>,
    document.body,
  );
}

function Tip({ text, children, className }: { text: string; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className={`relative inline-flex max-w-full ${className || ""}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="inline-flex max-w-full items-center gap-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#8664F2]/40"
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        {children}
      </button>
      {open ? (
        <span
          role="tooltip"
          className="absolute left-0 top-full z-40 mt-1 w-max max-w-[280px] rounded-[8px] border border-[#e2e6ef] bg-white px-2.5 py-1.5 text-left text-[11px] font-normal normal-case tracking-normal text-[#374151] shadow-lg dark:border-[#2a2a2a] dark:bg-[#151515] dark:text-[#d1d5db]"
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}

function SegmentBar({
  map,
  label,
  notAssessed,
}: {
  map: Record<string, number>;
  label: string;
  notAssessed: number;
}) {
  const high = map.High || 0;
  const med = map.Medium || 0;
  const low = map.Low || 0;
  const other = Object.entries(map)
    .filter(([k]) => !["High", "Medium", "Low"].includes(k))
    .reduce((n, [, v]) => n + v, 0);
  const na = Math.max(0, notAssessed);
  const total = high + med + low + other + na;
  if (!total) return <span className="text-[#9ca3af]">-</span>;
  const title = `${label}: High ${high}, Medium ${med}, Low ${low}. ${na} not assessed`;
  return (
    <div className="min-w-[72px]" title={title}>
      <div className="mb-0.5 text-[9px] uppercase tracking-wide text-[#9ca3af]">{label}</div>
      <div className="flex h-2 overflow-hidden rounded-full bg-[#E5E7EB] dark:bg-[#2a2a2a]">
        {high ? <div className="h-full bg-[#EF4444]" style={{ width: `${(high / total) * 100}%` }} /> : null}
        {med ? <div className="h-full bg-[#EAB308]" style={{ width: `${(med / total) * 100}%` }} /> : null}
        {low ? <div className="h-full bg-[#9CA3AF]" style={{ width: `${(low / total) * 100}%` }} /> : null}
        {other ? <div className="h-full bg-[#c4b5fd]" style={{ width: `${(other / total) * 100}%` }} /> : null}
        {na ? (
          <div
            className="h-full"
            style={{
              width: `${(na / total) * 100}%`,
              backgroundColor: "#f3f4f6",
              backgroundImage:
                "repeating-linear-gradient(135deg, #9ca3af 0 2px, transparent 2px 4px)",
            }}
            title={`${na} not assessed`}
          />
        ) : null}
      </div>
    </div>
  );
}

function matrixShade(count: number, max: number) {
  if (count <= 0 || max <= 0) return "bg-transparent";
  const t = Math.min(1, count / max);
  if (t < 0.25) return "bg-[#EDE9FE]";
  if (t < 0.5) return "bg-[#DDD6FE]";
  if (t < 0.75) return "bg-[#C4B5FD]";
  return "bg-[#A78BFA] text-white";
}

function EpicIcon() {
  return (
    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#7C3AED] text-white" title="Epic">
      <TbBolt size={12} />
    </span>
  );
}

function StoryIcon() {
  return (
    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#16A34A] text-white" title="Story">
      <TbBookmarkFilled size={11} />
    </span>
  );
}

type SitCov = {
  tests: number;
  byType: Record<string, number>;
  byPriority?: Record<string, number>;
  bySeverity?: Record<string, number>;
  notAssessed?: number;
  templateCases?: number;
  automationYes?: number;
  generator: string;
  updatedAt: number;
  generatedAt?: number | null;
  assessedAt?: number | null;
  summary?: string | null;
  workbookId?: string;
};

type Row = {
  key: string;
  name: string;
  tests: number;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
  bySeverity: Record<string, number>;
  notAssessed: number;
  templateCases: number;
  automationYes: number;
  quality: number;
  depth: number;
  generator?: string;
  updatedAt: number | null;
  generatedAt: number | null;
  assessedAt: number | null;
  workbookId?: string;
};

type FreshPreset = "all" | "fresh" | "aging" | "stale" | "never" | "custom";
type PrioSevView = "bars" | "numbers";

type DrawerTarget = {
  workbookId: string;
  ticketKey: string;
  ticketName: string;
  showRubric?: boolean;
};

export function CoverageOverview({
  client,
  canvasId,
  onOpenSit,
}: {
  client: AtlasClient;
  canvasId: string | null;
  onOpenSit?: (opts?: { workbookId?: string; ticketKey?: string; testType?: string }) => void;
}) {
  const [epics, setEpics] = useState<SitEpic[]>([]);
  const [sit, setSit] = useState<Record<string, SitCov>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<SitJob[]>([]);
  const [jobToast, setJobToast] = useState<string | null>(null);
  const watchedJobs = useRef<Set<string>>(new Set());
  const [drawerRefresh, setDrawerRefresh] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const [freshPreset, setFreshPreset] = useState<FreshPreset>("all");
  const [rangeStart, setRangeStart] = useState<number | null>(null);
  const [rangeEnd, setRangeEnd] = useState<number | null>(null);
  const [includeNever, setIncludeNever] = useState(false);
  const [depthInfoOpen, setDepthInfoOpen] = useState(false);
  const [qualityInfoOpen, setQualityInfoOpen] = useState(false);
  const [prioInfoOpen, setPrioInfoOpen] = useState(false);
  const [preview, setPreview] = useState<SitWorkbook | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [matrixCollapsed, setMatrixCollapsed] = useState(false);
  const [prioSevView, setPrioSevView] = useState<PrioSevView>("bars");
  const [drawer, setDrawer] = useState<DrawerTarget | null>(null);
  const [modelInactive, setModelInactive] = useState(false);
  const [modelName, setModelName] = useState<string | null>(null);
  const [rubric, setRubric] = useState<RiskRubric | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [draftStart, setDraftStart] = useState<number | null>(null);
  const [draftEnd, setDraftEnd] = useState<number | null>(null);
  const [draftNever, setDraftNever] = useState(false);
  const customBtnRef = useRef<HTMLButtonElement>(null);
  const depthInfoRef = useRef<HTMLButtonElement>(null);
  const qualityInfoRef = useRef<HTMLButtonElement>(null);
  const prioInfoRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try {
      setMatrixCollapsed(localStorage.getItem(MATRIX_COLLAPSE_KEY) === "1");
      const v = localStorage.getItem(PRIOSEV_VIEW_KEY);
      if (v === "bars" || v === "numbers") setPrioSevView(v);
    } catch {
      /* ignore */
    }
  }, []);

  const persistMatrixCollapsed = (v: boolean) => {
    setMatrixCollapsed(v);
    try {
      localStorage.setItem(MATRIX_COLLAPSE_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  const persistPrioSevView = (v: PrioSevView) => {
    setPrioSevView(v);
    try {
      localStorage.setItem(PRIOSEV_VIEW_KEY, v);
    } catch {
      /* ignore */
    }
  };

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const [tickets, cov] = await Promise.all([client.listSitTickets(canvasId), client.sitCoverage(canvasId)]);
      setEpics(tickets.epics);
      setSit(cov.tickets as Record<string, SitCov>);
      if (!canvasId) {
        setHint("Select a canvas in the explorer to scope coverage, showing your saved SIT results below.");
      } else if (!tickets.epics.length && Object.keys(cov.tickets).length) {
        setHint("Jira map empty on this canvas, showing tickets from saved SIT runs.");
      } else if (!tickets.epics.length && !Object.keys(cov.tickets).length) {
        setHint(tickets.note || "No Jira tickets or saved SIT runs for this canvas yet.");
      } else {
        setHint(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load coverage");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [client, canvasId]);

  const refreshJobs = useCallback(async () => {
    try {
      const list = await client.listSitJobs(canvasId);
      setJobs(list.items);
      for (const j of list.items) {
        if (!watchedJobs.current.has(j.id)) continue;
        if (j.status === "done") {
          watchedJobs.current.delete(j.id);
          const label = j.issueKey ? `${j.issueKey} ${j.kind === "reassess" ? "re-assessed" : "generated"}` : "SIT job finished";
          setJobToast(label);
          await refresh({ silent: true });
          setDrawerRefresh((n) => n + 1);
        } else if (j.status === "failed" || j.status === "cancelled") {
          watchedJobs.current.delete(j.id);
          setJobToast(j.error || `${j.issueKey || "Job"} ${j.status}`);
        }
      }
    } catch {
      /* ignore job poll errors */
    }
  }, [client, canvasId, refresh]);

  useEffect(() => {
    void refresh();
    void refreshJobs();
  }, [refresh, refreshJobs]);

  useEffect(() => {
    const pending = jobs.some((j) => j.status === "queued" || j.status === "running");
    if (!pending) return;
    const id = setInterval(() => void refreshJobs(), 2500);
    return () => clearInterval(id);
  }, [jobs, refreshJobs]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const m = await client.getSitModelStatus();
        if (cancelled) return;
        setModelInactive(m.state === "idle" || m.state === "unconfigured" || m.state === "down");
        setModelName(m.model);
      } catch {
        /* ignore probe failures */
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [client]);

  useEffect(() => {
    let cancelled = false;
    void client
      .getSitRiskRubric()
      .then((raw) => {
        if (!cancelled) setRubric(raw as RiskRubric);
      })
      .catch(() => {
        if (!cancelled) setRubric(null);
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  const rowsByEpic = useMemo(() => {
    const toRow = (key: string, name: string, s?: SitCov): Row => {
      const tests = s?.tests || 0;
      const byType = s?.byType || {};
      return {
        key,
        name,
        tests,
        byType,
        byPriority: s?.byPriority || {},
        bySeverity: s?.bySeverity || {},
        notAssessed: s?.notAssessed || 0,
        templateCases: s?.templateCases || 0,
        automationYes: s?.automationYes || 0,
        depth: testDepthPct(tests, byType),
        quality: qualityFromTypes(byType, tests),
        generator: s?.generator,
        updatedAt: s?.updatedAt ?? null,
        generatedAt: s?.generatedAt ?? s?.updatedAt ?? null,
        assessedAt: s?.assessedAt ?? null,
        workbookId: s?.workbookId,
      };
    };

    const fromJira = epics.map((e) => ({
      epic: e,
      tickets: e.tickets.map((t) => toRow(t.key, t.summary, sit[t.key])),
    }));

    const known = new Set(fromJira.flatMap((x) => x.tickets.map((t) => t.key)));
    const orphanKeys = Object.keys(sit).filter((k) => !known.has(k));
    if (!orphanKeys.length) return fromJira;

    return [
      ...fromJira,
      {
        epic: {
          key: "_saved",
          summary: "Saved SIT results",
          status: "",
          statusCategory: "done",
          ticketCount: orphanKeys.length,
          tickets: [],
        } as SitEpic,
        tickets: orphanKeys.map((key) => toRow(key, sit[key]?.summary || key, sit[key])),
      },
    ];
  }, [epics, sit]);

  const allFlat = useMemo(() => rowsByEpic.flatMap((x) => x.tickets), [rowsByEpic]);

  const timeline = useMemo(() => {
    const stamps = allFlat.map((t) => t.generatedAt).filter((x): x is number => !!x);
    if (!stamps.length) return null;
    const min = Math.min(...stamps);
    const max = Math.max(...stamps);
    return { min, max, single: min === max };
  }, [allFlat]);

  useEffect(() => {
    if (!timeline) {
      setRangeStart(null);
      setRangeEnd(null);
      return;
    }
    setRangeStart((prev) => (prev == null || freshPreset === "all" ? timeline.min : prev));
    setRangeEnd((prev) => (prev == null || freshPreset === "all" ? timeline.max : prev));
  }, [timeline, freshPreset]);

  const applyPresetWindow = (preset: FreshPreset) => {
    setCustomOpen(false);
    setIncludeNever(false);
    if (!timeline) {
      setFreshPreset(preset);
      return;
    }
    const now = Date.now();
    setFreshPreset(preset);
    if (preset === "all" || preset === "never") {
      setRangeStart(timeline.min);
      setRangeEnd(timeline.max);
      return;
    }
    if (preset === "fresh") {
      setRangeStart(Math.max(timeline.min, now - FRESH_MS));
      setRangeEnd(Math.min(timeline.max, now));
      return;
    }
    if (preset === "aging") {
      setRangeStart(Math.max(timeline.min, now - AGING_MS));
      setRangeEnd(Math.min(timeline.max, now - FRESH_MS));
      return;
    }
    if (preset === "stale") {
      setRangeStart(timeline.min);
      setRangeEnd(Math.min(timeline.max, now - AGING_MS));
    }
  };

  const setDraftRange = (start: number, end: number) => {
    setDraftStart(Math.min(start, end));
    setDraftEnd(Math.max(start, end));
  };

  const resetFreshness = () => {
    setFreshPreset("all");
    setIncludeNever(false);
    setCustomOpen(false);
    if (timeline) {
      setRangeStart(timeline.min);
      setRangeEnd(timeline.max);
    }
  };

  const openCustom = () => {
    if (customOpen) {
      setCustomOpen(false);
      return;
    }
    const start = freshPreset === "custom" && rangeStart != null ? rangeStart : (timeline?.min ?? null);
    const end = freshPreset === "custom" && rangeEnd != null ? rangeEnd : (timeline?.max ?? null);
    setDraftStart(start);
    setDraftEnd(end);
    setDraftNever(freshPreset === "custom" ? includeNever : false);
    setPrioInfoOpen(false);
    setCustomOpen(true);
  };

  const applyCustom = () => {
    if (draftStart != null && draftEnd != null) {
      setRangeStart(Math.min(draftStart, draftEnd));
      setRangeEnd(Math.max(draftStart, draftEnd));
    }
    setIncludeNever(draftNever);
    setFreshPreset("custom");
    setCustomOpen(false);
  };

  const closeCustom = useCallback(() => setCustomOpen(false), []);
  const closeDepthInfo = useCallback(() => setDepthInfoOpen(false), []);
  const closeQualityInfo = useCallback(() => setQualityInfoOpen(false), []);
  const closePrioInfo = useCallback(() => setPrioInfoOpen(false), []);

  const jobForTicket = useCallback(
    (key: string) =>
      jobs.find(
        (j) =>
          j.issueKey === key && (j.status === "queued" || j.status === "running"),
      ),
    [jobs],
  );

  const cancelJob = async (id: string) => {
    try {
      await client.cancelSitJob(id);
      await refreshJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancel failed");
    }
  };

  const dismissJob = async (id: string) => {
    try {
      await client.dismissSitJob(id);
      await refreshJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dismiss failed");
    }
  };

  const dismissAllFailedJobs = async () => {
    try {
      await client.dismissAllSitFailedJobs(canvasId);
      await refreshJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dismiss failed");
    }
  };

  const modelOffTitle = modelInactive ? "Model is not running" : undefined;

  const filteredRowsByEpic = useMemo(() => {
    return rowsByEpic
      .map(({ epic, tickets }) => ({
        epic,
        tickets: tickets.filter((t) => {
          if (typeFilter.size && ![...typeFilter].some((ty) => (t.byType[ty] || 0) > 0)) return false;

          if (freshPreset === "all") return true;
          if (freshPreset === "never") return !t.generatedAt;

          if (!t.generatedAt) return includeNever;

          if (freshPreset === "custom") {
            if (rangeStart == null || rangeEnd == null) return true;
            return t.generatedAt >= rangeStart && t.generatedAt <= rangeEnd;
          }

          const key = freshnessOf(t.generatedAt).key;
          return key === freshPreset;
        }),
      }))
      .filter((x) => x.tickets.length > 0);
  }, [rowsByEpic, typeFilter, freshPreset, includeNever, rangeStart, rangeEnd]);

  const flat = filteredRowsByEpic.flatMap((x) => x.tickets);
  const overall = flat.length ? Math.round(flat.reduce((n, t) => n + t.depth, 0) / flat.length) : 0;
  const missing = allFlat.filter((t) => !t.tests).map((t) => t.key);
  const covered = flat.filter((t) => t.tests > 0).length;
  const totalCases = flat.reduce((n, t) => n + t.tests, 0);
  const templateCovered = flat.filter((t) => t.templateCases > 0 && t.templateCases === t.tests).length;
  const neverCount = flat.filter((t) => freshnessOf(t.generatedAt).key === "never").length;
  const staleCount = flat.filter((t) => freshnessOf(t.generatedAt).key === "stale").length;

  const matrixMax = useMemo(() => {
    let m = 1;
    for (const t of flat) {
      for (const ty of DEPTH_TYPES) m = Math.max(m, t.byType[ty] || 0);
    }
    return m;
  }, [flat]);

  const columnTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const ty of DEPTH_TYPES) {
      totals[ty] = flat.reduce((n, t) => n + (t.byType[ty] || 0), 0);
    }
    return totals;
  }, [flat]);

  const matrixGaps = useMemo(() => {
    let gaps = 0;
    for (const t of flat) {
      if (!t.tests) continue;
      for (const ty of DEPTH_TYPES) {
        if (!(t.byType[ty] || 0)) gaps += 1;
      }
    }
    return gaps;
  }, [flat]);

  const ticketCountWithType = (ty: string) => allFlat.filter((t) => (t.byType[ty] || 0) > 0).length;

  const toggleType = (ty: string) => {
    setTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(ty)) next.delete(ty);
      else next.add(ty);
      return next;
    });
  };

  const generateKeys = async (keys: string[]) => {
    if (!keys.length || modelInactive) return;
    setError(null);
    try {
      const { jobs: created } = await client.enqueueSitGenerateJobs({ issueKeys: keys, canvasId });
      for (const j of created) watchedJobs.current.add(j.id);
      await refreshJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generate failed");
    }
  };

  const startReassessJob = async (workbookId: string, ticketKey: string) => {
    if (modelInactive) return;
    const { jobs: created } = await client.enqueueSitReassessJobs({
      workbookId,
      issueKeys: [ticketKey],
      canvasId,
    });
    for (const j of created) watchedJobs.current.add(j.id);
    await refreshJobs();
  };

  const missingGenerateJobs = useMemo(
    () =>
      jobs.filter(
        (j) =>
          j.kind === "generate" &&
          j.issueKey &&
          missing.includes(j.issueKey) &&
          (j.status === "queued" || j.status === "running"),
      ),
    [jobs, missing],
  );

  const viewCases = async (row: Row, testType?: string) => {
    if (onOpenSit && row.workbookId) {
      onOpenSit({ workbookId: row.workbookId, ticketKey: row.key, testType });
      return;
    }
    if (!row.workbookId) return;
    setPreviewBusy(true);
    try {
      setPreview(await client.getSitWorkbook(row.workbookId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open workbook");
    } finally {
      setPreviewBusy(false);
    }
  };

  const openDrawer = (row: Row, showRubric = false) => {
    if (!row.workbookId) return;
    setPrioInfoOpen(false);
    setCustomOpen(false);
    setDrawer({
      workbookId: row.workbookId,
      ticketKey: row.key,
      ticketName: row.name,
      showRubric,
    });
  };

  const rubricRow = flat.find((t) => t.workbookId) || allFlat.find((t) => t.workbookId);

  const rangeChipLabel =
    rangeStart != null && rangeEnd != null
      ? `${formatLocalTs(rangeStart)} to ${formatLocalTs(rangeEnd)}`
      : null;

  const sameGeneration = !timeline || timeline.max - timeline.min < HOUR_MS;
  const priorityDef =
    rubric?.priority?.definition ||
    "Priority is how urgently the test should be run: likelihood, usage frequency, and business criticality.";
  const severityDef =
    rubric?.severity?.definition ||
    "Severity is the impact if the test fails: how bad the outcome is for users, data, money, or compliance.";
  const priorityFloor = rubric?.priority?.floor || "Priority is never more than one band below severity.";
  const assignedBy = modelName || "the model";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 border-b border-[#EEE] px-6 py-3 text-[12px] text-[#5E6066] dark:border-[#1a1a1a] dark:text-[#9ca3af]">
        <span className="flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 rounded-full bg-[#22C55E]" /> Well covered (80-100%)
        </span>
        <span className="flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 rounded-full bg-[#EAB308]" /> Partial (40-79%)
        </span>
        <span className="flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 rounded-full bg-[#EF4444]" /> Low (&lt;40%)
        </span>
        <span className="ml-auto flex items-center gap-3">
          {modelInactive ? (
            <span
              title="Hugging Face endpoint is paused or scaled to zero"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#fecaca] bg-[#fff5f5] px-2.5 py-0.5 text-[11px] font-medium text-[#b91c1c]"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#ef4444]" />
              Model inactive
            </span>
          ) : null}
          <button
            type="button"
            disabled={!missing.length || modelInactive}
            title={modelInactive ? "Model is not running" : undefined}
            onClick={() => void generateKeys(missing)}
            className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#8664F2] px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-40"
          >
            {missingGenerateJobs.length ? (
              <TbLoader2 className="animate-spin" size={14} />
            ) : (
              <TbSparkles size={14} />
            )}
            {missing.length
              ? missingGenerateJobs.length
                ? `Generating missing (${missingGenerateJobs.length}/${missing.length})`
                : `Generate missing (${missing.length})`
              : "All tickets covered"}
          </button>
          {missingGenerateJobs.length ? (
            <button
              type="button"
              className="text-[12px] text-[#8664F2]"
              onClick={() => {
                const first = missingGenerateJobs[0];
                if (first) void cancelJob(first.id);
              }}
            >
              Cancel queue
            </button>
          ) : null}
        </span>
      </header>

      {error && (
        <div className="mx-6 mt-3 rounded-[8px] border border-[#f5c2c7] bg-[#fff5f5] px-3 py-2 text-[12.5px] text-[#b42318]">
          {error}
        </div>
      )}
      {jobToast ? (
        <div className="mx-6 mt-3 flex items-center justify-between rounded-[8px] border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-2 text-[12.5px] text-[#166534]">
          <span>{jobToast}</span>
          <button type="button" className="text-[#166534]" onClick={() => setJobToast(null)}>
            <TbX size={14} />
          </button>
        </div>
      ) : null}
      {hint && !error && (
        <div className="mx-6 mt-3 rounded-[8px] border border-[#e2e6ef] bg-[#f8f9fc] px-3 py-2 text-[12.5px] text-[#5b647a]">
          {hint}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center gap-2 text-[13px] text-[#8a93a8]">
            <TbLoader2 className="animate-spin" /> Loading coverage…
          </div>
        ) : !allFlat.length ? (
          <p className="text-[13px] text-[#8a93a8]">
            No saved SIT coverage yet. Open a Jira-connected canvas, generate on SIT Testing, then return here.
          </p>
        ) : (
          <>
            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[
                { label: "Total cases", value: String(totalCases), tip: undefined as string | undefined },
                {
                  label: "Tickets covered",
                  value: `${covered}/${flat.length}`,
                  tip: templateCovered
                    ? `${covered} covered · ${templateCovered} template (test depth based on template cases)`
                    : `${covered} covered with model or assessed cases`,
                },
                { label: "Overall test depth", value: `${overall}%`, tip: undefined },
                { label: "Never generated", value: String(neverCount), tip: undefined },
                { label: `Stale (>${AGING_DAYS}d)`, value: String(staleCount), tip: undefined },
              ].map((c) => (
                <div
                  key={c.label}
                  title={c.tip}
                  className="rounded-[10px] border border-[#e2e6ef] bg-white px-4 py-3 dark:border-[#1a1a1a] dark:bg-[#101010]"
                >
                  <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[#9ca3af]">{c.label}</div>
                  <div className="mt-1 text-[20px] font-semibold tabular-nums text-[#1F1F1F] dark:text-[#ededed]">
                    {c.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">Type</span>
              {DEPTH_TYPES.map((t) => {
                const on = typeFilter.has(t);
                const tickets = ticketCountWithType(t);
                const cases = allFlat.reduce((n, row) => n + (row.byType[t] || 0), 0);
                return (
                  <button
                    key={t}
                    type="button"
                    disabled={!tickets}
                    title={`${cases} cases across ${tickets} tickets`}
                    onClick={() => toggleType(t)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-30 ${
                      on ? TYPE_CHIP[t] : "border-[#e5e7eb] bg-white text-[#6b7280]"
                    }`}
                  >
                    {t} ({tickets} tickets)
                  </button>
                );
              })}
              {typeFilter.size > 0 && (
                <button type="button" className="text-[11px] text-[#8664F2]" onClick={() => setTypeFilter(new Set())}>
                  Clear types
                </button>
              )}
              <span className="mx-1 hidden h-4 w-px bg-[#e5e7eb] sm:inline-block" />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">Freshness</span>
              {(
                [
                  ["all", "All"],
                  ["fresh", "Fresh"],
                  ["aging", "Aging"],
                  ["stale", "Stale"],
                  ["never", "Never"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => applyPresetWindow(id)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                    freshPreset === id
                      ? "border-[#8664F2] bg-[#F4EFFE] text-[#5B3FD1]"
                      : "border-[#e5e7eb] bg-white text-[#6b7280]"
                  }`}
                >
                  {label}
                </button>
              ))}
              <button
                ref={customBtnRef}
                type="button"
                onClick={openCustom}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                  freshPreset === "custom" || customOpen
                    ? "border-[#8664F2] bg-[#F4EFFE] text-[#5B3FD1]"
                    : "border-[#e5e7eb] bg-white text-[#6b7280]"
                }`}
              >
                Custom
              </button>
              <button type="button" className="text-[11px] text-[#8664F2]" onClick={resetFreshness}>
                Reset
              </button>
              {freshPreset === "custom" && rangeChipLabel ? (
                <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#c4b5fd] bg-[#F4EFFE] px-2.5 py-1 text-[11px] text-[#5B3FD1]">
                  <span className="truncate">
                    {rangeChipLabel}
                    {includeNever ? " · includes never generated" : ""}
                  </span>
                  <button type="button" aria-label="Clear range" onClick={resetFreshness}>
                    <TbX size={12} />
                  </button>
                </span>
              ) : null}
            </div>
            <AnchoredPopover open={customOpen} anchorRef={customBtnRef} onClose={closeCustom} width={360}>
              <div className="space-y-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">Custom range</div>
                {timeline && !sameGeneration ? (
                  <div className="px-1 pt-1">
                    <div className="relative h-8">
                      <div className="absolute left-0 right-0 top-[14px] h-1 rounded-full bg-[#E5E7EB]" />
                      <div
                        className="absolute top-[14px] h-1 rounded-full bg-[#8664F2]/50"
                        style={{
                          left: `${(((draftStart ?? timeline.min) - timeline.min) / (timeline.max - timeline.min || 1)) * 100}%`,
                          right: `${(1 - ((draftEnd ?? timeline.max) - timeline.min) / (timeline.max - timeline.min || 1)) * 100}%`,
                        }}
                      />
                      <input
                        type="range"
                        min={timeline.min}
                        max={timeline.max}
                        step={60_000}
                        value={Math.min(timeline.max, Math.max(timeline.min, draftStart ?? timeline.min))}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setDraftRange(v, Math.max(v, draftEnd ?? timeline.max));
                        }}
                        className="pointer-events-none absolute inset-x-0 top-2 h-4 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#8664F2]"
                      />
                      <input
                        type="range"
                        min={timeline.min}
                        max={timeline.max}
                        step={60_000}
                        value={Math.min(timeline.max, Math.max(timeline.min, draftEnd ?? timeline.max))}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setDraftRange(Math.min(v, draftStart ?? timeline.min), v);
                        }}
                        className="pointer-events-none absolute inset-x-0 top-2 h-4 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#5B3FD1]"
                      />
                    </div>
                  </div>
                ) : timeline ? (
                  <p className="text-[11px] text-[#8a93a8]">All runs were generated at the same time</p>
                ) : (
                  <p className="text-[11px] text-[#8a93a8]">No generation timestamps yet to build a date range.</p>
                )}
                <div className="flex flex-wrap items-end gap-3">
                  <label className="text-[11px] text-[#5b647a]">
                    From
                    <input
                      type="datetime-local"
                      className="mt-1 block rounded border border-[#e2e6ef] px-2 py-1 text-[12px] dark:border-[#2a2a2a] dark:bg-[#0a0a0a]"
                      value={draftStart != null ? toDatetimeLocal(draftStart) : ""}
                      onChange={(e) => {
                        const v = fromDatetimeLocal(e.target.value);
                        if (v == null) return;
                        setDraftRange(v, draftEnd ?? v);
                      }}
                    />
                  </label>
                  <label className="text-[11px] text-[#5b647a]">
                    To
                    <input
                      type="datetime-local"
                      className="mt-1 block rounded border border-[#e2e6ef] px-2 py-1 text-[12px] dark:border-[#2a2a2a] dark:bg-[#0a0a0a]"
                      value={draftEnd != null ? toDatetimeLocal(draftEnd) : ""}
                      onChange={(e) => {
                        const v = fromDatetimeLocal(e.target.value);
                        if (v == null) return;
                        setDraftRange(draftStart ?? v, v);
                      }}
                    />
                  </label>
                </div>
                <label className="inline-flex items-center gap-1.5 text-[11px] text-[#5b647a]">
                  <input
                    type="checkbox"
                    checked={draftNever}
                    onChange={(e) => setDraftNever(e.target.checked)}
                    className="rounded border-[#cfd5e3]"
                  />
                  Include never generated
                </label>
                <div className="flex justify-end gap-2">
                  <button type="button" className="rounded-[6px] px-2.5 py-1 text-[11px] text-[#5b647a]" onClick={closeCustom}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="rounded-[6px] bg-[#8664F2] px-2.5 py-1 text-[11px] font-medium text-white"
                    onClick={applyCustom}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </AnchoredPopover>

            {/* Ticket × type matrix */}
            <div className="mb-5 overflow-hidden rounded-[10px] border border-[#e2e6ef] bg-white dark:border-[#1a1a1a] dark:bg-[#101010]">
              <button
                type="button"
                onClick={() => persistMatrixCollapsed(!matrixCollapsed)}
                className="flex w-full items-center gap-2 border-b border-[#eef0f5] px-4 py-3 text-left text-[12px] font-semibold text-[#1F1F1F] dark:border-[#1a1a1a] dark:text-[#ededed]"
              >
                {matrixCollapsed ? <TbChevronRight size={16} /> : <TbChevronDown size={16} />}
                Test depth matrix
                <span className="ml-2 text-[11px] font-normal text-[#8a93a8]">
                  {matrixCollapsed
                    ? `${covered} of ${flat.length} tickets covered, ${totalCases} cases, ${matrixGaps} gaps`
                    : "click a type header to filter · click a cell to open cases in SIT"}
                </span>
              </button>
              <div
                className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                  matrixCollapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]"
                }`}
              >
                <div className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] border-collapse text-[12px]">
                      <thead>
                        <tr className="border-b border-[#E5E7EB] dark:border-[#2a2a2a]">
                          <th className={`${th} sticky left-0 bg-white dark:bg-[#101010]`}>Ticket</th>
                          {DEPTH_TYPES.map((t) => (
                            <th key={t} className={th}>
                              <button
                                type="button"
                                onClick={() => toggleType(t)}
                                className={`rounded px-1 py-0.5 ${typeFilter.has(t) ? "bg-[#F4EFFE] text-[#5B3FD1]" : "hover:text-[#8664F2]"}`}
                                title={`Filter tickets with ${t}`}
                              >
                                {t}
                              </button>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRowsByEpic.map(({ epic, tickets }) => (
                          <Fragment key={`m-${epic.key}`}>
                            <tr className="border-b border-[#E6E1F5] bg-[#F4EFFE]/50 dark:border-[#2a2440] dark:bg-[#1e1a2e]/50">
                              <td
                                className="sticky left-0 bg-[#F4EFFE]/90 px-3 py-2 font-semibold dark:bg-[#1e1a2e]"
                                colSpan={1 + DEPTH_TYPES.length}
                              >
                                <span className="inline-flex items-center gap-2">
                                  <EpicIcon />
                                  {epic.key.startsWith("_") ? epic.summary : `${epic.key} · ${epic.summary}`}
                                </span>
                              </td>
                            </tr>
                            {tickets.map((t) => {
                              const never = !t.tests;
                              return (
                                <tr key={`m-${t.key}`} className="border-b border-[#EEE] dark:border-[#1a1a1a]">
                                  <td className="sticky left-0 bg-white px-3 py-2 dark:bg-[#101010]">
                                    <span className="inline-flex items-center gap-2">
                                      <StoryIcon />
                                      <span className="font-semibold text-[#2563EB]">{t.key}</span>
                                      <span
                                        className={`truncate ${never ? "text-[#9ca3af]" : "text-[#1F1F1F] dark:text-[#ededed]"}`}
                                      >
                                        {t.name}
                                      </span>
                                    </span>
                                  </td>
                                  {DEPTH_TYPES.map((ty) => {
                                    const n = t.byType[ty] || 0;
                                    if (never) {
                                      return (
                                        <td key={ty} className="px-2 py-2 text-center text-[#d1d5db]">
                                          -
                                        </td>
                                      );
                                    }
                                    const gap = n === 0;
                                    return (
                                      <td key={ty} className="px-1.5 py-1.5 text-center">
                                        <button
                                          type="button"
                                          disabled={!t.workbookId}
                                          onClick={() => void viewCases(t, ty)}
                                          className={`mx-auto flex h-7 w-10 items-center justify-center rounded text-[11px] font-semibold tabular-nums ${
                                            gap
                                              ? "border border-[#f5c2c7] bg-[#fff5f5] text-[#b91c1c]"
                                              : matrixShade(n, matrixMax)
                                          } disabled:cursor-default`}
                                          title={gap ? `${ty} gap` : `${ty}: ${n} cases, open in SIT`}
                                        >
                                          {gap ? "·" : n}
                                        </button>
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </Fragment>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-[#E5E7EB] bg-[#F8F9FB] dark:border-[#2a2a2a] dark:bg-[#141414]">
                          <td className="sticky left-0 bg-[#F8F9FB] px-3 py-2 text-[11px] font-semibold dark:bg-[#141414]">
                            Column total
                          </td>
                          {DEPTH_TYPES.map((ty) => (
                            <td key={ty} className="px-2 py-2 text-center text-[11px] font-semibold tabular-nums">
                              {columnTotals[ty] || 0}
                            </td>
                          ))}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            <table className="w-full min-w-[1100px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-[#E5E7EB] dark:border-[#2a2a2a]">
                  <th className={th}>Epic / Ticket</th>
                  <th className={th}>SIT cases</th>
                  <th className={th}>Types</th>
                  <th className={th}>
                    <span className="inline-flex items-center gap-1">
                      Test depth
                      <button
                        ref={depthInfoRef}
                        type="button"
                        className="text-[#8664F2]"
                        title="How test depth is calculated"
                        aria-expanded={depthInfoOpen}
                        onClick={() => {
                          setQualityInfoOpen(false);
                          setPrioInfoOpen(false);
                          setCustomOpen(false);
                          setDepthInfoOpen((v) => !v);
                        }}
                      >
                        <TbInfoCircle size={14} />
                      </button>
                    </span>
                    <AnchoredPopover open={depthInfoOpen} anchorRef={depthInfoRef} onClose={closeDepthInfo} width={360}>
                      <p>
                        <b>Test depth</b> measures suite richness, not requirements coverage:{" "}
                        <code>
                          round(40 × min(1, cases/{CASE_TARGET}) + 60 × (types_present/{TYPE_COUNT}))
                        </code>
                        . Types counted: {DEPTH_TYPES.join(", ")}. Security is excluded.
                      </p>
                      <p className="mt-2">
                        Examples: DW-6 (7 cases, 5 types) → <b>85%</b>; DW-8 (10 cases, 5 types) → <b>90%</b>. Epic and
                        overall scores average ticket scores.
                      </p>
                    </AnchoredPopover>
                  </th>
                  <th className={th}>
                    <span className="inline-flex items-center gap-1">
                      Quality
                      <button
                        ref={qualityInfoRef}
                        type="button"
                        className="text-[#8664F2]"
                        title="How quality is calculated"
                        aria-expanded={qualityInfoOpen}
                        onClick={() => {
                          setDepthInfoOpen(false);
                          setPrioInfoOpen(false);
                          setCustomOpen(false);
                          setQualityInfoOpen((v) => !v);
                        }}
                      >
                        <TbInfoCircle size={14} />
                      </button>
                    </span>
                    <AnchoredPopover
                      open={qualityInfoOpen}
                      anchorRef={qualityInfoRef}
                      onClose={closeQualityInfo}
                      width={360}
                    >
                      <p>
                        <b>Quality</b> ={" "}
                        <code>
                          round(50 × min(1, cases/{CASE_TARGET}) + 50 × (types_present/{TYPE_COUNT}))
                        </code>
                        . Missing any of the 6 depth types keeps the score below 100 (e.g. 5/6 types → max 92). Separate
                        from Test depth.
                      </p>
                    </AnchoredPopover>
                  </th>
                  <th className={th}>Last generated</th>
                  <th className={th}>Freshness</th>
                  <th className={th}>Automation</th>
                  <th className={th}>
                    <span className="inline-flex flex-wrap items-center gap-1">
                      Prio / Sev
                      <BetaBadge />
                      <button
                        ref={prioInfoRef}
                        type="button"
                        className="text-[#8664F2]"
                        title="Priority and Severity meaning"
                        aria-expanded={prioInfoOpen}
                        onClick={() => {
                          setCustomOpen(false);
                          setPrioInfoOpen((v) => !v);
                        }}
                      >
                        <TbInfoCircle size={14} />
                      </button>
                      <span className="inline-flex overflow-hidden rounded-full border border-[#e5e7eb] normal-case tracking-normal">
                        <button
                          type="button"
                          onClick={() => persistPrioSevView("bars")}
                          className={`px-2 py-0.5 text-[10px] font-semibold ${
                            prioSevView === "bars" ? "bg-[#F4EFFE] text-[#5B3FD1]" : "bg-white text-[#6b7280]"
                          }`}
                        >
                          Bars
                        </button>
                        <button
                          type="button"
                          onClick={() => persistPrioSevView("numbers")}
                          className={`px-2 py-0.5 text-[10px] font-semibold ${
                            prioSevView === "numbers" ? "bg-[#F4EFFE] text-[#5B3FD1]" : "bg-white text-[#6b7280]"
                          }`}
                        >
                          Numbers
                        </button>
                      </span>
                    </span>
                    <AnchoredPopover open={prioInfoOpen} anchorRef={prioInfoRef} onClose={closePrioInfo} width={360}>
                      <p>
                        <b>Priority.</b> {priorityDef}
                      </p>
                      <p className="mt-1">
                        <b>Severity.</b> {severityDef}
                      </p>
                      <p className="mt-1">{priorityFloor}</p>
                      <p className="mt-2">
                        Assigned by {assignedBy} using the rubric, then checked against rule signals.
                      </p>
                      <p className="mt-2 text-[#6b7280]">{BETA_TIP}</p>
                      <button
                        type="button"
                        className="mt-2 text-[12px] font-medium text-[#8664F2] disabled:opacity-40"
                        disabled={!rubricRow?.workbookId}
                        title={rubricRow?.workbookId ? "Open the full rubric" : "Generate cases to open the full rubric"}
                        onClick={() => {
                          if (rubricRow) openDrawer(rubricRow, true);
                        }}
                      >
                        View full rubric
                      </button>
                    </AnchoredPopover>
                  </th>
                  <th className={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRowsByEpic.map(({ epic, tickets }) => {
                  const tests = tickets.reduce((n, t) => n + t.tests, 0);
                  const depth = tickets.length
                    ? Math.round(tickets.reduce((n, t) => n + t.depth, 0) / tickets.length)
                    : 0;
                  const q = tickets.length
                    ? Math.round(tickets.reduce((n, t) => n + t.quality, 0) / tickets.length)
                    : 0;
                  const b = band(depth);
                  const generated = tickets.filter((t) => t.generatedAt);
                  const oldest = generated.length ? Math.min(...generated.map((t) => t.generatedAt!)) : null;
                  const oldestTicket = generated.length
                    ? generated.reduce((a, c) => ((a.generatedAt! <= c.generatedAt!) ? a : c))
                    : null;
                  const epicFresh = freshnessOf(oldest);
                  const autoSum = tickets.reduce((n, t) => n + t.automationYes, 0);
                  const epicHasCases = tests > 0;
                  return (
                    <Fragment key={epic.key}>
                      <tr className="border-b border-[#E6E1F5] bg-[#F4EFFE]/60 dark:border-[#2a2440] dark:bg-[#1e1a2e]/60">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2 font-semibold text-[#1F1F1F] dark:text-[#ededed]">
                            <EpicIcon />
                            <span className="shrink-0 text-[12px] text-[#8664F2]">
                              {epic.key.startsWith("_") ? "-" : epic.key}
                            </span>
                            <span className="truncate">{epic.summary}</span>
                            <span className="shrink-0 text-[10.5px] font-medium text-[#7E7E7E]">
                              {tickets.length} tickets
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3 font-semibold">{tests || "-"}</td>
                        <td className="px-3 py-3 text-[#7E7E7E]">-</td>
                        <td className="px-3 py-3">
                          <div className="w-[120px]">
                            <div className="h-[6px] overflow-hidden rounded-full bg-[#E5E7EB] dark:bg-[#2a2a2a]">
                              <div className={`h-full ${b.bar}`} style={{ width: `${depth}%` }} />
                            </div>
                            <div className="mt-1 text-[10.5px] text-[#7E7E7E]">{depth}%</div>
                          </div>
                        </td>
                        <td className={`px-3 py-3 font-semibold ${band(q).text}`}>{epicHasCases ? `${q}/100` : "-"}</td>
                        <td className="px-3 py-3 text-[11px] text-[#7E7E7E]">
                          {oldest ? (
                            <Tip text={generatedTip(oldest)}>
                              <span title={oldestTicket ? `Oldest: ${oldestTicket.key}` : undefined}>
                                {agoShort(oldest)}
                              </span>
                            </Tip>
                          ) : (
                            <Tip text="Never generated">
                              <span>never</span>
                            </Tip>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <Tip text={epicFreshnessTip(tickets)}>
                            <span className={`inline-flex items-center gap-1.5 text-[11px] ${epicFresh.className}`}>
                              <i className={`h-2 w-2 rounded-full ${epicFresh.dot}`} />
                              {epicFresh.label}
                            </span>
                          </Tip>
                        </td>
                        <td className="px-3 py-3">{epicHasCases ? autoSum : "-"}</td>
                        <td className="px-3 py-3 text-[11px] text-[#7E7E7E]">-</td>
                        <td className="px-3 py-3 text-[11px] text-[#7E7E7E]">roll-up</td>
                      </tr>
                      {tickets.map((t) => {
                        const tb = band(t.depth);
                        const fr = freshnessOf(t.generatedAt);
                        const same = prioSevMapsEqual(t.byPriority, t.bySeverity);
                        const ticketJob = jobForTicket(t.key);
                        const assessing =
                          ticketJob?.progress?.stage === "assessing" ||
                          (ticketJob?.kind === "reassess" && ticketJob.status === "running");
                        const templateOnly = t.tests > 0 && t.templateCases === t.tests;
                        return (
                          <tr key={t.key} className="border-b border-[#EEE] hover:bg-[#F8F9FB] dark:border-[#1a1a1a] dark:hover:bg-[#101010]">
                              <td className="px-3 py-3 pl-8">
                                <div className="flex items-center gap-2 font-medium text-[#1F1F1F] dark:text-[#ededed]">
                                  <StoryIcon />
                                  <i className={`h-2 w-2 shrink-0 rounded-full ${tb.dot}`} title={`Test depth ${t.depth}%`} />
                                  <span className="shrink-0 text-[12px] font-semibold text-[#2563EB]">{t.key}</span>
                                  <span className="truncate">{t.name}</span>
                                  {templateOnly ? (
                                    <Tip text="Test depth for this ticket is based on template cases">
                                      <span className="shrink-0 rounded border border-[#D1D5DB] bg-[#F3F4F6] px-1.5 py-0.5 text-[10px] font-semibold text-[#4B5563]">
                                        Template
                                      </span>
                                    </Tip>
                                  ) : null}
                                </div>
                              </td>
                              <td className="px-3 py-3">{t.tests || "-"}</td>
                              <td className="px-3 py-3">
                                <div className="flex max-w-[220px] flex-wrap gap-1">
                                  {DEPTH_TYPES.some((ty) => t.byType[ty])
                                    ? DEPTH_TYPES.filter((ty) => t.byType[ty]).map((k) => (
                                        <span
                                          key={k}
                                          className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${TYPE_CHIP[k]}`}
                                        >
                                          {k} {t.byType[k]}
                                        </span>
                                      ))
                                    : "-"}
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                <div className="w-[120px]">
                                  <div className="h-[6px] overflow-hidden rounded-full bg-[#E5E7EB] dark:bg-[#2a2a2a]">
                                    <div className={`h-full ${tb.bar}`} style={{ width: `${t.depth}%` }} />
                                  </div>
                                  <div className="mt-1 text-[10.5px] text-[#7E7E7E]">{t.depth}%</div>
                                </div>
                              </td>
                              <td
                                className={`px-3 py-3 font-semibold ${t.tests ? band(t.quality).text : "text-[#9ca3af]"}`}
                                title={
                                  t.tests
                                    ? `Quality = 50% volume + 50% type breadth (${typesPresent(t.byType)}/${TYPE_COUNT} types)`
                                    : undefined
                                }
                              >
                                {t.tests ? `${t.quality}/100` : "-"}
                              </td>
                              <td className="px-3 py-3 text-[11px] text-[#7E7E7E]">
                                <Tip text={generatedTip(t.generatedAt)}>
                                  <span>{agoShort(t.generatedAt)}</span>
                                </Tip>
                              </td>
                              <td className="px-3 py-3">
                                <Tip text={freshnessTip(t.generatedAt)}>
                                  <span className={`inline-flex items-center gap-1.5 text-[11px] ${fr.className}`}>
                                    <i className={`h-2 w-2 rounded-full ${fr.dot}`} />
                                    {fr.label}
                                  </span>
                                </Tip>
                              </td>
                              <td className="px-3 py-3">{t.tests ? t.automationYes : "-"}</td>
                              <td className="px-3 py-3">
                                {assessing ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-[#8664F2]">
                                    <TbLoader2 className="animate-spin" size={12} />
                                    {ticketJob?.progress?.caseTotal
                                      ? `${ticketJob.kind === "reassess" ? "Re-assessing" : "Assessing"} ${ticketJob.progress.caseIndex ?? 0} of ${ticketJob.progress.caseTotal}`
                                      : ticketJob?.progress?.message ||
                                        (ticketJob?.kind === "reassess" ? "Re-assessing" : "Assessing")}
                                  </span>
                                ) : t.tests && t.notAssessed && !t.byPriority?.High && !t.byPriority?.Medium && !t.byPriority?.Low ? (
                                  <div className="flex flex-col gap-1">
                                    <span className="text-[11px] text-[#b42318]">Not assessed</span>
                                    <button
                                      type="button"
                                      className="text-left text-[11px] font-medium text-[#8664F2] hover:underline disabled:opacity-40"
                                      disabled={!t.workbookId || modelInactive}
                                      title={modelOffTitle}
                                      onClick={() => t.workbookId && void startReassessJob(t.workbookId, t.key)}
                                    >
                                      Retry
                                    </button>
                                  </div>
                                ) : t.tests ? (
                                  <button
                                    type="button"
                                    title={
                                      t.notAssessed
                                        ? `${prioSevTip(t)}\n${t.notAssessed} case(s) not assessed yet`
                                        : prioSevTip(t)
                                    }
                                    disabled={!t.workbookId}
                                    onClick={() => openDrawer(t)}
                                    className="text-left disabled:cursor-default"
                                  >
                                    {prioSevView === "numbers" ? (
                                      <span className="block max-w-[260px] text-[11px] leading-snug tabular-nums text-[#5b647a]">
                                        {prioSevNumbersLines(t).map((line) => (
                                          <span key={line} className="block">
                                            {line}
                                          </span>
                                        ))}
                                      </span>
                                    ) : same ? (
                                      <SegmentBar map={t.byPriority} label="Prio / Sev" notAssessed={t.notAssessed} />
                                    ) : (
                                      <div className="flex flex-col gap-1">
                                        <SegmentBar map={t.byPriority} label="Prio" notAssessed={t.notAssessed} />
                                        <SegmentBar map={t.bySeverity} label="Sev" notAssessed={t.notAssessed} />
                                      </div>
                                    )}
                                  </button>
                                ) : (
                                  "-"
                                )}
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex flex-wrap items-center gap-1">
                                  {ticketJob ? (
                                    <>
                                      <span className="inline-flex items-center gap-1 text-[11px] text-[#5b647a]">
                                        <TbLoader2 className="animate-spin text-[#8664F2]" size={12} />
                                        {ticketJob.progress?.stage === "queued" && ticketJob.progress.queuePosition
                                          ? `Queued #${ticketJob.progress.queuePosition}`
                                          : ticketJob.progress?.message || ticketJob.progress?.stage || "Working"}
                                      </span>
                                      <button
                                        type="button"
                                        className="rounded-[6px] border border-[#e2e6ef] px-2 py-1 text-[11px] text-[#b42318]"
                                        onClick={() => void cancelJob(ticketJob.id)}
                                      >
                                        Cancel
                                      </button>
                                    </>
                                  ) : t.tests ? (
                                    <>
                                      <button
                                        type="button"
                                        disabled={previewBusy}
                                        onClick={() => void viewCases(t)}
                                        className="rounded-[6px] border border-[#e2e6ef] px-2 py-1 text-[11px] text-[#5b647a] hover:border-[#8664F2] hover:text-[#8664F2]"
                                      >
                                        View cases
                                      </button>
                                      <button
                                        type="button"
                                        disabled={modelInactive}
                                        title={modelOffTitle}
                                        onClick={() => void generateKeys([t.key])}
                                        className="rounded-[6px] bg-[#8664F2] px-2 py-1 text-[11px] font-medium text-white disabled:opacity-40"
                                      >
                                        Regenerate
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={modelInactive}
                                      title={modelOffTitle}
                                      onClick={() => void generateKeys([t.key])}
                                      className="rounded-[6px] bg-[#8664F2] px-2 py-1 text-[11px] font-medium text-white disabled:opacity-40"
                                    >
                                      Generate
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>

      {drawer ? (
        <SitCaseDrawer
          client={client}
          workbookId={drawer.workbookId}
          ticketKey={drawer.ticketKey}
          ticketName={drawer.ticketName}
          modelInactive={modelInactive}
          canvasId={canvasId}
          showRubric={drawer.showRubric}
          refreshToken={drawerRefresh}
          reassessJob={jobForTicket(drawer.ticketKey) ?? null}
          onStartReassess={startReassessJob}
          onClose={() => setDrawer(null)}
          onChanged={() => void refresh({ silent: true })}
        />
      ) : null}

      <SitJobsChip
        jobs={jobs}
        onCancel={(id) => void cancelJob(id)}
        onDismiss={(id) => void dismissJob(id)}
        onDismissAll={() => void dismissAllFailedJobs()}
      />

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPreview(null)}>
          <div
            className="max-h-[80vh] w-full max-w-3xl overflow-auto rounded-[12px] bg-white p-4 shadow-xl dark:bg-[#101010]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[14px] font-semibold">Saved cases · {preview.sourceIssueKeys.join(", ")}</div>
              <button type="button" className="text-[12px] text-[#8664F2]" onClick={() => setPreview(null)}>
                Close
              </button>
            </div>
            <ul className="space-y-1.5 text-[12px]">
              {(preview.sheets.find((s) => s.kind === "test-cases")?.rows || []).slice(0, 40).map((r) => (
                <li key={r.id} className="rounded border border-[#eee] px-2 py-1.5 dark:border-[#222]">
                  <span className="font-mono text-[11px] text-[#8664F2]">{r.cells.tcId}</span>{" "}
                  <span className="font-medium">{r.cells.scenario}</span>
                  <span className="ml-2 text-[#9ca3af]">{r.cells.testType}</span>
                  <span className="ml-2 text-[#5b647a]">
                    P:{r.cells.priority || "-"} S:{r.cells.severity || "-"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
