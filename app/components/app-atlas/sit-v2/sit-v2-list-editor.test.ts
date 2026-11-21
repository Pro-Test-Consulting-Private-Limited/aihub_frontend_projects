import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseListItems, serializeListItems } from "./sit-v2-list-editor";

describe("A2 list editor format compatibility", () => {
  it("parses numbered steps and serializes numbered again", () => {
    const raw = "1. Open login\n2. Click Sign in";
    const items = parseListItems(raw, "steps");
    expect(items).toEqual(["Open login", "Click Sign in"]);
    expect(serializeListItems(items, "steps")).toBe("1. Open login\n2. Click Sign in");
  });

  it("parses bullet preconditions/expected as newline bullets", () => {
    const raw = "- On /login\n- User signed out";
    const items = parseListItems(raw, "bullets");
    expect(items).toEqual(["On /login", "User signed out"]);
    expect(serializeListItems(items, "bullets")).toBe("- On /login\n- User signed out");
  });

  it("keeps empty editor as empty string (compatible with old workbooks)", () => {
    expect(serializeListItems([""], "steps")).toBe("");
    expect(serializeListItems(["  "], "bullets")).toBe("");
  });

  it("component exposes Enter/Backspace/Shift+Enter/{{ autocomplete contracts", () => {
    const src = fs.readFileSync(path.join(__dirname, "sit-v2-list-editor.tsx"), "utf8");
    expect(src).toMatch(/Enter/);
    expect(src).toMatch(/Backspace/);
    expect(src).toMatch(/shiftKey/);
    expect(src).toMatch(/\{\{/);
    expect(src).toMatch(/Drag/);
    expect(src).toMatch(/Ctrl\+Enter|ctrlKey/);
    expect(src).toMatch(/Escape/);
  });

  it("grid wires list editor for preconditions, steps, expected", () => {
    const grid = fs.readFileSync(path.join(__dirname, "sit-v2-grid.tsx"), "utf8");
    expect(grid).toMatch(/SitV2ListEditor/);
    expect(grid).toMatch(/kind="steps"/);
    expect(grid).toMatch(/kind="bullets"/);
  });
});
