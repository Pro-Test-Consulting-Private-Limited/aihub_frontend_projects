"use client";

import { useMemo, useState } from "react";
import {
  TbAlertTriangle,
  TbInfoCircle,
  TbLoader2,
  TbRefresh,
} from "react-icons/tb";
import type { ApiSpecState } from "@/app/hooks/use-api-spec";
import { useApiSpecView } from "@/app/hooks/use-api-spec";
import { EndpointDetailPanel } from "./endpoint-detail-panel";

type GateFilter = "all" | "blocked" | "passed";

const MODULE_COLORS = [
  { dot: "#38BDF8", border: "#7DD3FC", bg: "#F0F9FF", text: "#0369A1" },
  { dot: "#F87171", border: "#FCA5A5", bg: "#FEF2F2", text: "#B91C1C" },
  { dot: "#FBBF24", border: "#FCD34D", bg: "#FFFBEB", text: "#B45309" },
  { dot: "#A78BFA", border: "#C4B5FD", bg: "#F5F3FF", text: "#6D28D9" },
  { dot: "#34D399", border: "#6EE7B7", bg: "#ECFDF5", text: "#047857" },
  { dot: "#F472B6", border: "#F9A8D4", bg: "#FDF2F8", text: "#BE185D" },
];

const METHOD_COLORS: Record<string, string> = {
  GET: "text-[#16A34A]",
  POST: "text-[#2563EB]",
  PUT: "text-[#D97706]",
  PATCH: "text-[#8B5CF6]",
  DELETE: "text-[#DC2626]",
};

const sectionTitle =
  "mb-2 px-1 text-[13px] font-medium tracking-wide text-[#5E6066] dark:text-[#9ca3af]";

