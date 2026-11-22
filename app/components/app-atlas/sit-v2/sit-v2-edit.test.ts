import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const viewSrc = fs.readFileSync(path.join(__dirname, "sit-v2-view.tsx"), "utf8");
const gridSrc = fs.readFileSync(path.join(__dirname, "sit-v2-grid.tsx"), "utf8");
const cellSrc = fs.readFileSync(path.join(__dirname, "sit-v2-editable-cell.tsx"), "utf8");

describe("A1 spreadsheet edit (no Edit toggle)", () => {
  it("removes toolbar Edit / editMode toggle", () => {
    expect(viewSrc).not.toMatch(/setEditMode/);
    expect(viewSrc).not.toMatch(/editMode/);
    expect(viewSrc).not.toMatch(/>Editing</);
    expect(viewSrc).not.toMatch(/\{editMode \? "Editing" : "Edit"\}/);
    expect(gridSrc).not.toMatch(/editMode/);
  });

  it("uses canEdit + View only chip for non-editors", () => {
    expect(viewSrc).toMatch(/canEdit/);
    expect(viewSrc).toMatch(/View only/);
    expect(gridSrc).toMatch(/canEdit/);
    expect(gridSrc).toMatch(/sit-view-only-chip/);
  });

  it("double-click starts edit; single click only selects", () => {
    expect(cellSrc).toMatch(/onDoubleClick/);
    expect(cellSrc).toMatch(/onStartEdit/);
    expect(cellSrc).toMatch(/onSelect/);
    // single click handler calls onSelect only (not onStartEdit)
    const clickBlock = cellSrc.match(/onClick=\{\(e\) => \{[\s\S]*?\}\}/)?.[0] || "";
    expect(clickBlock).toMatch(/onSelect/);
    expect(clickBlock).not.toMatch(/onStartEdit/);
    const dblBlock = cellSrc.match(/onDoubleClick=\{\(e\) => \{[\s\S]*?\}\}/)?.[0] || "";
    expect(dblBlock).toMatch(/onStartEdit/);
  });

  it("keyboard path: Enter/F2 edit, Esc cancel, Enter commit, Shift+Enter linebreak", () => {
    expect(cellSrc).toMatch(/e\.key === "Enter"/);
    expect(cellSrc).toMatch(/e\.key === "F2"/);
    expect(cellSrc).toMatch(/e\.key === "Escape"/);
    expect(cellSrc).toMatch(/e\.shiftKey/);
  });

  it("non-editors cannot start edit on double-click", () => {
    expect(cellSrc).toMatch(/if \(!canEdit\) return/);
  });

  it("delete/duplicate live in row menu; Add test case is toolbar-only", () => {
    expect(gridSrc).toMatch(/Duplicate/);
    expect(gridSrc).toMatch(/Delete/);
    expect(gridSrc).toMatch(/RowMenu/);
    expect(gridSrc).not.toMatch(/sit-add-test-case/);
    const viewSrc = fs.readFileSync(path.join(__dirname, "sit-v2-view.tsx"), "utf8");
    expect(viewSrc).toMatch(/sit-add-test-case/);
  });

  it("U12 has no native confirm/prompt/alert in the grid", () => {
    expect(gridSrc).not.toMatch(/window\.confirm/);
    expect(gridSrc).not.toMatch(/window\.prompt/);
    expect(gridSrc).not.toMatch(/window\.alert/);
  });
});
