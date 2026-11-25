"use client";

/**
 * Fixture preview for Playwright screenshots of real CanvasPosture components.
 * Data is captured from live atlas-api for canvas z-47xXi7aWIK. No backend auth bypass.
 * Enable with NEXT_PUBLIC_POSTURE_PREVIEW=1 (dev builds only).
 */
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CanvasPosture } from "@/app/components/app-atlas/canvas-posture";
import { ChecklistView } from "@/app/components/app-atlas/posture/checklist-view";
import { createFixtureAtlasClient } from "@/app/components/app-atlas/posture/fixture-client";
import type { SecurityReport } from "@/app/components/app-atlas/posture/types";

import reportRaw from "@/app/components/app-atlas/__fixtures__/wallet-fixtures/report.json";
import passesRaw from "@/app/components/app-atlas/__fixtures__/wallet-fixtures/passes.json";
import canvasFull from "@/app/components/app-atlas/__fixtures__/wallet-fixtures/canvas-full.json";
import pass2Events from "@/app/components/app-atlas/__fixtures__/wallet-fixtures/pass2-events.json";
import inventoryEvents from "@/app/components/app-atlas/__fixtures__/wallet-fixtures/inventory-events.json";
import jobsRaw from "@/app/components/app-atlas/__fixtures__/wallet-fixtures/jobs.json";

function enrichReport(raw: SecurityReport): SecurityReport {
  const nodes = ((canvasFull as { nodes?: Array<{ id: string; title?: string; url?: string; screenshotUrl?: string }> }).nodes ||
    []) as Array<{ id: string; title?: string; url?: string; screenshotUrl?: string }>;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const mapScreens = (ids: string[] = []) =>
    ids.map((id) => {
      const n = byId.get(id);
      return { id, name: n?.title || id, url: n?.url || "", screenshotUrl: n?.screenshotUrl || null };
    });
  const checks = (raw.checks || []).map((c) => {
    const screens = c.screens?.length ? c.screens : mapScreens(c.screenIds || []);
    return {
      ...c,
      screens,
      screensAffected: screens.length,
      humanByName: c.humanByName || (String(c.status).startsWith("human_verified") ? "Earlier attestation" : null),
      expected: c.expected || (c.id.startsWith("BRW") ? "Security response header present on HTML responses" : null),
      observed: c.observed || c.reason,
    };
  });
  const failures = (raw.failures || []).map((f) => ({
    ...f,
    title: f.title?.replace(/\s*\(\d+\s+related findings?\)\s*$/i, "") || f.title,
    why: (f.why || f.reason || "").replace(/\s*\(\d+\s+related findings?\)\s*$/i, ""),
    reason: (f.reason || "").replace(/\s*\(\d+\s+related findings?\)\s*$/i, ""),
    screens: f.screens?.length ? f.screens : mapScreens(f.screenIds || []),
    expected: f.expected || "Security response header present on HTML responses",
    observed: (f.observed || f.why || f.reason || "").replace(/\s*\(\d+\s+related findings?\)\s*$/i, ""),
    fix: f.fix || f.remediation || "Set the missing security header on all HTML responses.",
  }));
  const screens = (raw.screens || []).map((s) => {
    const n = s.nodeId ? byId.get(s.nodeId) : undefined;
    return {
      ...s,
      name: n?.title || s.title,
      screenshotUrl: n?.screenshotUrl || s.screenshotUrl || null,
    };
  });
  return {
    ...raw,
    canvasName: raw.canvasName || (canvasFull as { name?: string }).name || "Wallet-Release 1.10",
    appUrl: raw.appUrl || (canvasFull as { startUrl?: string }).startUrl || screens[0]?.url || null,
    checks,
    failures,
    screens,
    categories: raw.categories?.length
      ? raw.categories
      : [...new Set(checks.map((c) => c.category))],
    grade: {
      ...raw.grade,
      score: null,
      grade: null,
      label: raw.grade?.progress?.coverageLabel || `${raw.grade?.progress?.tested || 0} of 143 tested`,
      progress: {
        ...raw.grade.progress,
        coverageLabel: raw.grade?.progress?.coverageLabel || `${raw.grade?.progress?.tested || 0} of 143 tested`,
      },
    },
    precisionEvidence: raw.precisionEvidence || [],
    probeOutcomes: raw.probeOutcomes || [],
    overlapNote:
      raw.overlapNote ||
      "Some checks can be observed by more than one pass. Each check has one primary pass so counts stay consistent and sum to 143.",
  } as SecurityReport;
}

