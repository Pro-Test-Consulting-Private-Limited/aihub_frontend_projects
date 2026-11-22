import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("U1 Remove Template from SIT v2", () => {
  const view = fs.readFileSync(path.join(__dirname, "sit-v2-view.tsx"), "utf8");
  const bits = fs.readFileSync(path.join(__dirname, "sit-v2-bits.tsx"), "utf8");

  it("has a single Generate button with no Use template menu", () => {
    expect(view).toMatch(/sit-generate-btn/);
    expect(view).not.toMatch(/Use template/);
    // Generate disabled reason comes from shared mapModelStatus tooltip (not a hard-coded warming string).
    expect(view).toMatch(/modelMapped\.tooltip/);
    expect(view).toMatch(/modelMapped\.generateDisabled/);
  });

  it("labels old template origin as Legacy", () => {
    expect(bits).toMatch(/Legacy/);
    expect(bits).toMatch(/old template row/);
  });

  it("does not count human rows as Edited in the counts loop", () => {
    expect(view).toMatch(/never human \/ legacy template/);
  });
});
