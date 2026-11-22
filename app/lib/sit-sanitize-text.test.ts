import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { findForbiddenDashChars, sanitizeUserText } from "./sit-sanitize-text";

describe("R5 A4 / R6 A6 FE dash scan", () => {
  it("sanitize removes forbidden chars", () => {
    expect(findForbiddenDashChars(sanitizeUserText("a\u2014b\u2013c\u2192d"))).toEqual([]);
  });

  it("A6 quoted arrow label has no dangling to", () => {
    const s = sanitizeUserText("Tap 'Upload document \u2192'");
    expect(findForbiddenDashChars(s)).toEqual([]);
    expect(s).toMatch(/Upload document/);
    expect(s).not.toMatch(/Upload document\s+to/);
  });

  it("A6 dangling to inside quotes is cleaned", () => {
    expect(sanitizeUserText("Tap 'Upload document to '")).toBe("Tap 'Upload document'");
  });

  it("scans sit-v2 UI source strings and fails on U+2014/U+2013/U+2192 outside comments", () => {
    const dir = path.join(__dirname, "../components/app-atlas/sit-v2");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"));
    const offenders: string[] = [];
    for (const f of files) {
      if (f.endsWith(".test.ts") || f.endsWith(".test.tsx")) continue;
      let text = fs.readFileSync(path.join(dir, f), "utf8");
      // Strip // and /* */ comments roughly
      text = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      const hits = findForbiddenDashChars(text);
      if (hits.length) offenders.push(`${f}:${hits.join(",")}`);
    }
    expect(offenders, offenders.join("; ")).toEqual([]);
  });
});
