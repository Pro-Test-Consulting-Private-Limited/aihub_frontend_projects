import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const cellSrc = fs.readFileSync(path.join(__dirname, "sit-v2-editable-cell.tsx"), "utf8");
const gridSrc = fs.readFileSync(path.join(__dirname, "sit-v2-grid.tsx"), "utf8");

describe("R5 A1 selection highlight", () => {
  it("has distinct selected vs editing styles and data attributes", () => {
    expect(cellSrc).toMatch(/data-selected=\{selected \? "1" : "0"\}/);
    expect(cellSrc).toMatch(/data-editing="1"/);
    expect(cellSrc).toMatch(/data-editing="0"/);
    // selected: light tint + thin ring; editing: stronger ring
    expect(cellSrc).toMatch(/ring-1 ring-inset ring-\[#8664F2\]\/50/);
    expect(cellSrc).toMatch(/ring-2 ring-inset ring-\[#8664F2\]/);
  });

  it("Escape clears selection (cell + document) and outside click clears", () => {
    expect(cellSrc).toMatch(/onSelect\(null\)/);
    expect(gridSrc).toMatch(/clearCellSelection/);
    expect(gridSrc).toMatch(/mousedown/);
    expect(gridSrc).toMatch(/Escape/);
    expect(gridSrc).toMatch(/data-sit-select-popover/);
  });

  it("only one selected cell coord is stored at a time", () => {
    expect(gridSrc).toMatch(/useState<CellCoord \| null>\(null\)/);
    expect(gridSrc).toMatch(/selected\?\.rowId === row\.id && selected\.field === f/);
  });
});
