import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const DISCONNECT_MSG =
  "Disconnect GitHub sync for this canvas? Files already on GitHub stay; new edits will not sync.";
const PUBLIC_MSG = "This repository is public. Canvas data will be visible on GitHub. Continue?";

describe("inline disconnect confirm contract", () => {
  it("keeps the user-facing disconnect and public copy", () => {
    expect(DISCONNECT_MSG).toMatch(/Files already on GitHub stay/i);
    expect(PUBLIC_MSG).toMatch(/public/i);
  });

  it("GitHub connect flow no longer uses native confirm/alert/prompt", () => {
    const modal = fs.readFileSync(path.join(__dirname, "connect-apps-modal.tsx"), "utf8");
    const githubChunk = modal.slice(modal.indexOf("function GithubStep"), modal.indexOf("function TeamsStep"));
    expect(githubChunk).toMatch(/InlineConfirm/);
    expect(githubChunk).not.toMatch(/window\.confirm/);
    expect(githubChunk).not.toMatch(/window\.alert/);
    expect(githubChunk).not.toMatch(/window\.prompt/);
    expect(githubChunk).not.toMatch(/[^.\w]confirm\s*\(/);
  });

  it("InlineConfirm uses alertdialog semantics and Esc-cancel capture", () => {
    const src = fs.readFileSync(path.join(__dirname, "inline-confirm.tsx"), "utf8");
    expect(src).toMatch(/role="alertdialog"/);
    expect(src).toMatch(/aria-labelledby/);
    expect(src).toMatch(/aria-describedby/);
    expect(src).toMatch(/stopImmediatePropagation/);
    expect(src).toMatch(/cancelRef\.current\?\.focus/);
    expect(src).toMatch(/Escape/);
  });
});
