import { describe, expect, it } from "vitest";
import {
  CANVAS_CONNECT_IDS,
  INTEGRATION_CATEGORIES,
  getIntegrationProvider,
  isCanvasConnectProvider,
  listIntegrationProviders,
} from "./integrations-registry";

describe("integrations registry", () => {
  it("lists every Integrations category in order", () => {
    expect(INTEGRATION_CATEGORIES.map((c) => c.title)).toEqual([
      "AGILE PROJECT MANAGEMENT & ISSUE TRACKING",
      "API DESIGN & DOCUMENTATION",
      "SOURCE CODE MANAGEMENT & VERSION CONTROL",
      "UI/UX DESIGN & PROTOTYPING",
      "TEAM COLLABORATION & COMMUNICATION",
    ]);
  });

  it("includes GitHub through Azure Repos and coming-soon tools", () => {
    const ids = listIntegrationProviders().map((t) => t.id);
    expect(ids).toContain("github");
    expect(ids).toContain("gitlab");
    expect(ids).toContain("gitbucket");
    expect(ids).toContain("codecommit");
    expect(ids).toContain("azure-repos");
    expect(ids).toContain("redocly");
    expect(ids).toContain("stoplight");
    expect(ids).toContain("figma");
    expect(ids).toContain("slack");
    expect(ids).toContain("linear");
  });

  it("marks jira/swagger/teams/github as canvas-connectable (figma when flagged)", () => {
    expect(CANVAS_CONNECT_IDS).toContain("jira");
    expect(CANVAS_CONNECT_IDS).toContain("github");
    for (const t of listIntegrationProviders()) {
      expect(t.canvasConnect).toBe(isCanvasConnectProvider(t.id));
    }
  });

  it("uses honest GitHub description (no heal/main marketing)", () => {
    const gh = getIntegrationProvider("github");
    expect(gh?.description).toMatch(/project's repo automatically/i);
    expect(gh?.description).not.toMatch(/Auto-commit on heal/i);
    expect(gh?.description).not.toMatch(/synced to main/i);
  });
});
