import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("U1 Remove Template from SIT v2", () => {
  const view = fs.readFileSync(path.join(__dirname, "sit-v2-view.tsx"), "utf8");
  const bits = fs.readFileSync(path.join(__dirname, "sit-v2-bits.tsx"), "utf8");

  it("has a single Generate button with no Use template menu", () => {
    expect(view).toMatch(/sit-generate-btn/);
    expect(view).not.toMatch(/Use template/);
    // Generate disabled reason comes from shared ModelStatusPill presentation (not a hard-coded warming string).
    expect(view).toMatch(/modelStatusPresentation\(modelMapped\.ui\)\.tooltip/);
    expect(view).toMatch(/modelMapped\.generateDisabled/);
  });

  it("labels old template origin as Legacy in tooltip", () => {
    expect(bits).toMatch(/Legacy/);
    expect(bits).toMatch(/old template row/);
    expect(bits).toMatch(/getCaseProvenance/);
  });

  it("uses getCaseProvenance SOT for edited (human never edited)", () => {
    expect(view).toMatch(/getCaseProvenance|countProvenance/);
  });
});
