/**
 * SIT v2 export: Excel / CSV / copy-as-table.
 * Formula-injection guarded; CSV UTF-8 BOM for ₹ in Excel.
 */
import type { SitSheetRow, SitWorkbook } from "@/app/interfaces/appatlas";
import { sanitizeUserText } from "@/app/lib/sit-sanitize-text";
import { normalizeBulletText } from "@/app/components/app-atlas/sit-v2/sit-v2-bullets";
import { getCaseProvenance } from "@/app/lib/sit-case-provenance";

export type ExportScope = "view" | "selected" | "all";

/** Round 5 A4/A5: scrub dashes/arrows and dedupe bullets at export time (no DB rewrite). */
function exportText(raw: string, mode: "plain" | "bullets" | "steps" = "plain"): string {
  const scrubbed = sanitizeUserText(raw || "");
  if (mode === "plain") return scrubbed;
  const lines = normalizeBulletText(scrubbed).split(/\n/).filter(Boolean);
  if (mode === "steps") return lines.map((l, i) => `${i + 1}. ${l}`).join("\n");
  return lines.map((l) => `- ${l}`).join("\n");
}

const STATUS_OPTS = [
  "Draft",
  "Not run",
  "Passed",
  "Failed",
  "Partial",
  "Blocked",
  "Skipped",
  "Stale",
] as const;

/** Prefix formula-like cells so Excel won't execute them. */
export function guardFormula(value: string): string {
  const s = String(value ?? "");
  if (/^[=+\-@]/.test(s)) return `'${s}`;
  return s;
}

function cell(row: SitSheetRow, key: string): string {
  return guardFormula(row.cells[key] || "");
}

export type ExportCaseRow = {
  id: string;
  jiraKey: string;
  module: string;
  feature: string;
  priority: string;
  severity: string;
  scenarioType: string;
  scenarioTitle: string;
  preconditions: string;
  steps: string;
  expected: string;
  status: string;
  actualResult: string;
  notes: string;
  origin: string;
  edited: string;
  acIds: string;
  version: string;
  statusBy: string;
  statusAt: string;
};

export function casesForExport(
  workbook: SitWorkbook,
  opts: {
    scope: ExportScope;
    viewRows?: SitSheetRow[];
    selectedKeys?: string[];
  },
): ExportCaseRow[] {
  const all =
    workbook.sheets.find((s) => s.kind === "test-cases")?.rows.filter((r) => r.cells.deleted !== "1") || [];
  let rows = all;
  if (opts.scope === "view" && opts.viewRows) rows = opts.viewRows.filter((r) => r.cells.deleted !== "1");
  if (opts.scope === "selected" && opts.selectedKeys?.length) {
    const set = new Set(opts.selectedKeys);
    rows = all.filter((r) => set.has(r.cells.requirementId || ""));
  }
  return rows.map((r) => ({
    id: cell(r, "caseId") || cell(r, "tcId") || r.id,
    jiraKey: cell(r, "requirementId"),
    module: exportText(cell(r, "module")),
    feature: exportText(cell(r, "feature")),
    priority: cell(r, "priority"),
    severity: cell(r, "severity"),
    scenarioType: cell(r, "testType"),
    scenarioTitle: exportText(cell(r, "scenario")),
    preconditions: exportText(cell(r, "preconditions"), "bullets"),
    steps: exportText(cell(r, "steps"), "steps"),
    expected: exportText(cell(r, "expected"), "bullets"),
    status: cell(r, "executionStatus") || "Not run",
    actualResult: exportText(cell(r, "actualResult")),
    notes: exportText(cell(r, "userNote")),
    origin: getCaseProvenance(r.cells).origin,
    edited: getCaseProvenance(r.cells).edited ? "yes" : "no",
    acIds: cell(r, "acIds") || cell(r, "ac"),
    version: cell(r, "version"),
    statusBy: cell(r, "statusBy"),
    statusAt: cell(r, "statusAt"),
  }));
}

export function testDataForExport(workbook: SitWorkbook, caseRows: ExportCaseRow[]): Record<string, string>[] {
  const caseIds = new Set(caseRows.map((c) => c.id));
  const out: Record<string, string>[] = [];
  const tc = workbook.sheets.find((s) => s.kind === "test-cases")?.rows || [];
  for (const r of tc) {
    if (r.cells.deleted === "1") continue;
    const id = r.cells.caseId || r.cells.tcId || r.id;
    if (!caseIds.has(id) && !caseIds.has(guardFormula(id))) continue;
    const fields: Record<string, string> = {
      testDataId: guardFormula(r.cells.testDataId || `TD-${id}`),
      caseId: guardFormula(id),
    };
    for (const [k, v] of Object.entries(r.cells)) {
      if (k.startsWith("td_") && v) fields[k.slice(3)] = guardFormula(v);
    }
    if (Object.keys(fields).length > 2) out.push(fields);
  }
  return out;
}

export function traceabilityForExport(
  workbook: SitWorkbook,
  caseRows: ExportCaseRow[],
  acByTicket: Record<string, string[]>,
): { acId: string; acText: string; jiraKey: string; coveredBy: string; uncovered: string }[] {
  const byKey = new Map<string, ExportCaseRow[]>();
  for (const c of caseRows) {
    const list = byKey.get(c.jiraKey) || [];
    list.push(c);
    byKey.set(c.jiraKey, list);
  }
  const rows: { acId: string; acText: string; jiraKey: string; coveredBy: string; uncovered: string }[] = [];
  for (const [key, acs] of Object.entries(acByTicket)) {
    const cases = byKey.get(key) || [];
    acs.forEach((text, i) => {
      const acId = `AC${i + 1}`;
      const covering = cases.filter((c) => {
        const ids = (c.acIds || "").toUpperCase();
        return ids.includes(acId) || (c.scenarioTitle + c.steps + c.expected).includes(text.slice(0, 40));
      });
      rows.push({
        acId,
        acText: guardFormula(text),
        jiraKey: key,
        coveredBy: covering.map((c) => c.id).join(", "),
        uncovered: covering.length ? "" : "yes",
      });
    });
  }
  return rows;
}

