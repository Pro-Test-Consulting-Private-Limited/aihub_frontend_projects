import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("R10-05 expanded row cleanup", () => {
  const panel = fs.readFileSync(path.join(__dirname, "sit-v2-expand-panel.tsx"), "utf8");

  it("uses Covers / Quality / Activity columns and no-AC wording", () => {
    expect(panel).toMatch(/sit-expand-quality-col/);
    expect(panel).toMatch(/No acceptance criteria linked/);
    expect(panel).toMatch(/max-w-\[/);
    expect(panel).toMatch(/Set to \$\{/);
  });

  it("hides AI original tab for non-AI origin", () => {
    expect(panel).toMatch(/origin === \"ai\"|origin !== \"ai\"|isAi/);
    expect(panel).toMatch(/AI original/);
  });
});
