import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Hint, setLayoutMode, toggleLayoutMode, useLayoutMode } from "./layout-mode";

const hint = () => renderToStaticMarkup(createElement(Hint, { short: "Short line.", children: "The long explanation." }));

describe("layout switch", () => {
  it("classic shows the full explanation exactly as before; new shows one short line with a ? for the rest", () => {
    setLayoutMode("classic");
    expect(hint()).toContain("The long explanation.");
    expect(hint()).not.toContain("Short line.");
    setLayoutMode("new");
    expect(hint()).toContain("Short line.");
    expect(hint()).not.toContain("The long explanation.");
    expect(hint()).toContain('aria-label="Show the explanation"');
  });

  it("toggles back and forth", () => {
    setLayoutMode("new");
    toggleLayoutMode();
    expect(hint()).toContain("The long explanation.");
    toggleLayoutMode();
    expect(hint()).toContain("Short line.");
    expect(typeof useLayoutMode).toBe("function");
  });
});
