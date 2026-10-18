"use client";

import { useEffect, useState } from "react";
import {
  TbArrowDownLeft,
  TbArrowUpRight,
  TbLoader2,
  TbX,
} from "react-icons/tb";
import { apiAgent } from "@/app/services/api-testing";
import type { EndpointDetail, GateRow } from "@/app/interfaces/api-testing";

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
  "flex items-center gap-1.5 text-[13px] font-semibold text-[#1F1F1F] dark:text-[#ededed]";
const label =
  "mb-1.5 text-[10.5px] font-semibold tracking-wide text-[#5E6066] uppercase dark:text-[#9ca3af]";
const box =
  "rounded-[8px] border border-[#EEE] bg-[#F8F9FB] dark:border-[#1a1a1a] dark:bg-[#141414]";

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

export function EndpointDetailPanel({
  specUrl,
  row,
  moduleTone,
  onClose,
}: {
  specUrl: string;
  row: GateRow;
  moduleTone: Tone;
  onClose: () => void;
}) {
  const id = `${specUrl}|${row.key}`;
  const [detail, setDetail] = useState<EndpointDetail | null>(
    cache.get(id) ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);

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
  const counts = responses.reduce<Record<string, number>>(
    (acc, r) => ({
      ...acc,
      [classOf(r.code)]: (acc[classOf(r.code)] ?? 0) + 1,
    }),
    {},
  );
  const requestRows = detail ? detail.headers.length + detail.params.length : 0;

  return (
    <div className="absolute top-0 right-0 z-20 flex h-full w-[420px] max-w-full flex-col border-l border-[#E6E1F5] bg-white shadow-[-8px_0_24px_rgba(0,0,0,0.06)] dark:border-[#2a2a2a] dark:bg-[#0f0f0f]">
      <div className="flex items-start justify-between gap-3 border-b border-[#EEE] px-4 py-3 dark:border-[#1a1a1a]">
        <div className="min-w-0">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px]"
            style={{
              borderColor: moduleTone.border,
              backgroundColor: moduleTone.bg,
              color: moduleTone.text,
            }}
          >
            <span
              className="h-[8px] w-[8px] rounded-full"
              style={{ backgroundColor: moduleTone.dot }}
            />
            {row.module}
          </span>
          <div className="mt-1.5 font-mono text-[14px] font-semibold break-all text-[#1F1F1F] dark:text-[#ededed]">
            <span
              className={`mr-1.5 ${METHOD_COLORS[row.method] ?? "text-[#4B5563]"}`}
            >
              {row.method}
            </span>
            {row.path}
          </div>
          {detail?.fullUrl && (
            <div
              className="mt-0.5 truncate text-[11.5px] text-[#2563EB]"
              title={detail.fullUrl}
            >
              {detail.fullUrl}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className="text-[#7E7E7E] hover:text-[#1F1F1F] dark:hover:text-white"
        >
          <TbX size={18} />
        </button>
      </div>

      {error ? (
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
              <h4 className={sectionTitle}>
                <TbArrowUpRight size={15} className="text-[#8664F2]" /> Request
              </h4>
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
                      <div
                        key={`h-${h.name}`}
                        className={`${box} flex items-center justify-between gap-3 px-3 py-2 text-[12px]`}
                      >
                        <span className="font-mono font-medium text-[#2563EB]">
                          {h.name}
                        </span>
                        <span
                          className="min-w-0 flex-1 truncate text-[#5E6066] dark:text-[#9ca3af]"
                          title={h.value}
                        >
                          {h.value}
                        </span>
                        {h.required && (
                          <span className="text-[9.5px] font-bold tracking-wide text-[#DC2626]">
                            REQUIRED
                          </span>
                        )}
                      </div>
                    ))}
                    {detail.params.map((p) => (
                      <div
                        key={`p-${p.in}-${p.name}`}
                        className={`${box} flex items-center justify-between gap-3 px-3 py-2 text-[12px]`}
                      >
                        <span className="font-mono font-medium text-[#2563EB]">
                          {p.name}
                        </span>
                        <span
                          className="min-w-0 flex-1 truncate text-[#5E6066] dark:text-[#9ca3af]"
                          title={p.description || p.type}
                        >
                          {p.in} · {p.type}
                        </span>
                        {p.required && (
                          <span className="text-[9.5px] font-bold tracking-wide text-[#DC2626]">
                            REQUIRED
                          </span>
                        )}
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
              <h4 className={sectionTitle}>
                <TbArrowDownLeft size={15} className="text-[#8664F2]" />{" "}
                Response
              </h4>
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
                    {Object.entries(counts).map(([c, n]) => (
                      <span
                        key={c}
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${CLASS_STYLE[c] ?? FALLBACK_CLASS}`}
                      >
                        {c}: {n}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {responses.map((r) => (
                      <button
                        key={r.code}
                        type="button"
                        onClick={() => setCode(r.code)}
                        className={`rounded-[6px] border px-3 py-1 text-[12px] font-medium ${
                          r.code === activeCode
                            ? "border-[#8664F2] bg-[#F4EFFE] text-[#8664F2] dark:bg-[#1c1630]"
                            : "border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#F5F6F6] dark:border-[#2a2a2a] dark:bg-[#141414] dark:text-[#9ca3af]"
                        }`}
                      >
                        {r.code}
                      </button>
                    ))}
                  </div>
                  {active && (
                    <div>
                      <div
                        className={`mb-1.5 text-[12px] font-semibold ${CLASS_TEXT[classOf(active.code)] ?? "text-[#4B5563]"}`}
                      >
                        HTTP {active.code}
                        {active.description && (
                          <span className="ml-2 font-normal text-[#7E7E7E]">
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
    </div>
  );
}
