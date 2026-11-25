import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(__dirname, "..");

const FORBIDDEN_LABELS = [
  "AI Model Active",
  "AI Model Starting",
  "AI Model Inactive",
  "Model · ",
  "Model ·",
];

const ALLOWED = new Set([
  path.normalize(path.join(ROOT, "components/model-status-pill.tsx")),
  path.normalize(path.join(ROOT, "components/model-status-pill.test.ts")),
  path.normalize(path.join(ROOT, "components/model-status-pill.test.tsx")),
  path.normalize(path.join(ROOT, "components/model-status-pill-single-source.test.ts")),
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === "out") continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?|mjs|cjs)$/.test(name)) out.push(p);
  }
  return out;
}

describe("ModelStatusPill single source", () => {
  it("forbidden pill labels only live in model-status-pill (+ its tests)", () => {
    const files = walk(ROOT);
    const offenders: string[] = [];
    for (const file of files) {
      const norm = path.normalize(file);
      if (ALLOWED.has(norm)) continue;
      // ignore this meta-test's own forbidden-list literals
      if (norm.endsWith("model-status-pill-single-source.test.ts")) continue;
      const text = fs.readFileSync(file, "utf8");
      for (const label of FORBIDDEN_LABELS) {
        if (text.includes(label)) {
          offenders.push(`${path.relative(ROOT, file)} :: ${label}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("page.tsx and sit-v2-view.tsx import ModelStatusPill for the status pill", () => {
    const page = fs.readFileSync(path.join(ROOT, "pages/page.tsx"), "utf8");
    const sit = fs.readFileSync(
      path.join(ROOT, "components/app-atlas/sit-v2/sit-v2-view.tsx"),
      "utf8",
    );
    expect(page).toMatch(/import\s*\{[^}]*ModelStatusPill[^}]*\}\s*from/);
    expect(page).toMatch(/<ModelStatusPill\b/);
    expect(sit).toMatch(/import\s*\{[^}]*ModelStatusPill[^}]*\}\s*from/);
    expect(sit).toMatch(/<ModelStatusPill\b/);
    // no leftover SIT "Model ·" markup
    expect(sit).not.toMatch(/Model · \{/);
    expect(sit).not.toMatch(/Model · \$\{/);
  });
});
