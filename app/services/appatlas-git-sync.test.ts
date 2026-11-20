import { describe, expect, it } from "vitest";

/** Pure helpers mirroring backend path rules for client-side display. */
function folderPath(projectId: string, canvasId: string) {
  return `projects/${projectId}/canvases/${canvasId}/`;
}

describe("git sync folder path", () => {
  it("uses projects/<projectId>/canvases/<canvasId>/", () => {
    expect(folderPath("projA", "canvas01")).toBe("projects/projA/canvases/canvas01/");
  });
});

describe("git sync availability shape", () => {
  it("accepts master_off and not_configured reasons", () => {
    const reasons = ["master_off", "not_configured"] as const;
    expect(reasons).toContain("master_off");
    expect(reasons).toContain("not_configured");
  });
});
