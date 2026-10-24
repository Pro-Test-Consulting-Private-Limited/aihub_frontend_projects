"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { TbExternalLink, TbLoader2, TbPlayerPlay, TbX } from "react-icons/tb";
import { apiAgent } from "@/app/services/api-testing";
import type { EndpointDetail, GateRow } from "@/app/interfaces/api-testing";
import { EndpointTests, type TestTab } from "./endpoint-tests";
import { LayoutSwitch, useLayoutMode } from "./endpoint-tests/layout-mode";

type Tone = { dot: string; border: string; bg: string; text: string };

const METHOD_COLORS: Record<string, string> = {
  GET: "text-[#16A34A]",
  POST: "text-[#2563EB]",
  PUT: "text-[#D97706]",
  PATCH: "text-[#8B5CF6]",
  DELETE: "text-[#DC2626]",
};

const cache = new Map<string, EndpointDetail>();

const sectionTitle =
  "flex items-center gap-2 text-[11.5px] font-bold tracking-[0.08em] text-[#1F1F1F] uppercase before:h-[6px] before:w-[6px] before:rounded-full before:bg-[#8664F2] before:content-[''] dark:text-[#ededed]";

/** The method as a small tag, as in the endpoint list of the reference design. */
const METHOD_TAG: Record<string, string> = {
  GET: "border-[#BBF7D0] bg-[#F0FDF4] text-[#16A34A]",
  POST: "border-[#F5B8C0] bg-[#FDEDEF] text-[#D6293E]",
  PUT: "border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]",
  PATCH: "border-[#DDD6FE] bg-[#F5F3FF] text-[#7C3AED]",
  DELETE: "border-[#FCA5A5] bg-[#FEF2F2] text-[#B91C1C]",
};
const label =
  "mb-1.5 text-[10.5px] font-semibold tracking-[0.07em] text-[#5E6066] uppercase dark:text-[#9ca3af]";
const box =
  "rounded-[10px] border border-[#E6E8F0] bg-white dark:border-[#1a1a1a] dark:bg-[#141414]";

const classOf = (code: string) => (/^\d/.test(code) ? `${code[0]}xx` : code);
const CLASS_STYLE: Record<string, string> = {
  "2xx": "border-[#16A34A] bg-[#F0FDF4] text-[#16A34A]",
  "4xx": "border-[#D97706] bg-[#FFFBEB] text-[#D97706]",
  "5xx": "border-[#DC2626] bg-[#FEF2F2] text-[#DC2626]",
};
const CLASS_TEXT: Record<string, string> = {
  "2xx": "text-[#16A34A]",
  "4xx": "text-[#D97706]",
  "5xx": "text-[#DC2626]",
};
const FALLBACK_CLASS =
  "border-[#E5E7EB] bg-[#F5F6F6] text-[#4B5563] dark:border-[#2a2a2a] dark:bg-[#141414] dark:text-[#9ca3af]";

const pretty = (v: unknown) => JSON.stringify(v, null, 2);

function JsonBlock({ value, empty }: { value: unknown; empty: string }) {
  if (value === null || value === undefined)
    return (
      <div className={`${box} px-3 py-2.5 text-[12px] text-[#7E7E7E]`}>
        {empty}
      </div>
    );
  return (
    <pre
      className={`${box} overflow-x-auto px-3 py-2.5 font-mono text-[12px] leading-relaxed text-[#1F1F1F] dark:text-[#ededed]`}
    >
      {pretty(value)}
    </pre>
  );
}

const MIN_WIDTH = 360;

