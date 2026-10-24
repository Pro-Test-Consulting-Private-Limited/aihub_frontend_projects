import type { Assertion, DataRow, RequestOverrides } from "@/app/interfaces/api-testing";

/* Pure helpers for the Data Driven table: cell text <-> request values, and CSV / JSON import. */

/** Cell text -> value. Valid JSON ("5", "true", "null", "\"\"", "{...}") is parsed; anything else is sent as text. Empty = omit. */
export function parseCell(text: string): unknown {
  const t = text.trim();
  if (t === "") return undefined;
  try {
    return JSON.parse(t);
  } catch {
    return text;
  }
}

/** Value -> cell text that parseCell turns back into the same value: "" shows as "" (two quotes) and text that looks like JSON is quoted. */
export function cellText(v: unknown): string {
  if (v === undefined) return "";
  if (typeof v !== "string") return JSON.stringify(v);
  if (v === "") return '""';
  try {
    JSON.parse(v);
    return JSON.stringify(v);
  } catch {
    return v;
  }
}

export type Column = { id: string; where: "path" | "query" | "header" | "body"; name: string };

export const columnId = (where: Column["where"], name: string) => `${where}:${name}`;

export function getCell(req: RequestOverrides, c: Column): unknown {
  if (c.where === "path") return req.pathParams?.[c.name];
  if (c.where === "query") return req.query?.[c.name];
  if (c.where === "header") return req.headers?.[c.name];
  return req.body && typeof req.body === "object" && !Array.isArray(req.body) ? (req.body as Record<string, unknown>)[c.name] : undefined;
}

/** Returns a new request with one cell set (undefined removes the field). */
export function setCell(req: RequestOverrides, c: Column, text: string): RequestOverrides {
  const next: RequestOverrides = { ...req };
  const value = parseCell(text);
  const put = <T,>(obj: Record<string, T> | undefined, v: unknown): Record<string, T> | undefined => {
    const copy = { ...(obj ?? {}) };
    if (v === undefined) delete copy[c.name];
    else copy[c.name] = v as T;
    return Object.keys(copy).length ? copy : undefined;
  };
  if (c.where === "path") next.pathParams = put<string | number>(req.pathParams, value === undefined ? undefined : typeof value === "number" ? value : String(value));
  else if (c.where === "query") next.query = put<string | number | boolean>(req.query, value === undefined ? undefined : typeof value === "object" ? JSON.stringify(value) : (value as string | number | boolean));
  else if (c.where === "header") next.headers = put<string>(req.headers, value === undefined ? undefined : cellText(value));
  else {
    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? (req.body as Record<string, unknown>) : {};
    next.body = put<unknown>(body, value);
    if (next.body === undefined && req.body === undefined) delete next.body;
  }
  for (const k of Object.keys(next) as (keyof RequestOverrides)[]) if (next[k] === undefined) delete next[k];
  return next;
}

/** Columns for the table: every spec parameter and top-level body field, plus any field a row uses that the spec does not list. */
export function buildColumns(params: { name: string; in: string }[], bodyFields: string[], rows: DataRow[]): Column[] {
  const cols = new Map<string, Column>();
  const add = (where: Column["where"], name: string) => cols.set(columnId(where, name), { id: columnId(where, name), where, name });
  for (const p of params) if (p.in === "path" || p.in === "query" || p.in === "header") add(p.in, p.name);
  for (const f of bodyFields) add("body", f);
  for (const r of rows) {
    for (const n of Object.keys(r.request.pathParams ?? {})) add("path", n);
    for (const n of Object.keys(r.request.query ?? {})) add("query", n);
    for (const n of Object.keys(r.request.headers ?? {})) add("header", n);
    if (r.request.body && typeof r.request.body === "object" && !Array.isArray(r.request.body)) for (const n of Object.keys(r.request.body)) add("body", n);
  }
  return [...cols.values()];
}

/** RFC 4180-style CSV: quoted cells, doubled quotes, commas and newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const csvCell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export class ImportError extends Error {}

let counter = 0;
export const newId = () => `row-${Date.now().toString(36)}-${(counter++).toString(36)}`;

/**
 * CSV header names: label, status (expected status, default 2xx), path:<param>, query:<param>, header:<name>,
 * body:<field> (dots make nested fields: body:user.email) and assert:<$.json.path> (the cell is the expected value).
 */
