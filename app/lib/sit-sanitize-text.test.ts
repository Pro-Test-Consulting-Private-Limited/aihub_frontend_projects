import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { cleanErrorSentences, findForbiddenDashChars, sanitizeUserText } from "./sit-sanitize-text";

describe("R5 A4 / R6 A6 FE dash scan", () => {
  it("sanitize removes forbidden chars", () => {
    expect(findForbiddenDashChars(sanitizeUserText("a\u2014b\u2013c\u2192d"))).toEqual([]);
  });

  it("A6 quoted arrow label has no dangling to", () => {
    const s = sanitizeUserText("Tap 'Upload document \u2192'");
    expect(findForbiddenDashChars(s)).toEqual([]);
    expect(s).toMatch(/Upload document/);
    expect(s).not.toMatch(/Upload document\s+to/);
  });

  it("A6 dangling to inside quotes is cleaned", () => {
    expect(sanitizeUserText("Tap 'Upload document to '")).toBe("Tap 'Upload document'");
  });

  it("R7-08 cleans doubled error sentences and keeps quoted messages", () => {
    expect(cleanErrorSentences("Error message An error message is shown is shown")).toBe(
      "An error message is shown",
    );
    expect(
      cleanErrorSentences("Error message An error message is shown and document is not uploaded"),
    ).toBe("An error message is shown and the document is not uploaded");
    expect(cleanErrorSentences("Error message An error message is shown is displayed")).toBe(
      "An error message is shown",
    );
    expect(cleanErrorSentences("Verify that login screen displays An error message is shown")).toBe(
      "Verify that the login screen shows an error message",
    );
    expect(
      cleanErrorSentences(
        "Verify that redirect to the Login screen with error message An error message is shown",
      ),
    ).toBe("Verify that the user is redirected to the Login screen and an error message is shown");
    expect(cleanErrorSentences("Error message 'Invalid credentials' is shown")).toBe(
      "Error message 'Invalid credentials' is shown",
    );
    expect(
      cleanErrorSentences('Error message "invalid credentials" is shown below the password field'),
    ).toBe('Error message "invalid credentials" is shown below the password field');
    expect(cleanErrorSentences("Inline error message 'Invalid document type' is shown")).toBe(
      "Inline error message 'Invalid document type' is shown",
    );
  });

  it("scans sit-v2 UI source strings and fails on U+2014/U+2013/U+2192 outside comments", () => {
    const dir = path.join(__dirname, "../components/app-atlas/sit-v2");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"));
    const offenders: string[] = [];
    for (const f of files) {
      if (f.endsWith(".test.ts") || f.endsWith(".test.tsx")) continue;
      let text = fs.readFileSync(path.join(dir, f), "utf8");
      // Strip // and /* */ comments roughly
      text = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      const hits = findForbiddenDashChars(text);
      if (hits.length) offenders.push(`${f}:${hits.join(",")}`);
    }
    expect(offenders, offenders.join("; ")).toEqual([]);
  });
});
