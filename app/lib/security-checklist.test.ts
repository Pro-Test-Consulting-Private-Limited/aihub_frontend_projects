import { describe, expect, it } from "vitest";
import { SECURITY_CATEGORIES } from "./security-checklist";

describe("security checklist data (from the AppAtlas workbook)", () => {
  it("has 15 categories and 144 checks: 76 automated and 68 guided", () => {
    expect(SECURITY_CATEGORIES).toHaveLength(15);
    expect(SECURITY_CATEGORIES.reduce((n, c) => n + c.automated, 0)).toBe(76);
    expect(SECURITY_CATEGORIES.reduce((n, c) => n + c.guided, 0)).toBe(68);
    expect(SECURITY_CATEGORIES.reduce((n, c) => n + c.checks.length, 0)).toBe(144);
  });

  it("every category lists exactly as many checks as its automated + guided total; itemised ones say which is which", () => {
    for (const c of SECURITY_CATEGORIES) {
      expect(c.checks.length, c.name).toBe(c.automated + c.guided);
      if (c.itemised) {
        expect(c.checks.filter((x) => x.mode === "automated").length, c.name).toBe(c.automated);
        expect(c.checks.filter((x) => x.mode === "guided").length, c.name).toBe(c.guided);
      } else expect(c.checks.every((x) => x.mode === null), c.name).toBe(true);
    }
    expect(SECURITY_CATEGORIES.filter((c) => c.itemised)).toHaveLength(8);
  });
});
