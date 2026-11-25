"use client";

import { useState } from "react";
import { TbPlus, TbTrash } from "react-icons/tb";
import type { Assertion, RequestOverrides } from "@/app/interfaces/api-testing";
import { cellText, parseCell } from "@/app/lib/api-testing/rows";
import { box, iconButton, input, label, mono, outlineButton, SECRET_NAME } from "./ui";

/** Name/value rows. "json" mode parses values (5, true, null, "text"); "text" keeps them as text. Secret-looking names are masked. */
export function KeyValueEditor({
  value,
  onChange,
  mode = "text",
  keyPlaceholder = "name",
  valuePlaceholder = "value or {{variable}}",
  addLabel = "Add",
}: {
  value: Record<string, unknown> | undefined;
  onChange: (next: Record<string, unknown> | undefined) => void;
  mode?: "text" | "json";
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  addLabel?: string;
}) {
  // Rows are kept as a list so a half-typed name does not collide with another row.
  const [rows, setRows] = useState<{ k: string; v: string }[]>(() =>
    Object.entries(value ?? {}).map(([k, v]) => ({ k, v: mode === "json" ? cellText(v) : String(v ?? "") })),
  );
  const push = (next: { k: string; v: string }[]) => {
    setRows(next);
    const out: Record<string, unknown> = {};
    for (const r of next) if (r.k.trim()) out[r.k.trim()] = mode === "json" ? (parseCell(r.v) ?? "") : r.v;
    onChange(Object.keys(out).length ? out : undefined);
  };
  return (
    <div className="space-y-1.5">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input
            className={`${input} ${mono} max-w-[38%]`}
            value={r.k}
            placeholder={keyPlaceholder}
            onChange={(e) => push(rows.map((x, j) => (j === i ? { ...x, k: e.target.value } : x)))}
          />
          <input
            className={`${input} ${mono}`}
            type={SECRET_NAME.test(r.k) ? "password" : "text"}
            autoComplete="off"
            value={r.v}
            placeholder={valuePlaceholder}
            onChange={(e) => push(rows.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)))}
          />
          <button type="button" className={iconButton} aria-label="Remove" onClick={() => push(rows.filter((_, j) => j !== i))}>
            <TbTrash size={14} />
          </button>
        </div>
      ))}
      <button type="button" className={`${outlineButton} !px-2 !py-1 !text-[11.5px]`} onClick={() => setRows([...rows, { k: "", v: "" }])}>
        <TbPlus size={12} /> {addLabel}
      </button>
    </div>
  );
}

/** Request body: an editable list of top-level fields (password-like values masked), or raw JSON. */
export function BodyEditor({ value, onChange }: { value: unknown; onChange: (next: unknown) => void }) {
  const isObject = value !== null && typeof value === "object" && !Array.isArray(value);
  const [json, setJson] = useState(value === undefined || isObject ? false : true);
  const [text, setText] = useState(() => (value === undefined ? "" : JSON.stringify(value, null, 2)));
  const [error, setError] = useState<string | null>(null);

  if (!json && (value === undefined || isObject)) {
    return (
      <div>
        <KeyValueEditor
          value={value as Record<string, unknown> | undefined}
          mode="json"
          keyPlaceholder="field"
          addLabel="Add body field"
          onChange={(next) => onChange(next)}
        />
        <button
          type="button"
          className="mt-1.5 text-[11px] text-[#8664F2] hover:underline"
          onClick={() => {
            setText(value === undefined ? "" : JSON.stringify(value, null, 2));
            setJson(true);
          }}
        >
          Edit as JSON (values show as plain text)
        </button>
      </div>
    );
  }
  return (
    <div>
      <textarea
        className={`${input} ${mono} min-h-[96px] ${error ? "!border-[#DC2626]" : ""}`}
        spellCheck={false}
        value={text}
        placeholder='{ "field": "value or {{variable}}" }'
        onChange={(e) => {
          const t = e.target.value;
          setText(t);
          if (!t.trim()) {
            setError(null);
            onChange(undefined);
            return;
          }
          try {
            onChange(JSON.parse(t));
            setError(null);
          } catch {
            setError("Not valid JSON yet; the last valid body is kept.");
          }
        }}
      />
      {error && <div className="mt-1 text-[11px] text-[#DC2626]">{error}</div>}
      {value === undefined || isObject ? (
        !error && (
          <button type="button" className="mt-1 text-[11px] text-[#8664F2] hover:underline" onClick={() => setJson(false)}>
            Back to fields
          </button>
        )
      ) : null}
    </div>
  );
}

/** Path, query, header and body overrides for one request. Everything accepts {{variables}}. */
export function OverridesEditor({ value, onChange, showBody = true }: { value: RequestOverrides; onChange: (next: RequestOverrides) => void; showBody?: boolean }) {
  const set = (patch: Partial<RequestOverrides>) => {
    const next = { ...value, ...patch };
    for (const k of Object.keys(next) as (keyof RequestOverrides)[]) if (next[k] === undefined) delete next[k];
    onChange(next);
  };
  return (
    <div className="space-y-3">
      <div>
        <div className={label}>Path parameters</div>
        <KeyValueEditor mode="json" value={value.pathParams} keyPlaceholder="id" onChange={(v) => set({ pathParams: v as RequestOverrides["pathParams"] })} addLabel="Add path parameter" />
      </div>
      <div>
        <div className={label}>Query</div>
        <KeyValueEditor mode="json" value={value.query} keyPlaceholder="limit" onChange={(v) => set({ query: v as RequestOverrides["query"] })} addLabel="Add query parameter" />
      </div>
      <div>
        <div className={label}>Headers</div>
        <KeyValueEditor value={value.headers} keyPlaceholder="Authorization" onChange={(v) => set({ headers: v as RequestOverrides["headers"] })} addLabel="Add header" />
      </div>
      {showBody && (
        <div>
          <div className={label}>Body</div>
          <BodyEditor value={value.body} onChange={(b) => set({ body: b })} />
        </div>
      )}
    </div>
  );
}