export function toCsv(rows: ExportCaseRow[]): string {
  const headers = [
    "ID",
    "Jira key",
    "Module",
    "Feature",
    "Priority",
    "Severity",
    "Scenario type",
    "Scenario title",
    "Preconditions",
    "Test Steps",
    "Expected Result",
    "Status",
    "Actual Result",
    "Notes",
    "Origin",
    "Edited",
    "AC ids",
    "Version",
    "Status set by",
    "Status set at",
  ];
  const escape = (v: string) => {
    const s = guardFormula(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        r.id,
        r.jiraKey,
        r.module,
        r.feature,
        r.priority,
        r.severity,
        r.scenarioType,
        r.scenarioTitle,
        r.preconditions,
        r.steps,
        r.expected,
        r.status,
        r.actualResult,
        r.notes,
        r.origin,
        r.edited,
        r.acIds,
        r.version,
        r.statusBy,
        r.statusAt,
      ]
        .map(escape)
        .join(","),
    ),
  ];
  return `\uFEFF${lines.join("\r\n")}`;
}

export function toCopyTable(rows: ExportCaseRow[]): string {
  const headers = [
    "ID",
    "Jira key",
    "Module",
    "Feature",
    "Priority",
    "Severity",
    "Scenario type",
    "Scenario title",
    "Preconditions",
    "Test Steps",
    "Expected Result",
    "Status",
    "Actual Result",
    "Notes",
    "Origin",
    "Edited",
    "AC ids",
  ];
  const line = (cols: string[]) => cols.map((c) => guardFormula(c).replace(/\t/g, " ")).join("\t");
  return [
    line(headers),
    ...rows.map((r) =>
      line([
        r.id,
        r.jiraKey,
        r.module,
        r.feature,
        r.priority,
        r.severity,
        r.scenarioType,
        r.scenarioTitle,
        r.preconditions,
        r.steps,
        r.expected,
        r.status,
        r.actualResult,
        r.notes,
        r.origin,
        r.edited,
        r.acIds,
      ]),
    ),
  ].join("\n");
}

export async function buildXlsxBlob(
  workbook: SitWorkbook,
  opts: {
    scope: ExportScope;
    viewRows?: SitSheetRow[];
    selectedKeys?: string[];
    projectName: string;
    canvasName: string;
    acByTicket: Record<string, string[]>;
  },
): Promise<{ blob: Blob; filename: string }> {
  const ExcelJS = (await import("exceljs")).default;
  const cases = casesForExport(workbook, opts);
  const dataRows = testDataForExport(workbook, cases);
  const trace = traceabilityForExport(workbook, cases, opts.acByTicket);

  const wb = new ExcelJS.Workbook();
  wb.creator = "AppAtlas SIT";
  const tc = wb.addWorksheet("Test Cases", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  const headers = [
    "ID",
    "Jira key",
    "Module",
    "Feature",
    "Priority",
    "Severity",
    "Scenario type",
    "Scenario title",
    "Preconditions",
    "Test Steps",
    "Expected Result",
    "Status",
    "Actual Result",
    "Notes",
    "Origin",
    "Edited",
    "AC ids",
    "Version",
    "Status set by",
    "Status set at",
  ];
  tc.addRow(headers);
  const headerRow = tc.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDE9FE" } };
  for (const r of cases) {
    tc.addRow([
      r.id,
      r.jiraKey,
      r.module,
      r.feature,
      r.priority,
      r.severity,
      r.scenarioType,
      r.scenarioTitle,
      r.preconditions,
      r.steps,
      r.expected,
      r.status,
      r.actualResult,
      r.notes,
      r.origin,
      r.edited,
      r.acIds,
      r.version,
      r.statusBy,
      r.statusAt,
    ]);
  }
  tc.getColumn(10).width = 48;
  tc.getColumn(11).width = 36;
  tc.eachRow((row, i) => {
    if (i === 1) return;
    row.getCell(10).alignment = { wrapText: true, vertical: "top" };
    row.getCell(11).alignment = { wrapText: true, vertical: "top" };
  });
  // Status dropdown validation
  if (cases.length) {
    for (let i = 2; i <= cases.length + 1; i++) {
      tc.getCell(i, 12).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`"${STATUS_OPTS.join(",")}"`],
      };
    }
  }

  const td = wb.addWorksheet("Test Data", { views: [{ state: "frozen", ySplit: 1 }] });
  const tdKeys = Array.from(new Set(dataRows.flatMap((r) => Object.keys(r))));
  td.addRow(tdKeys);
  td.getRow(1).font = { bold: true };
  for (const r of dataRows) td.addRow(tdKeys.map((k) => r[k] || ""));

  const tr = wb.addWorksheet("Traceability", { views: [{ state: "frozen", ySplit: 1 }] });
  tr.addRow(["AC id", "AC text", "Jira key", "Covered by", "Uncovered"]);
  tr.getRow(1).font = { bold: true };
  for (const r of trace) tr.addRow([r.acId, r.acText, r.jiraKey, r.coveredBy, r.uncovered]);

  const buf = await wb.xlsx.writeBuffer();
  const date = new Date().toISOString().slice(0, 10);
  const safe = (s: string) => s.replace(/[^\w.-]+/g, "_").slice(0, 40) || "x";
  const filename = `SIT_${safe(opts.projectName)}_${safe(opts.canvasName)}_${date}.xlsx`;
  return {
    blob: new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename,
  };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
