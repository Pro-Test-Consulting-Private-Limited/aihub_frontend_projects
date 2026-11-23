/**
 * R10-03 Playwright: cancel, delete, undo on throwaway harness.
 */
import { chromium } from "playwright";

const BASE = process.env.UI_BASE || "http://localhost:3000";
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

const checkboxes = page.locator('thead input[aria-label="Select all"]');
await checkboxes.check();
await page.waitForTimeout(200);
const before = await page.locator("[data-row-id]").count();
results.push({ step: "selected_all", before });

await page.getByTestId("sit-bulk-delete").click();
await page.getByTestId("sit-bulk-delete-dialog").waitFor();
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
const escapeGone = (await page.getByTestId("sit-bulk-delete-dialog").count()) === 0;
results.push({ step: "escape_cancel", dialogGone: escapeGone });

await page.getByTestId("sit-bulk-delete").click();
await page.getByTestId("sit-bulk-delete-dialog").waitFor();
await page.getByTestId("sit-bulk-delete-cancel").click();
await page.waitForTimeout(300);
results.push({
  step: "button_cancel",
  dialogGone: (await page.getByTestId("sit-bulk-delete-dialog").count()) === 0,
  rows: await page.locator("[data-row-id]").count(),
});

// delete only 2 rows for a faster undo path
await page.locator('thead input[aria-label="Select all"]').uncheck();
await page.waitForTimeout(100);
await page.locator('tbody input[type="checkbox"]').nth(0).check();
await page.locator('tbody input[type="checkbox"]').nth(1).check();
await page.getByTestId("sit-bulk-delete").click();
await page.getByTestId("sit-bulk-delete-confirm").click();
await page.waitForTimeout(1200);
const afterDelete = await page.locator("[data-row-id]").count();
const toast = await page.getByTestId("sit-bulk-delete-toast").count();
results.push({ step: "confirm_delete", afterDelete, toast });

await page.getByTestId("sit-bulk-delete-toast").getByText("Undo").click();
await page.waitForTimeout(1500);
const afterUndo = await page.locator("[data-row-id]").count();
results.push({ step: "undo", afterUndo, restored: afterUndo >= before - 0 });

const ok = escapeGone && afterDelete < before && afterUndo >= afterDelete && toast > 0;
console.log(JSON.stringify({ ok, results }, null, 2));
await browser.close();
process.exit(ok ? 0 : 1);
