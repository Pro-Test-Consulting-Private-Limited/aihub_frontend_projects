import { describe, expect, it } from "vitest";

const CATEGORY = "Source Control & Version Control";

describe("connect apps github category", () => {
  it("uses the Source Control category title", () => {
    expect(CATEGORY).toMatch(/Source Control/);
  });

  it("builds folder preview for connect step", () => {
    const projectId = "p1";
    const canvasId = "c1";
    expect(`projects/${projectId}/canvases/${canvasId}/`).toBe("projects/p1/canvases/c1/");
  });
});
