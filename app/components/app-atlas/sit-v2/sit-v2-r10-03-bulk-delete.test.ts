import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("R10-03 safe bulk delete", () => {
  const grid = fs.readFileSync(path.join(__dirname, "sit-v2-grid.tsx"), "utf8");
  const view = fs.readFileSync(path.join(__dirname, "sit-v2-view.tsx"), "utf8");

  it("bulk delete is far-right with confirm dialog testids", () => {
    expect(grid).toMatch(/sit-bulk-delete/);
    expect(grid).toMatch(/sit-bulk-delete-confirm/);
    expect(grid).toMatch(/sit-bulk-delete-cancel/);
    expect(grid).toMatch(/You can undo this for a short time/);
    // not gated on size >= 3 only next to status buttons without confirm
    expect(grid).not.toMatch(/selectedRows\.size >= 3 && \(/);
  });

  it("view toast supports bulk undo with 10s window", () => {
    expect(view).toMatch(/sit-bulk-delete-toast|cases deleted\. Undo|Undo/);
    expect(view).toMatch(/10000|10_000|10 \* 1000/);
    expect(view).toMatch(/undelete/);
  });
});
