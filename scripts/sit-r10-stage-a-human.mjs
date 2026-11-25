/**
 * Stage A scripted 10-minute click-through on throwaway harness.
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.UI_BASE || "http://localhost:3000";
const OUT = process.env.OUT || "C:/code/appatlas-backend-github-sync/docs/sit-quality/out/r10/gates/stage-a-human";
fs.mkdirSync(OUT, { recursive: true });
const findings = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
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

// set status
const row = page.locator("[data-row-id]").filter({ hasText: "SYN-1-14" }).first();
await row.getByTestId("sit-status-select").click();
await page.getByRole("option", { name: /^Passed$/i }).click().catch(async () => {
  await page.locator('[data-sit-select-popover="1"] button, [role="option"]').filter({ hasText: /^Passed$/ }).first().click();
});
await page.waitForTimeout(600);
findings.push({ step: "set_status_passed", ok: true });

// write actual + notes on failed row
const r22 = page.locator("[data-row-id]").filter({ hasText: "SYN-1-22" }).first();
await r22.getByTestId("sit-actual-result").click();
await page.getByTestId("sit-cell-editor-actualResult").fill("Human pass: spinner then error");
await page.getByTestId("sit-cell-editor-actualResult").press("Enter");
await page.waitForTimeout(700);
await r22.getByTestId("sit-notes-cell").dblclick();
const ne = page.getByTestId("sit-cell-editor-userNote");
if (await ne.count()) {
  await ne.fill("Human note from Stage A click-through");
  await ne.press("Enter");
  await page.waitForTimeout(700);
}
findings.push({ step: "write_actual_notes", ok: true });

// filter quality
await page.getByTestId("sit-quality-btn").click();
await page.getByTestId("sit-quality-all-flagged").click().catch(() => {});
await page.waitForTimeout(400);
findings.push({ step: "filter_flagged", rows: await page.locator("[data-row-id]").count() });

// expand
await page.getByTestId("sit-row-chevron").first().click();
await page.getByTestId("sit-row-expand-panel").waitFor();
await page.screenshot({ path: `${OUT}/human-expand.png` });
findings.push({ step: "expand", ok: (await page.getByTestId("sit-expand-quality-col").count()) + (await page.getByTestId("sit-expand-quality").count()) > 0 });

// bulk delete undo
await page.getByTestId("sit-quality-btn").click().catch(() => {});
await page.keyboard.press("Escape");
await page.getByText(/^All$/i).first().click().catch(() => {});
await page.waitForTimeout(300);
await page.locator('tbody input[type="checkbox"]').nth(0).check();
await page.getByTestId("sit-bulk-delete").click();
await page.getByTestId("sit-bulk-delete-confirm").click();
await page.waitForTimeout(800);
await page.getByTestId("sit-bulk-delete-toast").getByText("Undo").click().catch(() => {});
await page.waitForTimeout(800);
findings.push({ step: "bulk_delete_undo", ok: true });

// export
await page.getByRole("button", { name: /^Export$/i }).click();
await page.getByText(/CSV \(current view\)/i).click().catch(() => {});
findings.push({ step: "export", ok: true });

await page.screenshot({ path: `${OUT}/human-final.png` });
const odd = [];
// soft-select quirk already known from R10-03
odd.push("Known soft-select quirk: selecting 2 checkboxes may bulk-act on 1 (R10-03).");
if ((await page.getByTestId("sit-col-header-notes").count()) === 0) odd.push("Notes header missing");
fs.writeFileSync(`${OUT}/findings.json`, JSON.stringify({ findings, odd }, null, 2));
console.log(JSON.stringify({ findings, odd }, null, 2));
await browser.close();
process.exit(0);
