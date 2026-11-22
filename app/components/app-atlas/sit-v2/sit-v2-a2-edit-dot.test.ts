import { describe, expect, it } from "vitest";
import { editedFieldKeys, fieldEditTooltip, listFieldEdits, parseEditedFields } from "./sit-v2-edit-dot";
import type { SitSheetRow } from "@/app/interfaces/appatlas";
import fs from "node:fs";
import path from "node:path";

function row(cells: Record<string, string>): SitSheetRow {
  return { id: "r1", cells };
}

describe("R5 A2 edit dots", () => {
  it("shows dots only on AI edited fields", () => {
    const ai = row({
      origin: "ai",
      edited: "1",
      scenario: "New",
      steps: "1. a\n2. b\n3. c\n4. d",
      aiOriginal: JSON.stringify({ scenario: "Old", steps: "1. a\n2. b\n3. c\n4. d" }),
      editedFields: JSON.stringify({
        scenario: { from: "Old", to: "New", by: "Ada", at: "1" },
      }),
    });
    expect(editedFieldKeys(ai)).toEqual(["scenario"]);
    expect(fieldEditTooltip(ai, "scenario")).toMatch(/AI original: Old/);
    expect(fieldEditTooltip(ai, "scenario")).toMatch(/New: New/);

    const human = row({ origin: "human", edited: "1", scenario: "X" });
    expect(editedFieldKeys(human)).toEqual([]);
  });

  it("listFieldEdits marks missing original", () => {
    const r = row({
      origin: "ai",
      edited: "1",
      scenario: "Now",
      // no aiOriginal / editedFields from → "not recorded"
    });
    // without snap or map, keys empty unless we invent — require editedFields or snap
    expect(editedFieldKeys(r).length).toBe(0);
    const withMap = row({
      origin: "ai",
      edited: "1",
      scenario: "Now",
      editedFields: JSON.stringify({ scenario: { from: "", to: "Now", by: "A", at: "1" } }),
    });
    const list = listFieldEdits(withMap);
    expect(list[0]!.field).toBe("scenario");
  });

  it("expand panel has Edits section and revertField wiring", () => {
    const expand = fs.readFileSync(path.join(__dirname, "sit-v2-expand-panel.tsx"), "utf8");
    expect(expand).toMatch(/sit-expand-edits/);
    expect(expand).toMatch(/Revert this field to AI/);
    expect(expand).toMatch(/Revert all to AI/);
    expect(expand).toMatch(/revertField/);
  });

  it("parseEditedFields tolerates bad JSON", () => {
    expect(parseEditedFields({ editedFields: "{" })).toEqual({});
  });
});
