"use client";

import { useMemo, useState } from "react";
import { TbChevronDown, TbChevronRight } from "react-icons/tb";
import type { CheckRow, SecurityReport } from "./types";
import { StatusChip, formatWhen, passLabel, statusBucket } from "./status";

/** Shared Checklist used on screen and for export preview (same component, same data). */
export function ChecklistView({
  report,
  statusFilter = "all",
  onOpenCheck,
  compact = false,
}: {
  report: SecurityReport;
  statusFilter?: string;
  onOpenCheck?: (c: CheckRow) => void;
  compact?: boolean;
}) {
  const categories = report.categories?.length
    ? report.categories
    : [...new Set(report.checks.map((c) => c.category))];
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return report.checks.filter((c) => {
      if (statusFilter === "all") return true;
      return statusBucket(c.status) === statusFilter;
    });
  }, [report.checks, statusFilter]);

  const byCat = useMemo(() => {
    const m: Record<string, CheckRow[]> = {};
    for (const c of filtered) (m[c.category] ||= []).push(c);
    return m;
  }, [filtered]);

  const tally = report.tally || {};
  const tested =
    (tally.fail || 0) + (tally.pass || 0) + (tally.partial || 0) + (tally.human_verified || 0);

  return (
    <div className={`space-y-4 ${compact ? "text-[13px]" : ""}`} data-testid="posture-checklist">
      <p className="text-[14px] text-[#374151] dark:text-[#d1d5db]">
        <strong>Summary:</strong> Tested {tested} of {report.total}. Fail {tally.fail || 0}, Pass{" "}
        {tally.pass || 0}, Partial {tally.partial || 0}, Not tested {tally.not_tested || 0}, Manual{" "}
        {tally.manual || 0}, Human verified {tally.human_verified || 0}.
      </p>

      <section>
        <h3 className="mb-2 text-[15px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">
          Failures by severity
        </h3>
        {report.failures.length === 0 ? (
          <p className="text-[13px] text-[#6B7280]">No failed checks in the latest completed results.</p>
        ) : (
          <ol className="list-decimal space-y-1 pl-5 text-[13px] text-[#374151] dark:text-[#d1d5db]">
            {report.failures.map((f) => (
              <li key={f.checkId}>
                <strong className="uppercase">{f.severity}</strong> {f.checkId}: {f.why || f.reason || f.title}
                {(f.screens || []).length > 0 && (
                  <span className="text-[#6B7280]">
                    {" "}
                    · {(f.screens || []).map((s) => s.name).join(", ")}
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-[15px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">
          All checks by category
        </h3>
        {categories.map((cat) => {
          const rows = byCat[cat] || [];
          if (statusFilter !== "all" && rows.length === 0) return null;
          const allInCat = report.checks.filter((c) => c.category === cat);
          const counts: Record<string, number> = {};
          for (const r of allInCat) {
            const k = statusBucket(r.status);
            counts[k] = (counts[k] || 0) + 1;
          }
          const testedCat =
            (counts.fail || 0) + (counts.pass || 0) + (counts.partial || 0) + (counts.human_verified || 0);
          const pct = allInCat.length ? Math.round((testedCat / allInCat.length) * 100) : 0;
          const open = !collapsed.has(cat);
          return (
            <div
              key={cat}
              className="overflow-hidden rounded-[10px] border border-[#E5E7EB] dark:border-[#2a2a2a]"
            >
              <button
                type="button"
                className="flex w-full items-center gap-2 bg-[#FAFAFA] px-3 py-2.5 text-left dark:bg-[#141414]"
                onClick={() =>
                  setCollapsed((prev) => {
                    const n = new Set(prev);
                    if (n.has(cat)) n.delete(cat);
                    else n.add(cat);
                    return n;
                  })
                }
                aria-expanded={open}
              >
                {open ? <TbChevronDown size={16} /> : <TbChevronRight size={16} />}
                <span className="flex-1 text-[13.5px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">
                  {cat}
                </span>
                <span className="text-[12.5px] text-[#6B7280]">
                  {allInCat.length} checks · {testedCat} tested · Fail {counts.fail || 0} · Pass{" "}
                  {counts.pass || 0} · Partial {counts.partial || 0}
                </span>
              </button>
              <div className="h-1.5 bg-[#E5E7EB] dark:bg-[#2a2a2a]">
                <div className="h-full bg-[#8664F2]" style={{ width: `${pct}%` }} />
              </div>
              {open && (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-[13px]">
                    <thead className="sticky top-0 bg-white text-[12px] uppercase tracking-wide text-[#6B7280] dark:bg-[#0f0f0f]">
                      <tr>
                        <th className="px-3 py-2 font-medium">ID</th>
                        <th className="px-3 py-2 font-medium">Name</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 font-medium">Reason</th>
                        <th className="px-3 py-2 font-medium">Screens</th>
                        <th className="px-3 py-2 font-medium">Pass</th>
                        <th className="px-3 py-2 font-medium">Last tested</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((c) => (
                        <tr
                          key={c.id}
                          className="cursor-pointer border-t border-[#F3F4F6] hover:bg-[#F5F1FF]/60 dark:border-[#1a1a1a] dark:hover:bg-[#1a1228]"
                          onClick={() => onOpenCheck?.(c)}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onOpenCheck?.(c);
                            }
                          }}
                        >
                          <td className="px-3 py-2 font-mono text-[12px]">{c.id}</td>
                          <td className="px-3 py-2 font-medium text-[#1F1F1F] dark:text-[#ededed]">
                            {c.name}
                          </td>
                          <td className="px-3 py-2">
                            <StatusChip status={c.status} label={c.statusLabel} />
                          </td>
                          <td className="max-w-[280px] px-3 py-2 text-[#4B5563] dark:text-[#9ca3af]">
                            {c.reason}
                          </td>
                          <td className="px-3 py-2">
                            {(c.screens || []).length
                              ? (c.screens || []).map((s) => s.name).join(", ")
                              : "-"}
                          </td>
                          <td className="px-3 py-2">{passLabel(c.primaryPass)}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-[#6B7280]">
                            {formatWhen(c.lastTestedAt)}
                          </td>
                        </tr>
                      ))}
                      {rows.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-3 py-4 text-[#6B7280]">
                            No checks match this filter in {cat}.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