const TYPES = ["string", "number", "integer", "boolean", "object", "array", "null"];

/** Assertions on status, a body value by JSONPath, a header and response time. */
export function AssertionsEditor({ value, onChange }: { value: Assertion[]; onChange: (next: Assertion[]) => void }) {
  const update = (i: number, a: Assertion) => onChange(value.map((x, j) => (j === i ? a : x)));
  const remove = (i: number) => onChange(value.filter((_, j) => j !== i));
  const select = "rounded-[6px] border border-[#D9D9D9] bg-white px-1.5 py-1 text-[12px] text-[#1F1F1F] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] dark:text-[#ededed]";
  return (
    <div className="space-y-1.5">
      {value.length === 0 && <div className={`${box} px-3 py-2 text-[12px] text-[#7E7E7E]`}>No assertions yet.</div>}
      {value.map((a, i) => (
        <div key={i} className="flex flex-wrap items-center gap-1.5">
          <span className="w-[74px] shrink-0 text-[10.5px] font-semibold tracking-wide text-[#5E6066] uppercase dark:text-[#9ca3af]">{a.kind === "responseTime" ? "time" : a.kind}</span>
          {a.kind === "status" && (
            <>
              <select className={select} value={a.op} onChange={(e) => update(i, { ...a, op: e.target.value as "equals" | "in" | "class" })}>
                <option value="equals">equals</option>
                <option value="in">is one of</option>
                <option value="class">is class</option>
              </select>
              <input
                className={`${input} ${mono} !w-[140px]`}
                placeholder={a.op === "class" ? "2xx" : a.op === "in" ? "200, 201" : "200"}
                value={Array.isArray(a.value) ? a.value.join(", ") : String(a.value)}
                onChange={(e) => {
                  const t = e.target.value;
                  update(i, { ...a, value: a.op === "in" ? t.split(",").map((x) => x.trim()).filter(Boolean) : t.trim() });
                }}
              />
            </>
          )}
          {a.kind === "body" && (
            <>
              <input className={`${input} ${mono} !w-[150px]`} placeholder="$.user.id" value={a.path} onChange={(e) => update(i, { ...a, path: e.target.value })} />
              <select className={select} value={a.op} onChange={(e) => update(i, { ...a, op: e.target.value as Extract<Assertion, { kind: "body" }>["op"] })}>
                {["equals", "contains", "exists", "notExists", "type"].map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              {a.op === "type" ? (
                <select className={select} value={String(a.value ?? "string")} onChange={(e) => update(i, { ...a, value: e.target.value })}>
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              ) : a.op === "exists" || a.op === "notExists" ? null : (
                <input
                  className={`${input} ${mono} !w-[140px]`}
                  type={SECRET_NAME.test(a.path) ? "password" : "text"}
                  autoComplete="off"
                  placeholder='value (5, true, "text")'
                  value={cellText(a.value)}
                  onChange={(e) => update(i, { ...a, value: parseCell(e.target.value) })}
                />
              )}
            </>
          )}
          {a.kind === "header" && (
            <>
              <input className={`${input} ${mono} !w-[140px]`} placeholder="Content-Type" value={a.name} onChange={(e) => update(i, { ...a, name: e.target.value })} />
              <select className={select} value={a.op} onChange={(e) => update(i, { ...a, op: e.target.value as "equals" | "contains" | "exists" })}>
                <option value="equals">equals</option>
                <option value="contains">contains</option>
                <option value="exists">exists</option>
              </select>
              {a.op !== "exists" && <input className={`${input} ${mono} !w-[140px]`} placeholder="value" value={a.value ?? ""} onChange={(e) => update(i, { ...a, value: e.target.value })} />}
            </>
          )}
          {a.kind === "responseTime" && (
            <>
              <span className="text-[12px] text-[#5E6066] dark:text-[#9ca3af]">under</span>
              <input className={`${input} !w-[80px]`} type="number" min={1} value={a.maxMs} onChange={(e) => update(i, { ...a, maxMs: Math.max(1, Number(e.target.value) || 1) })} />
              <span className="text-[12px] text-[#5E6066] dark:text-[#9ca3af]">ms</span>
            </>
          )}
          <button type="button" className={iconButton} aria-label="Remove assertion" onClick={() => remove(i)}>
            <TbTrash size={14} />
          </button>
        </div>
      ))}
      <div className="flex flex-wrap gap-1.5 pt-0.5">
        {(
          [
            ["Status", { kind: "status", op: "equals", value: 200 }],
            ["Body value", { kind: "body", path: "$.", op: "exists" }],
            ["Header", { kind: "header", name: "Content-Type", op: "contains", value: "json" }],
            ["Response time", { kind: "responseTime", maxMs: 1000 }],
          ] as [string, Assertion][]
        ).map(([name, a]) => (
          <button key={name} type="button" className={`${outlineButton} !px-2 !py-1 !text-[11.5px]`} onClick={() => onChange([...value, a])}>
            <TbPlus size={12} /> {name}
          </button>
        ))}
      </div>
    </div>
  );
}
