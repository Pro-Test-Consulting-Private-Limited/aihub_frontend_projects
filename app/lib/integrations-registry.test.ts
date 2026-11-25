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

  it("marks only jira/swagger/teams/github as canvas-connectable", () => {
    expect(CANVAS_CONNECT_IDS).toEqual(["jira", "swagger", "teams", "github"]);
    for (const t of listIntegrationProviders()) {
      expect(t.canvasConnect).toBe(isCanvasConnectProvider(t.id));
    }
    const figma = getIntegrationProvider("figma");
    expect(figma?.canvasConnect).toBe(false);
  });

  it("uses honest GitHub description (no heal/main marketing)", () => {
    const gh = getIntegrationProvider("github");
    expect(gh?.description).toMatch(/project's repo automatically/i);
    expect(gh?.description).not.toMatch(/Auto-commit on heal/i);
    expect(gh?.description).not.toMatch(/synced to main/i);
  });
});