export function ApiTestingView({
  spec,
  onReload,
  specUrl,
}: {
  spec: ApiSpecState;
  onReload: () => void;
  specUrl: string;
}) {
  const { modules, rows, passScore } = useApiSpecView(spec);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [gate, setGate] = useState<GateFilter>("all");
  const [method, setMethod] = useState("all");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const inModule = useMemo(
    () => rows.filter((r) => !selectedModule || r.module === selectedModule),
    [rows, selectedModule],
  );
  const methods = useMemo(
    () => [...new Set(inModule.map((r) => r.method))].sort(),
    [inModule],
  );
  const inMethod = useMemo(
    () => inModule.filter((r) => method === "all" || r.method === method),
    [inModule, method],
  );
  const blocked = inMethod.filter((r) => !r.pass).length;
  const passed = inMethod.length - blocked;
  const shown = inMethod.filter(
    (r) => gate === "all" || (gate === "blocked" ? !r.pass : r.pass),
  );

  if (spec.status === "idle" || spec.status === "loading") {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-[13px] text-[#5E6066] dark:text-[#9ca3af]">
        <TbLoader2 size={16} className="animate-spin" /> Reading the Swagger
        spec…
      </div>
    );
  }

  if (spec.status === "error") {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <TbAlertTriangle size={40} className="mb-3 text-[#E1962E]" />
        <h2 className="mb-1 text-[18px] font-medium text-[#1F1F1F] dark:text-[#ededed]">
          Couldn&apos;t read the API spec
        </h2>
        <p className="max-w-[460px] text-[13px] leading-relaxed text-[#5E6066] dark:text-[#9ca3af]">
          {spec.error}
        </p>
        <button
          type="button"
          onClick={onReload}
          className="mt-4 flex items-center gap-1.5 rounded-[8px] bg-[#8664F2] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#7451e8]"
        >
          <TbRefresh size={15} /> Try again
        </button>
      </div>
    );
  }

  const tab = (id: GateFilter, label: string, count: number, tone: string) => (
    <button
      type="button"
      onClick={() => setGate(id)}
      className={`rounded-[6px] px-3 py-1 text-[12.5px] ${gate === id ? "bg-white font-medium shadow-sm dark:bg-[#1f1f1f]" : ""} ${tone}`}
    >
      {label} ({count})
    </button>
  );

  const selectedRow = selectedKey
    ? rows.find((r) => r.key === selectedKey)
    : undefined;
  const selectedTone =
    MODULE_COLORS[
      Math.max(
        0,
        modules.findIndex((m) => m.name === selectedRow?.module),
      ) % MODULE_COLORS.length
    ];

  return (
    <div className="relative h-full">
      <div className="h-full overflow-y-auto bg-[#F7F7FA] px-4 py-4 dark:bg-[#0a0a0a]">
        <h3 className={sectionTitle}>
          Cross-Module Dependencies: How Modules Call Into Each Other
        </h3>
        <div className="mb-6 rounded-[12px] border border-[#EEE] bg-white p-3 shadow-md dark:border-[#1a1a1a] dark:bg-[#101010]">
          <div className="flex flex-wrap items-center justify-around gap-x-6 gap-y-4 rounded-[10px] px-4 py-9">
            {modules.length === 0 && (
              <span className="text-[12.5px] text-[#7E7E7E]">
                No endpoints found in this spec.
              </span>
            )}
            {modules.map((m, i) => {
              const c = MODULE_COLORS[i % MODULE_COLORS.length];
              const active = selectedModule === m.name;
              return (
                <button
                  key={m.name}
                  type="button"
                  aria-pressed={active}
                  title={`${m.endpoints} endpoint${m.endpoints === 1 ? "" : "s"}. Click to show only this module's spec check.`}
                  onClick={() => setSelectedModule(active ? null : m.name)}
                  style={{
                    borderColor: c.border,
                    backgroundColor: c.bg,
                    color: c.text,
                    boxShadow: active
                      ? `0 0 0 2px ${c.border}`
                      : `0 2px 8px ${c.dot}33`,
                  }}
                  className="flex items-center gap-2 rounded-full border px-4 py-1.5 text-[13px] transition hover:scale-[1.03]"
                >
                  <span
                    className="h-[10px] w-[10px] rounded-full"
                    style={{ backgroundColor: c.dot }}
                  />
                  {m.name}
                </button>
              );
            })}
          </div>
        </div>

        <h3 className={sectionTitle}>
          Spec Quality Check : Select A Category To Run Its Spec Check
        </h3>
        <div className="overflow-hidden rounded-[12px] border border-[#EEE] bg-white dark:border-[#1a1a1a] dark:bg-[#101010]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEE] px-4 py-3 dark:border-[#1a1a1a]">
            <div className="flex items-center gap-1 rounded-[8px] border border-[#E5E7EB] bg-[#F5F6F6] p-1 dark:border-[#2a2a2a] dark:bg-[#141414]">
              {tab(
                "all",
                "All",
                inMethod.length,
                "text-[#1F1F1F] dark:text-[#ededed]",
              )}
              {tab("blocked", "Blocked", blocked, "text-[#DC2626]")}
              {tab("passed", "Passed", passed, "text-[#16A34A]")}
            </div>
            <div className="flex items-center gap-3 text-[12.5px] text-[#7E7E7E]">
              <label className="flex items-center gap-2">
                Filter Method:
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="rounded-[6px] border border-[#D9D9D9] bg-white px-2 py-1 text-[12.5px] text-[#1F1F1F] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] dark:text-[#ededed]"
                >
                  <option value="all">All Methods</option>
                  {methods.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <span className="flex items-center gap-1.5 rounded-[6px] bg-[#EEF0F4] px-2.5 py-1 text-[#4B5563] dark:bg-[#1a1a1a] dark:text-[#9ca3af]">
                <TbInfoCircle size={14} />
                Rule: Score ≥ {passScore} &amp; Zero Errors
              </span>
            </div>
          </div>

          <table className="w-full table-fixed border-collapse text-left text-[12.5px]">
            <thead>
              <tr className="bg-[#F8F9FB] text-[#1F1F1F] dark:bg-[#141414] dark:text-[#ededed]">
                <th className="w-[34%] px-4 py-3 font-medium">Endpoint</th>
                <th className="w-[14%] px-4 py-3 font-medium">Gate</th>
                <th className="px-4 py-3 font-medium">Reason / rule</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-8 text-center text-[#7E7E7E]"
                  >
                    No endpoints match these filters.
                  </td>
                </tr>
              )}
              {shown.map((r) => (
                <tr
                  key={r.key}
                  tabIndex={0}
                  aria-selected={selectedKey === r.key}
                  title="Click to see this endpoint's request and response"
                  onClick={() =>
                    setSelectedKey(selectedKey === r.key ? null : r.key)
                  }
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    setSelectedKey(selectedKey === r.key ? null : r.key)
                  }
                  className={`cursor-pointer border-t border-[#F0F0F0] outline-none hover:bg-[#F8F9FB] dark:border-[#1a1a1a] dark:hover:bg-[#141414] ${
                    selectedKey === r.key
                      ? "bg-[#F4EFFE] dark:bg-[#1c1630]"
                      : ""
                  }`}
                >
                  <td className="px-4 py-3 font-mono break-all">
                    <span
                      className={`mr-1.5 font-bold ${METHOD_COLORS[r.method] ?? "text-[#4B5563]"}`}
                    >
                      {r.method}
                    </span>
                    <span className="text-[#1F1F1F] dark:text-[#ededed]">
                      {r.path}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      title={`Score ${r.score}/100 (${r.grade})`}
                      className={`inline-block rounded-[4px] border px-2 py-0.5 text-[10.5px] font-bold tracking-wide ${
                        r.pass
                          ? "border-[#16A34A] bg-[#F0FDF4] text-[#16A34A]"
                          : "border-[#DC2626] bg-[#FEF2F2] text-[#DC2626]"
                      }`}
                    >
                      {r.pass ? "PASS" : "BLOCKED"}
                    </span>
                  </td>
                  <td className="px-4 py-3 leading-snug text-[#4B5563] dark:text-[#9ca3af]">
                    {r.pass
                      ? `Score ≥ ${passScore} and no error-level findings`
                      : r.reasons
                          .map((f) => `${f.ruleId}: ${f.message}`)
                          .join("; ") || `Score below ${passScore}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {selectedRow && (
        <EndpointDetailPanel
          specUrl={specUrl}
          row={selectedRow}
          rows={rows}
          serverUrl={spec.data?.serverUrl ?? null}
          moduleTone={selectedTone}
          onClose={() => setSelectedKey(null)}
        />
      )}
    </div>
  );
}