function PreviewInner() {
  const enabled = process.env.NEXT_PUBLIC_POSTURE_PREVIEW === "1" || process.env.NODE_ENV !== "production";
  const sp = useSearchParams();
  const theme = sp.get("theme") === "dark" ? "dark" : "light";
  const compare = sp.get("compare") === "1";
  const [report] = useState(() => enrichReport(reportRaw as unknown as SecurityReport));
  const [exportHtml, setExportHtml] = useState("<html><body>Loading export fixture…</body></html>");
  useEffect(() => {
    void fetch("/posture-fixtures/export.html")
      .then((r) => r.text())
      .then(setExportHtml)
      .catch(() => setExportHtml("<html><body>Export fixture missing</body></html>"));
  }, []);

  const eventsByJob = useMemo(() => {
    const map: Record<string, { items: unknown[] }> = {};
    const jobItems = ((jobsRaw as { items?: Array<{ id: string; passId: string }> }).items || []) as Array<{
      id: string;
      passId: string;
    }>;
    const p2 = jobItems.find((j) => j.passId === "pass2_light_probes");
    const inv = jobItems.find((j) => j.passId === "inventory");
    if (p2) map[p2.id] = pass2Events as { items: unknown[] };
    if (inv) map[inv.id] = inventoryEvents as { items: unknown[] };
    return map;
  }, []);

  const client = useMemo(
    () =>
      createFixtureAtlasClient({
        report,
        passes: {
          ...(passesRaw as { passes: unknown[]; jobs: unknown[]; tooltip?: string }),
          jobs: (jobsRaw as { items?: unknown[] }).items || (passesRaw as { jobs?: unknown[] }).jobs || [],
        },
        eventsByJob,
        exportHtml,
      }),
    [eventsByJob, exportHtml, report],
  );

  if (!enabled) {
    return <div className="p-8 text-sm">Posture preview is disabled.</div>;
  }

  return (
    <div className={theme === "dark" ? "dark" : ""} data-screenshot-root data-theme={theme}>
      <div className="min-h-screen bg-white text-[#1F1F1F] dark:bg-[#0f0f0f] dark:text-[#ededed]">
        <div className="border-b border-[#E5E7EB] bg-[#F5F1FF] px-3 py-1.5 text-[11px] text-[#5B21B6] dark:border-[#2a2a2a] dark:bg-[#1a1228] dark:text-[#ddd6fe]">
          Playwright fixture preview · live atlas-api capture for z-47xXi7aWIK · theme={theme} · not production auth
        </div>
        {compare ? (
          <div className="grid grid-cols-2 gap-3 p-3" style={{ width: 1280, height: 720 }}>
            <div className="overflow-auto rounded border border-[#E5E7EB] p-2 dark:border-[#2a2a2a]" data-testid="compare-checklist">
              <div className="mb-2 text-[12px] font-semibold">On-screen Checklist</div>
              <ChecklistView report={report} />
            </div>
            <div className="overflow-auto rounded border border-[#E5E7EB] p-2 dark:border-[#2a2a2a]" data-testid="compare-export">
              <div className="mb-2 text-[12px] font-semibold">Exported HTML (captured)</div>
              <iframe title="export" className="h-[640px] w-full bg-white" srcDoc={exportHtml} />
            </div>
          </div>
        ) : (
          <div style={{ width: 1280, height: 720 }} className="overflow-hidden">
            <CanvasPosture
              client={client}
              canvasId="z-47xXi7aWIK"
              canvasName={report.canvasName}
              appUrl={report.appUrl}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function PosturePreviewPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading preview…</div>}>
      <PreviewInner />
    </Suspense>
  );
}
