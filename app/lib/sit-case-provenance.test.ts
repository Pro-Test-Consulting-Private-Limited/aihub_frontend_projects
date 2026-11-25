import { describe, expect, it } from "vitest";
import {
  countProvenance,
  getCaseProvenance,
  migrateOriginFilterPersist,
} from "./sit-case-provenance";

function cells(partial: Record<string, string>) {
  return {
    caseId: "X",
    origin: "ai",
    edited: "0",
    ...partial,
  };
}

describe("getCaseProvenance", () => {
  it("AI unedited", () => {
    const p = getCaseProvenance(cells({ origin: "ai", edited: "0" }));
    expect(p).toEqual({ origin: "ai", edited: false, legacyTemplate: false });
  });

  it("AI edited", () => {
    const p = getCaseProvenance(cells({ origin: "ai", edited: "1" }));
    expect(p.origin).toBe("ai");
    expect(p.edited).toBe(true);
  });

  it("human is never edited even if edited flag set", () => {
    const p = getCaseProvenance(cells({ origin: "human", edited: "1" }));
    expect(p.origin).toBe("human");
    expect(p.edited).toBe(false);
  });

  it("template counts as ai origin with legacyTemplate", () => {
    const p = getCaseProvenance(cells({ origin: "template", edited: "1" }));
    expect(p.origin).toBe("ai");
    expect(p.legacyTemplate).toBe(true);
    expect(p.edited).toBe(true);
  });

  it("default missing origin is ai", () => {
    const p = getCaseProvenance({ edited: "0" });
    expect(p.origin).toBe("ai");
  });
});

describe("countProvenance All = AI + Human", () => {
  const rows = [
    { cells: cells({ origin: "ai", edited: "0" }) },
    { cells: cells({ origin: "ai", edited: "1" }) },
    { cells: cells({ origin: "human", edited: "0" }) },
    { cells: cells({ origin: "template", edited: "0" }) },
  ];

  it("All equals AI + Human", () => {
    const c = countProvenance(rows);
    expect(c.total).toBe(4);
    expect(c.ai).toBe(3); // 2 ai + 1 template
    expect(c.human).toBe(1);
    expect(c.edited).toBe(1);
    expect(c.ok).toBe(true);
    expect(c.total).toBe(c.ai + c.human);
  });

  it("AI + EditedOnly returns only edited AI", () => {
    const c = countProvenance(rows, { origin: "ai", editedOnly: true });
    expect(c.total).toBe(1);
    expect(c.ai).toBe(1);
    expect(c.edited).toBe(1);
  });

  it("Human + EditedOnly is empty (human never edited)", () => {
    const c = countProvenance(rows, { origin: "human", editedOnly: true });
    expect(c.total).toBe(0);
  });
});

describe("migrateOriginFilterPersist", () => {
  it("maps old edited to All + edited toggle", () => {
    expect(migrateOriginFilterPersist("edited")).toEqual({ origin: "all", editedOnly: true });
  });

  it("keeps ai and human", () => {
    expect(migrateOriginFilterPersist("ai").origin).toBe("ai");
    expect(migrateOriginFilterPersist("human").origin).toBe("human");
  });

  it("falls back unknown to all", () => {
    expect(migrateOriginFilterPersist("garbage").origin).toBe("all");
  });
});

describe("R10-06 fields must not be treated as edited by consumers", () => {
  it("status/notes/result cells alone do not make getCaseProvenance edited", () => {
    const p = getCaseProvenance(
      cells({
        origin: "ai",
        edited: "0",
        executionStatus: "Passed",
        actualResult: "ok",
        userNote: "note",
      }),
    );
    expect(p.edited).toBe(false);
  });
});
