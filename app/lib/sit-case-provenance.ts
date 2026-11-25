/**
 * Round 13: single source of truth for case origin + edited modifier.
 *
 * Origin: who created the case (ai | human). Legacy "template" maps to ai for
 * chip math (All = AI + Human) and is exposed via legacyTemplate for rare UI.
 * Edited: content changed by a person after creation. Backend markEdited only
 * sets edited on AI/template rows, never on human rows (R10). Status, actual
 * result, and notes must never flip edited (R10-06).
 */

export type CaseOrigin = "ai" | "human";

export type CaseProvenance = {
  origin: CaseOrigin;
  /** True when a person changed content fields after creation. */
  edited: boolean;
  /** Old template rows (counted under AI for All = AI + Human). */
  legacyTemplate: boolean;
};

type CellsLike = Record<string, string | undefined> | null | undefined;

function rawOrigin(cells: CellsLike): string {
  return String(cells?.origin || "ai").toLowerCase();
}

/**
 * Pure provenance for one case.
 * Edited requires cells.edited truthy AND origin is not human.
 */
export function getCaseProvenance(cells: CellsLike): CaseProvenance {
  const o = rawOrigin(cells);
  const legacyTemplate = o === "template";
  const origin: CaseOrigin = o === "human" ? "human" : "ai";
  const editedFlag = cells?.edited === "1" || cells?.edited === "true";
  const edited = !!editedFlag && origin !== "human";
  return { origin, edited, legacyTemplate };
}

export type ProvenanceCounts = {
  total: number;
  ai: number;
  human: number;
  edited: number;
  /** Always total === ai + human */
  ok: boolean;
};

/** Count origin over a row list (ticket scope). Edited is independent. */
export function countProvenance(
  rows: Array<{ cells: Record<string, string> }>,
  opts?: { origin?: CaseOrigin | "all"; editedOnly?: boolean },
): ProvenanceCounts {
  const wantOrigin = opts?.origin ?? "all";
  const editedOnly = !!opts?.editedOnly;
  let ai = 0;
  let human = 0;
  let edited = 0;
  for (const r of rows) {
    const p = getCaseProvenance(r.cells);
    if (wantOrigin === "ai" && p.origin !== "ai") continue;
    if (wantOrigin === "human" && p.origin !== "human") continue;
    if (editedOnly && !p.edited) continue;
    if (p.origin === "human") human++;
    else ai++;
    if (p.edited) edited++;
  }
  const total = ai + human;
  return { total, ai, human, edited, ok: total === ai + human };
}

/**
 * Migrate persisted origin filter.
 * Old value "edited" -> origin all + editedToggle on.
 */
export function migrateOriginFilterPersist(raw: string | null | undefined): {
  origin: CaseOrigin | "all";
  editedOnly: boolean;
} {
  if (!raw || raw === "all" || raw === "null") return { origin: "all", editedOnly: false };
  if (raw === "edited") return { origin: "all", editedOnly: true };
  if (raw === "ai" || raw === "human") return { origin: raw, editedOnly: false };
  if (raw === "template") return { origin: "ai", editedOnly: false };
  return { origin: "all", editedOnly: false };
}

export const EDITED_TOGGLE_TOOLTIP =
  "Cases changed by a person after creation. Does not include status, results or notes.";

export const SOURCE_GROUP_LABEL = "Source";
