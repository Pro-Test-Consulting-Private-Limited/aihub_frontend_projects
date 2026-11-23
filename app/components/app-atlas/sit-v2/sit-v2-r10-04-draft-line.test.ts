import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("R10-04 Draft clarity line", () => {
  const finder = fs.readFileSync(path.join(__dirname, "../sit-dead-finder.tsx"), "utf8");
  const view = fs.readFileSync(path.join(__dirname, "sit-v2-view.tsx"), "utf8");

  it("shows muted Draft line when draftCount > 0", () => {
    expect(finder).toMatch(/draftCount/);
    expect(finder).toMatch(/Draft cases are not checked until they are set to Not run/);
    expect(finder).toMatch(/sit-quality-draft-line/);
    expect(view).toMatch(/draftCount/);
  });
});