export function EndpointDetailPanel({
  specUrl,
  row,
  rows,
  serverUrl,
  moduleTone,
  onClose,
}: {
  specUrl: string;
  row: GateRow;
  /** Every endpoint of the spec (prerequisites are picked from these). */
  rows: GateRow[];
  serverUrl: string | null;
  moduleTone: Tone;
  onClose: () => void;
}) {
  const id = `${specUrl}|${row.key}`;
  const [detail, setDetail] = useState<EndpointDetail | null>(
    cache.get(id) ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [tab, setTab] = useState<"details" | TestTab>("details");
  // The new layout: Details | Setup | Testing, with Contract / Data driven / Functional under Testing. Swap with Alt+Shift+L.
  const layout = useLayoutMode();
  const [top, setTop] = useState<"details" | "setup" | "testing">("details");
  const [sub, setSub] = useState<TestTab>("contract");
  const lastLayout = useRef(layout);
  useEffect(() => {
    if (lastLayout.current === layout) return;
    lastLayout.current = layout;
    if (layout === "new") { setTop(tab === "details" ? "details" : "testing"); if (tab !== "details") setSub(tab); }
    else setTab(top === "details" ? "details" : top === "setup" ? "contract" : sub);
  }, [layout, tab, top, sub]);
  const onDetails = layout === "new" ? top === "details" : tab === "details";
  // Drag the left edge to resize; the chosen width is remembered (it is not secret). Double-click the edge to reset.
  const panelRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [userWidth, setUserWidth] = useState<number | null>(() => {
    try {
      const v = Number(localStorage.getItem("api-testing-panel-width"));
      return Number.isFinite(v) && v >= MIN_WIDTH ? v : null;
    } catch {
      return null;
    }
  });
  const width = userWidth ?? (onDetails ? 420 : 780);
  const resizeTo = (w: number, save: boolean) => {
    const max = Math.max(MIN_WIDTH, (panelRef.current?.parentElement?.clientWidth ?? window.innerWidth) - 40);
    const next = Math.round(Math.min(max, Math.max(MIN_WIDTH, w)));
    setUserWidth(next);
    if (save) {
      try {
        localStorage.setItem("api-testing-panel-width", String(next));
      } catch {
        /* storage unavailable: the width lasts until reload */
      }
    }
    return next;
  };
  const startResize = (e: ReactPointerEvent) => {
    e.preventDefault();
    const right = panelRef.current?.getBoundingClientRect().right ?? window.innerWidth;
    let last = width;
    setDragging(true);
    const move = (ev: PointerEvent) => {
      last = resizeTo(right - ev.clientX, false);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDragging(false);
      resizeTo(last, true);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const resetWidth = () => {
    setUserWidth(null);
    try {
      localStorage.removeItem("api-testing-panel-width");
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const cached = cache.get(id);
    setError(null);
    if (cached) {
      setDetail(cached);
      return;
    }
    setDetail(null);
    const ctrl = new AbortController();
    apiAgent
      .detail(specUrl, row.path, row.method, ctrl.signal)
      .then((d) => {
        cache.set(id, d);
        setDetail(d);
      })
      .catch((err) => {
        if (!ctrl.signal.aborted)
          setError(
            err instanceof Error
              ? err.message
              : "Could not load this endpoint.",
          );
      });
    return () => ctrl.abort();
  }, [id, specUrl, row.path, row.method]);

  const responses = detail?.responses ?? [];
  const activeCode =
    code && responses.some((r) => r.code === code)
      ? code
      : ((responses.find((r) => r.code.startsWith("2")) ?? responses[0])
          ?.code ?? null);
  const active = responses.find((r) => r.code === activeCode);
  const requestRows = detail ? detail.headers.length + detail.params.length : 0;

  return (
    <div ref={panelRef} style={{ width }} className={`absolute top-0 right-0 z-20 flex h-full ${dragging ? "select-none" : ""} max-w-full flex-col border-l border-[#E6E1F5] bg-white shadow-[-8px_0_24px_rgba(0,0,0,0.06)] dark:border-[#2a2a2a] dark:bg-[#0f0f0f]`}>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panel (double-click to reset)"
        tabIndex={0}
        onPointerDown={startResize}
        onDoubleClick={resetWidth}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") resizeTo(width + 40, true);
          if (e.key === "ArrowRight") resizeTo(width - 40, true);
        }}
        className={`absolute top-0 left-0 z-30 h-full w-[6px] cursor-col-resize touch-none transition-colors hover:bg-[#8664F2]/40 focus-visible:bg-[#8664F2]/50 ${dragging ? "bg-[#8664F2]/50" : ""}`}
      />
      <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`shrink-0 rounded-[5px] border px-2 py-0.5 font-mono text-[10.5px] font-bold tracking-wide ${METHOD_TAG[row.method] ?? "border-[#E5E7EB] bg-[#F5F6F6] text-[#4B5563]"}`}>{row.method}</span>
            <span className="text-[16px] font-bold break-all text-[#1F1F1F] dark:text-[#ededed]">{row.path}</span>
          </div>
          {detail?.fullUrl && (
            <a href={detail.fullUrl} target="_blank" rel="noopener noreferrer" className="mt-1.5 flex items-center gap-1 font-mono text-[11.5px] text-[#2563EB] hover:underline" title={detail.fullUrl}>
              <span className="truncate">{detail.fullUrl}</span>
              <TbExternalLink size={12} className="shrink-0" />
            </a>
          )}
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#7E7E7E]">
            <span className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: moduleTone.dot }} />
            {row.module}
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close panel" className="rounded-[6px] p-1 text-[#7E7E7E] hover:bg-[#F0F0F0] hover:text-[#1F1F1F] dark:hover:bg-[#1f1f1f] dark:hover:text-white">
          <TbX size={18} />
        </button>
      </div>

      <div role="tablist" className="flex gap-2 border-b border-[#E6E8F0] px-4 dark:border-[#1a1a1a]">
        {(layout === "new"
          ? ([["details", "Details"], ["setup", "Setup"], ["testing", "Testing"]] as const)
          : ([["details", "Details"], ["contract", "Contract"], ["data", "Data Driven"], ["functional", "Functional"]] as const)
        ).map(([id, text]) => {
          const active = layout === "new" ? top === id : tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => (layout === "new" ? setTop(id as "details" | "setup" | "testing") : setTab(id as "details" | TestTab))}
              className={`-mb-px border-b-2 px-2.5 py-2.5 text-[13px] ${
                active
                  ? "border-[#8664F2] font-semibold text-[#8664F2]"
                  : "border-transparent text-[#5E6066] hover:text-[#1F1F1F] dark:text-[#9ca3af] dark:hover:text-white"
              }`}
            >
              {text}
            </button>
          );
        })}
      </div>
      {layout === "new" && top === "testing" && (
        <div role="tablist" aria-label="Kind of test" className="flex gap-1.5 px-4 pt-2.5">
          {([["contract", "Contract"], ["data", "Data driven"], ["functional", "Functional"]] as const).map(([id, text]) => (
            <button key={id} type="button" role="tab" aria-selected={sub === id} onClick={() => setSub(id)} className={`rounded-full border px-3 py-1 text-[12px] ${sub === id ? "border-[#8664F2] bg-[#F5F1FF] font-semibold text-[#8664F2] dark:bg-[#1c1530]" : "border-[#E5E7EB] text-[#5E6066] hover:text-[#1F1F1F] dark:border-[#2a2a2a] dark:text-[#9ca3af] dark:hover:text-white"}`}>
              {text}
            </button>
          ))}
        </div>
      )}

      {!onDetails ? (
        <EndpointTests key={`${specUrl}|${row.key}`} tab={layout === "new" ? sub : (tab as TestTab)} view={layout === "new" ? (top === "setup" ? "setup" : "tests") : "all"} onSetup={() => setTop("setup")} specUrl={specUrl} row={row} rows={rows} serverUrl={serverUrl} detail={detail} />
      ) : error ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-[12.5px] text-[#B91C1C]">
          {error}
        </div>
      ) : !detail ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-[12.5px] text-[#5E6066] dark:text-[#9ca3af]">
          <TbLoader2 size={16} className="animate-spin" /> Loading endpoint…
        </div>
      ) : (
        <>
          <section className="flex min-h-0 flex-1 flex-col border-b border-[#EEE] dark:border-[#1a1a1a]">
            <div className="px-4 pt-3 pb-2">
              <h4 className={sectionTitle}>Request</h4>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-3">
              {(detail.summary || detail.description) && (
                <p className="text-[12.5px] leading-relaxed text-[#5E6066] dark:text-[#9ca3af]">
                  {detail.summary || detail.description}
                </p>
              )}
              <div>
                <div className={label}>
                  Headers &amp; parameters ({requestRows})
                </div>
                {requestRows === 0 ? (
                  <div
                    className={`${box} px-3 py-2.5 text-[12px] text-[#7E7E7E]`}
                  >
                    No headers or parameters.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {detail.headers.map((h) => (
                      <div key={`h-${h.name}`} className={`${box} flex items-center gap-3 px-3 py-2 text-[12px]`}>
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <span className="shrink-0 font-mono font-medium text-[#2563EB]">{h.name}</span>
                          <span className="text-[#9CA3AF]">→</span>
                          <span className="min-w-0 truncate rounded-[6px] border border-[#E1E4EC] bg-white px-2 py-0.5 font-mono text-[11.5px] text-[#1F1F1F] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] dark:text-[#ededed]" title={h.value}>{h.value}</span>
                        </div>
                        {h.required && <span className="shrink-0 rounded-[4px] border border-[#F5B8C0] bg-[#FDEDEF] px-1.5 py-0.5 text-[9.5px] font-bold tracking-wide text-[#D6293E]">REQUIRED</span>}
                      </div>
                    ))}
                    {detail.params.map((p) => (
                      <div key={`p-${p.in}-${p.name}`} className={`${box} flex items-center gap-3 px-3 py-2 text-[12px]`}>
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <span className="shrink-0 font-mono font-medium text-[#2563EB]">{p.name}</span>
                          <span className="text-[#9CA3AF]">→</span>
                          <span className="min-w-0 truncate rounded-[6px] border border-[#E1E4EC] bg-white px-2 py-0.5 font-mono text-[11.5px] text-[#5E6066] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] dark:text-[#9ca3af]" title={p.description || p.type}>{p.in} · {p.type}</span>
                        </div>
                        {p.required && <span className="shrink-0 rounded-[4px] border border-[#F5B8C0] bg-[#FDEDEF] px-1.5 py-0.5 text-[9.5px] font-bold tracking-wide text-[#D6293E]">REQUIRED</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <div className={label}>Request body</div>
                <JsonBlock
                  value={detail.body?.example}
                  empty="No request body."
                />
              </div>
            </div>
          </section>

          <section className="flex min-h-0 flex-1 flex-col">
            <div className="px-4 pt-3 pb-2">
              <h4 className={sectionTitle}>Response</h4>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-3">
              {responses.length === 0 ? (
                <div
                  className={`${box} px-3 py-2.5 text-[12px] text-[#7E7E7E]`}
                >
                  No responses documented for this endpoint.
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {responses.map((r) => (
                      <button
                        key={r.code}
                        type="button"
                        onClick={() => setCode(r.code)}
                        className={`flex items-center gap-1.5 rounded-[7px] border px-3 py-1 font-mono text-[12px] font-medium ${
                          r.code === activeCode
                            ? `${CLASS_STYLE[classOf(r.code)] ?? FALLBACK_CLASS} shadow-[0_0_0_2px_rgba(134,100,242,0.12)]`
                            : "border-[#E1E4EC] bg-white text-[#4B5563] hover:bg-[#F5F6F6] dark:border-[#2a2a2a] dark:bg-[#141414] dark:text-[#9ca3af]"
                        }`}
                      >
                        {r.code === activeCode && <i className="h-[6px] w-[6px] rounded-full bg-current" />}
                        {r.code}
                      </button>
                    ))}
                  </div>
                  {active && (
                    <div>
                      <div
                        className={`mb-1.5 font-mono text-[12px] font-semibold ${CLASS_TEXT[classOf(active.code)] ?? "text-[#4B5563]"}`}
                      >
                        HTTP {active.code}
                        {active.description && (
                          <span className="ml-2 font-sans font-normal text-[#5E6066] dark:text-[#9ca3af]">
                            {active.description}
                          </span>
                        )}
                      </div>
                      <JsonBlock
                        value={active.example}
                        empty="No example body is documented for this response."
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        </>
      )}
      {onDetails && !error && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#E6E8F0] px-5 py-3 dark:border-[#1a1a1a]">
          <span className="flex items-center gap-2 text-[12px] text-[#5E6066] dark:text-[#9ca3af]">
            <i className={`h-[7px] w-[7px] rounded-full ${detail ? "bg-[#22C55E]" : "bg-[#D1D5DB]"}`} /> {detail ? "Schema synchronized" : "Loading schema…"}
          </span>
          <button
            type="button"
            disabled={!detail}
            onClick={() => (layout === "new" ? (setTop("testing"), setSub("contract")) : setTab("contract"))}
            className="flex items-center gap-1.5 rounded-[10px] bg-[#8664F2] px-4 py-2 text-[12.5px] font-semibold text-white shadow-[0_2px_8px_rgba(134,100,242,0.35)] hover:bg-[#7451e8] disabled:opacity-50"
          >
            <TbPlayerPlay size={14} /> Test this endpoint
          </button>
        </div>
      )}
      <LayoutSwitch />
    </div>
  );
}
