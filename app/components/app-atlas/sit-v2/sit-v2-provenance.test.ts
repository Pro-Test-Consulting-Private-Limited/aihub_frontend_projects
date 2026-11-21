import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { originRowTint, provenanceTooltip } from "./sit-v2-bits";

describe("A3 provenance without Origin column", () => {
  it("grid has no Origin column header", () => {
    const grid = fs.readFileSync(path.join(__dirname, "sit-v2-grid.tsx"), "utf8");
    expect(grid).not.toMatch(/>Origin</);
    expect(grid).toMatch(/OriginGlyph/);
    expect(grid).toMatch(/originRowTint/);
    expect(grid).toMatch(/provenanceTooltip/);
  });

  it("toolbar uses Origin chip group not native select", () => {
    const view = fs.readFileSync(path.join(__dirname, "sit-v2-view.tsx"), "utf8");
    expect(view).toMatch(/sit-origin-filter-chips/);
    expect(view).not.toMatch(/<option value="ai">AI<\/option>/);
  });

  it("tooltip and tint helpers cover AI/human/template/edited", () => {
    expect(provenanceTooltip({ origin: "ai" })).toMatch(/AI/i);
    expect(provenanceTooltip({ origin: "human", editedBy: "Ada" })).toMatch(/human/i);
    expect(provenanceTooltip({ origin: "ai", edited: "1", editedBy: "Bob", aiOriginal: "{}" })).toMatch(
      /original available/,
    );
    expect(originRowTint("ai", false)).toMatch(/8664F2/);
    expect(originRowTint("human", false)).toMatch(/3b82f6/);
    expect(originRowTint("ai", true)).toMatch(/d97706/);
  });
});
