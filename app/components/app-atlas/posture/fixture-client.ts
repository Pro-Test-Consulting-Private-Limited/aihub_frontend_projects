import type { AtlasClient } from "@/app/services/appatlas";
import type { SecurityReport } from "./types";

type Fixtures = {
  report: SecurityReport;
  passes: { passes: unknown[]; jobs: unknown[]; tooltip?: string };
  eventsByJob: Record<string, { items: unknown[] }>;
  exportHtml?: string;
};

/** Minimal AtlasClient backed by captured live atlas-api JSON (Wallet canvas). */
export function createFixtureAtlasClient(fx: Fixtures): AtlasClient {
  const jobs = () => (fx.passes.jobs || []) as Array<{ id: string; passId: string }>;
  return {
    getSecurityReport: async () => fx.report as never,
    listSecurityPasses: async () => fx.passes as never,
    listSecurityJobEvents: async (_canvasId: string, jobId: string) =>
      (fx.eventsByJob[jobId] || { items: [] }) as never,
    enqueueSecurityPass: async () => {
      throw new Error("Fixture client: enqueue disabled");
    },
    enqueueSecurityRunAll: async () => {
      throw new Error("Fixture client: enqueue disabled");
    },
    cancelSecurityPassJob: async () => {
      throw new Error("Fixture client: cancel disabled");
    },
    retrySecurityPass: async () => {
      throw new Error("Fixture client: retry disabled");
    },
    exportSecurityReport: async (_canvasId: string, format: "json" | "html" | "xlsx") => {
      if (format === "html") {
        const body = fx.exportHtml || "<html><body>fixture export</body></html>";
        return {
          blob: new Blob([body], { type: "text/html" }),
          filename: `security-report-${fx.report.canvasName || "canvas"}.html`,
        };
      }
      if (format === "json") {
        return {
          blob: new Blob([JSON.stringify(fx.report, null, 2)], { type: "application/json" }),
          filename: `security-report-${fx.report.canvasName || "canvas"}.json`,
        };
      }
      return {
        blob: new Blob(["fixture"], { type: "application/octet-stream" }),
        filename: `security-checklist-${fx.report.canvasName || "canvas"}.xlsx`,
      };
    },
  } as unknown as AtlasClient;
}

export function latestJobId(fx: Fixtures, passId: string): string | null {
  const j = jobsFrom(fx).find((x) => x.passId === passId);
  return j?.id || null;
}

function jobsFrom(fx: Fixtures) {
  return (fx.passes.jobs || []) as Array<{ id: string; passId: string; status: string }>;
}
