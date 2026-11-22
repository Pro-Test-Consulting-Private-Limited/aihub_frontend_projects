"use client";

import type { SitSheetRow } from "@/app/interfaces/appatlas";

export type FieldEditMeta = { from: string; to: string; by: string; at: string };

const TRACKED = [
  "scenario",
  "testType",
  "priority",
  "severity",
  "preconditions",
  "steps",
  "expected",
  "module",
  "feature",
] as const;

export function parseEditedFields(cells: Record<string, string>): Record<string, FieldEditMeta> {
  if (!cells.editedFields) return {};
  try {
    const raw = JSON.parse(cells.editedFields) as Record<string, FieldEditMeta>;
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

export function parseAiOriginal(cells: Record<string, string>): Record<string, string> | null {
  if (!cells.aiOriginal) return null;
  try {
    return JSON.parse(cells.aiOriginal) as Record<string, string>;
  } catch {
    return null;
  }
}

/** AI rows only: fields that differ from aiOriginal or appear in editedFields. */
export function editedFieldKeys(row: SitSheetRow): string[] {
  if ((row.cells.origin || "ai") === "human") return [];
  if (row.cells.edited !== "1" && row.cells.edited !== "true") return [];
  const map = parseEditedFields(row.cells);
  const snap = parseAiOriginal(row.cells);
  const keys = new Set<string>(Object.keys(map));
  if (snap) {
    for (const f of TRACKED) {
      if (snap[f] != null && String(row.cells[f] || "") !== String(snap[f])) keys.add(f);
    }
  }
  return [...keys];
}

export function fieldEditTooltip(row: SitSheetRow, field: string): string {
  const map = parseEditedFields(row.cells);
  const meta = map[field];
  const snap = parseAiOriginal(row.cells);
  const from = meta?.from ?? (snap?.[field] != null ? snap[field]! : "");
  const to = meta?.to ?? row.cells[field] ?? "";
  const by = meta?.by || row.cells.editedBy || "unknown";
  const at = meta?.at || row.cells.editedAt;
  const when = at ? new Date(Number(at)).toLocaleString() : "";
  const fromLabel = from !== "" ? from : "changed (original not recorded)";
  return [
    `Field: ${field}`,
    `AI original: ${fromLabel}`,
    `New: ${to || "(empty)"}`,
    `Edited by ${by}${when ? ` at ${when}` : ""}`,
  ].join("\n");
}

/** Small purple dot on an edited cell (AI only). */
export function SitV2EditDot({ row, field }: { row: SitSheetRow; field: string }) {
  if ((row.cells.origin || "ai") === "human") return null;
  const keys = editedFieldKeys(row);
  if (!keys.includes(field)) return null;
  return (
    <span
      className="ml-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#8664F2] align-middle"
      title={fieldEditTooltip(row, field)}
      data-testid={`sit-edit-dot-${field}`}
      data-edit-dot={field}
      aria-label={`Edited ${field}`}
    />
  );
}

export function listFieldEdits(row: SitSheetRow): {
  field: string;
  from: string;
  to: string;
  by: string;
  at: string;
  originalRecorded: boolean;
}[] {
  const keys = editedFieldKeys(row);
  const map = parseEditedFields(row.cells);
  const snap = parseAiOriginal(row.cells);
  return keys.map((field) => {
    const meta = map[field];
    const fromSnap = snap?.[field];
    const originalRecorded = meta?.from != null || fromSnap != null;
    return {
      field,
      from: meta?.from ?? fromSnap ?? "",
      to: meta?.to ?? row.cells[field] ?? "",
      by: meta?.by || row.cells.editedBy || "",
      at: meta?.at || row.cells.editedAt || "",
      originalRecorded,
    };
  });
}
