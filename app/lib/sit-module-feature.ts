/**
 * Deterministic Module / Feature labels for SIT v2 (display + new generations).
 * Module = epic name, max 2 words. Feature = ticket summary without Jira/WALLET prefix, max 2 words.
 */

const STOP = new Set(["a", "an", "the", "and", "or", "of", "to", "for", "with", "&"]);

export function twoMeaningfulWords(raw: string, max = 2): string {
  const words = (raw || "")
    .replace(/[&/|_-]+/g, " ")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const picked: string[] = [];
  for (const w of words) {
    if (STOP.has(w.toLowerCase()) && picked.length === 0) continue;
    picked.push(w);
    if (picked.length >= max) break;
  }
  if (!picked.length && words.length) return words.slice(0, max).join(" ");
  return picked.join(" ");
}

/** Strip leading Jira / WALLET keys from a summary, e.g. "WALLET-102: Login" → "Login". */
export function stripTicketKeyPrefix(summary: string): string {
  return (summary || "")
    .replace(/^[A-Z][A-Z0-9]+-\d+\s*[:\-–—]\s*/i, "")
    .replace(/^WALLET-\d+\s*[:\-–—]\s*/i, "")
    .trim();
}

export function deriveSitModule(epicSummary: string | null | undefined): string {
  const s = (epicSummary || "").trim();
  if (!s || s === "Unassigned / other tickets") return "Application";
  return twoMeaningfulWords(s, 2) || "Application";
}

export function deriveSitFeature(ticketSummary: string | null | undefined): string {
  const stripped = stripTicketKeyPrefix(ticketSummary || "");
  return twoMeaningfulWords(stripped, 2) || "Feature";
}

export type EpicLookup = { key: string; summary: string; tickets: { key: string; summary: string; epicKey?: string | null }[] };

/** Resolve epic summary for a ticket key from the SIT epic tree. */
export function epicSummaryForTicket(epics: EpicLookup[], ticketKey: string): string {
  for (const e of epics) {
    if (e.tickets.some((t) => t.key === ticketKey)) return e.summary;
  }
  return "";
}

export function ticketSummaryForKey(epics: EpicLookup[], ticketKey: string): string {
  for (const e of epics) {
    const t = e.tickets.find((x) => x.key === ticketKey);
    if (t) return t.summary;
  }
  return ticketKey;
}

/** Display-only remap of module/feature cells (does not mutate stored workbook). */
export function displayModuleFeature(
  cells: Record<string, string>,
  epics: EpicLookup[],
): { module: string; feature: string } {
  const ticketKey = cells.requirementId || cells.issueKey || "";
  const epicSum = epicSummaryForTicket(epics, ticketKey);
  const ticketSum = ticketSummaryForKey(epics, ticketKey) || cells.feature || "";
  return {
    module: deriveSitModule(epicSum),
    feature: deriveSitFeature(ticketSum),
  };
}
