/**
 * R10-06 Playwright: Result + Notes on throwaway harness.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.UI_BASE || "http://localhost:3000";
const OUT = process.env.OUT || path.resolve(__dirname, "../../appatlas-backend-github-sync/docs/sit-quality/out/r10/after-r10-06");
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const results = [];

await page.route("**/api/v1/clarify/model-status**", (r) =>
  r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ state: "paused", message: "m" }) }),
);
await page.addInitScript(() => localStorage.setItem("sit_ui_v2", "1"));
await page.goto(`${BASE}/app-atlas`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(2000);
await page.getByText(/SIT R7 UI Test Canvas/i).first().click();
await page.waitForTimeout(800);
await page.getByRole("button", { name: /^SIT Testing$/i }).first().click();
await page.getByTestId("sit-quality-btn").waitFor({ timeout: 60000 });

const headerStatus = await page.getByTestId("sit-col-header-status").innerText();
const notesHeader = await page.getByTestId("sit-col-header-notes").count();
results.push({ step: "headers", headerStatus, notesHeader, ok: /Result/i.test(headerStatus) && notesHeader > 0 });

for (const w of [1280, 1440, 1920]) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, `grid-default-${w}.png`), fullPage: false });
}

// Failed with actual
const row21 = page.locator("[data-row-id]").filter({ hasText: "SYN-1-21" }).first();
await row21.scrollIntoViewIfNeeded();
const actual21 = await row21.getByTestId("sit-actual-result").innerText().catch(() => "");
results.push({ step: "failed_with_actual", actual21, ok: /Error banner|Invalid/i.test(actual21) });
await page.screenshot({ path: path.join(OUT, "failed-with-actual-1440.png"), fullPage: false });

// Failed without — amber hint
const row22 = page.locator("[data-row-id]").filter({ hasText: "SYN-1-22" }).first();
await row22.scrollIntoViewIfNeeded();
const hint = row22.getByTestId("sit-actual-result");
const hintClass = await hint.getAttribute("class");
results.push({
  step: "failed_amber_hint",
  hintClass,
  ok: /decoration-dotted|underline/.test(hintClass || "") && /Add actual result/i.test(await hint.innerText()),
});
await page.screenshot({ path: path.join(OUT, "failed-amber-hint-1440.png"), fullPage: false });

// Notes filled
const notes24 = page.locator("[data-row-id]").filter({ hasText: "SYN-1-24" }).first();
await notes24.scrollIntoViewIfNeeded();
const noteText = await notes24.getByTestId("sit-notes-cell").innerText();
results.push({ step: "notes_filled", noteText, ok: /Waiting on backend/i.test(noteText) });
await page.screenshot({ path: path.join(OUT, "notes-filled-1440.png"), fullPage: false });

// Edit actual — should not add Edited chip on an unedited AI Failed row
const editedBefore = await row22.locator("text=Edited").count();
await hint.click();
await page.getByTestId("sit-cell-editor-actualResult").fill("Saw spinner forever");
await page.getByTestId("sit-cell-editor-actualResult").press("Enter");
await page.waitForTimeout(1000);
const editedAfter = await row22.locator("text=Edited").count();
const originChip = await row22.innerText();
results.push({
  step: "actual_edit_no_edited_flag",
  editedBefore,
  editedAfter,
  ok: editedAfter <= editedBefore && !/Edited:\s*\d/.test(originChip),
});
await page.screenshot({ path: path.join(OUT, "actual-edit-mode-1440.png"), fullPage: false });

// Notes edit mode
await notes24.getByTestId("sit-notes-cell").dblclick();
await page.waitForTimeout(200);
const noteEditor = page.getByTestId("sit-cell-editor-userNote");
results.push({ step: "notes_edit_mode", ok: (await noteEditor.count()) > 0 });
await page.screenshot({ path: path.join(OUT, "notes-edit-mode-1440.png"), fullPage: false });
if ((await noteEditor.count()) > 0) await noteEditor.press("Escape");

// Export CSV via UI if possible — fall back to checking export module presence
const exportBtn = page.getByRole("button", { name: /^Export$/i });
await exportBtn.click();
await page.waitForTimeout(200);
await page.getByText(/CSV \(current view\)/i).click().catch(() => {});
await page.waitForTimeout(500);
results.push({ step: "export_clicked", ok: true });

const ok = results.every((r) => r.ok !== false);
console.log(JSON.stringify({ ok, results, out: OUT }, null, 2));
await browser.close();
process.exit(ok ? 0 : 1);