export function rowsFromCsv(text: string): DataRow[] {
  const table = parseCsv(text);
  if (table.length < 2) throw new ImportError("The CSV needs a header row and at least one data row.");
  const header = table[0].map((h) => h.trim());
  const known = (h: string) => h === "label" || h === "status" || /^(path|query|header|body|assert):.+/.test(h);
  const bad = header.filter((h) => h && !known(h));
  if (bad.length) throw new ImportError(`Unknown column${bad.length > 1 ? "s" : ""}: ${bad.join(", ")}. Use label, status, path:<name>, query:<name>, header:<name>, body:<field> or assert:<$.path>.`);
  return table.slice(1).map((cells) => {
    const row: DataRow = { id: newId(), request: {}, expectedStatus: "2xx", assertions: [], origin: "import" };
    header.forEach((h, i) => {
      const text = cells[i] ?? "";
      if (!h || text.trim() === "") return;
      if (h === "label") row.label = text;
      else if (h === "status") {
        if (!/^([1-5]xx|[1-5]\d\d)$/i.test(text.trim())) throw new ImportError(`Invalid status '${text}'. Use 2xx, 4xx or a code like 404.`);
        row.expectedStatus = text.trim().toLowerCase();
      } else if (h.startsWith("assert:")) row.assertions.push({ kind: "body", path: h.slice(7), op: "equals", value: parseCell(text) });
      else {
        const [where, ...rest] = h.split(":");
        const name = rest.join(":");
        if (where === "body") {
          const segs = name.split(".");
          const body = (row.request.body ?? {}) as Record<string, unknown>;
          let cur = body;
          segs.slice(0, -1).forEach((s) => {
            cur[s] = (cur[s] && typeof cur[s] === "object" ? cur[s] : {}) as Record<string, unknown>;
            cur = cur[s] as Record<string, unknown>;
          });
          cur[segs[segs.length - 1]] = parseCell(text);
          row.request.body = body;
        } else row.request = setCell(row.request, { id: h, where: where as Column["where"], name }, text);
      }
    });
    return row;
  });
}

const STATUS = /^([1-5]xx|[1-5]\d\d)$/i;

/** JSON import: an array of rows (or { rows: [...] }) shaped like DataRow: { label?, expectedStatus?, request?, assertions? }. */
export function rowsFromJson(text: string): DataRow[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ImportError("That is not valid JSON.");
  }
  const list = Array.isArray(data) ? data : data && typeof data === "object" && Array.isArray((data as { rows?: unknown }).rows) ? (data as { rows: unknown[] }).rows : null;
  if (!list) throw new ImportError("Expected a JSON array of rows, or an object with a rows array.");
  if (!list.length) throw new ImportError("The JSON has no rows.");
  return list.map((raw, i) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new ImportError(`Row ${i + 1} must be an object.`);
    const r = raw as Record<string, unknown>;
    const status = r.expectedStatus ?? r.status ?? "2xx";
    if (typeof status !== "string" && typeof status !== "number") throw new ImportError(`Row ${i + 1}: expectedStatus must be like 2xx or 404.`);
    if (!STATUS.test(String(status).trim())) throw new ImportError(`Row ${i + 1}: invalid expected status '${String(status)}'.`);
    const request = (r.request && typeof r.request === "object" ? r.request : {}) as RequestOverrides;
    const assertions = Array.isArray(r.assertions) ? (r.assertions as Assertion[]) : [];
    return { id: newId(), label: typeof r.label === "string" ? r.label : undefined, request, expectedStatus: String(status).trim().toLowerCase(), assertions, origin: "import" as const };
  });
}

/** Rows -> CSV in the same format rowsFromCsv reads (body fields flat; nested values as JSON). Assertions are not exported. */
export function rowsToCsv(rows: DataRow[], columns: Column[]): string {
  const head = ["label", "status", ...columns.map((c) => c.id)];
  const lines = [head.map(csvCell).join(",")];
  for (const r of rows) lines.push([r.label ?? "", r.expectedStatus, ...columns.map((c) => cellText(getCell(r.request, c)))].map(csvCell).join(","));
  return lines.join("\n");
}

export const newRow = (partial: Partial<DataRow> = {}): DataRow => ({ id: newId(), request: {}, expectedStatus: "2xx", assertions: [], origin: "manual", ...partial });

/** First row of the Data Driven table: the spec's own example values (path/query examples and the request body example). */
export function rowFromSpecExample(detail: { params: { name: string; in: string; required?: boolean; example?: unknown }[]; body: { example: unknown } | null }): DataRow {
  const request: RequestOverrides = {};
  for (const p of detail.params) {
    if (p.example === undefined || p.example === null) continue;
    if (p.in === "path") (request.pathParams ??= {})[p.name] = typeof p.example === "number" ? p.example : String(p.example);
    else if (p.in === "query") (request.query ??= {})[p.name] = typeof p.example === "number" || typeof p.example === "boolean" ? p.example : String(p.example);
  }
  const example = detail.body?.example;
  if (example !== undefined && example !== null) request.body = example;
  return { id: newId(), label: "Spec example", request, expectedStatus: "2xx", assertions: [], origin: "spec-example" };
}
