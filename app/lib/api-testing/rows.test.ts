import { describe, expect, it } from "vitest";
import { buildColumns, cellText, getCell, ImportError, parseCell, parseCsv, rowFromSpecExample, rowsFromCsv, rowsFromJson, rowsToCsv, setCell } from "./rows";

describe("parseCell / cellText", () => {
  it("parses JSON literals, keeps other text, and treats empty as omitted", () => {
    expect(parseCell("5")).toBe(5);
    expect(parseCell("true")).toBe(true);
    expect(parseCell("null")).toBeNull();
    expect(parseCell('""')).toBe("");
    expect(parseCell('{"a":1}')).toEqual({ a: 1 });
    expect(parseCell("hello@x.co")).toBe("hello@x.co");
    expect(parseCell("   ")).toBeUndefined();
  });
  it("round-trips through cellText", () => {
    for (const v of [5, true, null, "", "text", "5", "true", { a: [1] }]) expect(parseCell(cellText(v))).toEqual(v);
  });
});

describe("setCell / getCell", () => {
  const body = { id: "body:email", where: "body", name: "email" } as const;
  it("sets and clears body, query, header and path cells without touching the rest", () => {
    let req = setCell({}, body, "a@b.co");
    req = setCell(req, { id: "body:age", where: "body", name: "age" }, "30");
    expect(req.body).toEqual({ email: "a@b.co", age: 30 });
    req = setCell(req, body, "");
    expect(req.body).toEqual({ age: 30 });
    req = setCell(req, { id: "path:id", where: "path", name: "id" }, "7");
    expect(req.pathParams).toEqual({ id: 7 });
    req = setCell(req, { id: "query:q", where: "query", name: "q" }, "x");
    expect(req.query).toEqual({ q: "x" });
    req = setCell(req, { id: "header:X-A", where: "header", name: "X-A" }, "1");
    expect(req.headers).toEqual({ "X-A": "1" });
    expect(getCell(req, body)).toBeUndefined();
    expect(getCell(req, { id: "body:age", where: "body", name: "age" })).toBe(30);
  });
  it("removes an emptied container so the request stays clean", () => {
    const req = setCell(setCell({}, { id: "query:q", where: "query", name: "q" }, "x"), { id: "query:q", where: "query", name: "q" }, "");
    expect(req).toEqual({});
  });
});

describe("parseCsv", () => {
  it("handles quotes, commas and newlines inside quotes, CRLF and a BOM", () => {
    expect(parseCsv('\uFEFFa,b\r\n"x,1","he said ""hi"""\r\n"line1\nline2",z\r\n')).toEqual([["a", "b"], ["x,1", 'he said "hi"'], ["line1\nline2", "z"]]);
  });
  it("drops blank lines", () => {
    expect(parseCsv("a,b\n\n1,2\n")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("rowsFromCsv", () => {
  const csv = ["label,status,body:email,body:password,body:profile.age,query:limit,header:X-Trace,assert:$.user.role", 'valid,2xx,qa@example.com,"pa,ss",30,5,abc,user', "bad email,400,not-an-email,pa55word12,,,,"].join("\n");
  it("builds one row per line with typed values, nested body fields and assertions", () => {
    const rows = rowsFromCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ label: "valid", expectedStatus: "2xx", origin: "import" });
    expect(rows[0].request.body).toEqual({ email: "qa@example.com", password: "pa,ss", profile: { age: 30 } });
    expect(rows[0].request.query).toEqual({ limit: 5 });
    expect(rows[0].request.headers).toEqual({ "X-Trace": "abc" });
    expect(rows[0].assertions).toEqual([{ kind: "body", path: "$.user.role", op: "equals", value: "user" }]);
    expect(rows[1].expectedStatus).toBe("400");
    expect(rows[1].request.body).toEqual({ email: "not-an-email", password: "pa55word12" });
    expect(new Set(rows.map((r) => r.id)).size).toBe(2);
  });
  it("rejects unknown columns, bad statuses and an empty file with a clear message", () => {
    expect(() => rowsFromCsv("foo,bar\n1,2")).toThrow(/Unknown column/);
    expect(() => rowsFromCsv("status,body:a\nabc,1")).toThrow(/Invalid status/);
    expect(() => rowsFromCsv("label")).toThrow(ImportError);
  });
});

describe("rowsFromJson", () => {
  it("accepts an array or { rows } and normalises the status", () => {
    const rows = rowsFromJson(JSON.stringify([{ label: "a", expectedStatus: "4XX", request: { body: { x: 1 } } }, { status: 404 }]));
    expect(rows.map((r) => r.expectedStatus)).toEqual(["4xx", "404"]);
    expect(rowsFromJson('{"rows":[{}]}')[0].expectedStatus).toBe("2xx");
  });
  it("rejects malformed input", () => {
    expect(() => rowsFromJson("{")).toThrow(/not valid JSON/);
    expect(() => rowsFromJson('{"a":1}')).toThrow(/array of rows/);
    expect(() => rowsFromJson("[]")).toThrow(/no rows/);
    expect(() => rowsFromJson('[1]')).toThrow(/Row 1 must be an object/);
    expect(() => rowsFromJson('[{"expectedStatus":"nope"}]')).toThrow(/invalid expected status/);
  });
});

describe("buildColumns / rowsToCsv", () => {
  it("lists spec params and body fields first, then fields only rows use, and exports to importable CSV", () => {
    const rows = rowsFromCsv("label,status,body:email,body:extra\nx,2xx,a@b.co,1");
    const cols = buildColumns([{ name: "id", in: "path" }, { name: "cookie", in: "cookie" }], ["email"], rows);
    expect(cols.map((c) => c.id)).toEqual(["path:id", "body:email", "body:extra"]);
    const back = rowsFromCsv(rowsToCsv(rows, cols));
    expect(back[0].request.body).toEqual({ email: "a@b.co", extra: 1 });
    expect(back[0].label).toBe("x");
  });
});

describe("rowFromSpecExample", () => {
  it("pre-fills path, query and body from the spec examples", () => {
    const row = rowFromSpecExample({
      params: [{ name: "id", in: "path", example: 7 }, { name: "limit", in: "query", example: 10 }, { name: "x", in: "header", example: "ignored" }, { name: "q", in: "query" }],
      body: { example: { email: "qa@example.com" } },
    });
    expect(row.origin).toBe("spec-example");
    expect(row.expectedStatus).toBe("2xx");
    expect(row.request).toEqual({ pathParams: { id: 7 }, query: { limit: 10 }, body: { email: "qa@example.com" } });
  });
  it("gives an empty request when the spec has no examples", () => {
    expect(rowFromSpecExample({ params: [], body: null }).request).toEqual({});
  });
});
