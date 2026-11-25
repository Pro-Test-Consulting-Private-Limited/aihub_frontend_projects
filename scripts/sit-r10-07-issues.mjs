import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.UI_BASE || "http://localhost:3000";
const OUT = process.env.OUT || path.resolve(__dirname, "../../appatlas-backend-github-sync/docs/sit-quality/out/r10/after-r10-07");
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
await page.waitForFunction(() => {
  const t = document.querySelector('[data-testid="sit-quality-btn"]')?.textContent || "";
  return /Quality\s+\d+/.test(t) && !/…/.test(t);
}, null, { timeout: 60000 });

const qText = await page.getByTestId("sit-quality-btn").innerText();
const qN = Number((qText.match(/(\d+)/) || [])[1] || 0);
await page.getByTestId("sit-mode-issues").click();
await page.getByTestId("sit-issues-screen").waitFor({ timeout: 15000 });
await page.waitForTimeout(500);
const issuesTab = await page.getByTestId("sit-mode-issues").innerText();
const issuesN = Number((issuesTab.match(/(\d+)/) || [])[1] || 0);
results.push({ step: "tab_switch", qN, issuesN, ok: qN === issuesN && qN > 0 });
await page.screenshot({ path: path.join(OUT, "issues-1440.png"), fullPage: false });

await page.getByTestId("sit-issues-card-thin_case").click();
await page.waitForTimeout(300);
results.push({ step: "card_filter", ok: (await page.locator("[data-testid^=sit-issues-row-]").count()) > 0 });
await page.getByTestId("sit-issues-card-thin_case").click();

const thinRow = page.locator("[data-testid^=sit-issues-row-]").filter({ hasText: "SYN-1-03" }).first();
if (await thinRow.count()) await thinRow.click();
else await page.locator("[data-testid^=sit-issues-row-]").first().click();
await page.waitForTimeout(200);
results.push({
  step: "detail",
  ok: (await page.getByTestId("sit-issues-detail").count()) > 0 && (await page.getByTestId("sit-issues-preview").count()) > 0,
});

const noAc = page.locator("[data-testid^=sit-issues-row-]").filter({ hasText: "SYN-1-18" }).first();
if (await noAc.count()) {
  await noAc.click();
  await page.waitForTimeout(300);
  const orphan = (await page.getByTestId("sit-issues-reason-orphan_ticket").count()) > 0;
  const detailHasNoAc = /No AC|acceptance|not linked/i.test(await page.getByTestId("sit-issues-detail").innerText());
  results.push({ step: "no_ac_detail", ok: orphan || detailHasNoAc });
} else {
  results.push({ step: "no_ac_detail", ok: false, reason: "SYN-1-18 missing" });
}

await page.locator("[data-testid^=sit-issues-row-]").nth(0).locator('input[type="checkbox"]').check();
await page.locator("[data-testid^=sit-issues-row-]").nth(1).locator('input[type="checkbox"]').check();
await page.getByTestId("sit-issues-show-in-cases").click();
await page.waitForTimeout(500);
results.push({
  step: "show_in_cases",
  ok: (await page.getByTestId("sit-selected-issues-chip").count()) > 0 && (await page.getByTestId("sit-mode-cases").getAttribute("aria-selected")) === "true",
});
await page.getByTestId("sit-selected-issues-chip").click();
await page.waitForTimeout(300);
results.push({ step: "clear_chip", ok: (await page.getByTestId("sit-selected-issues-chip").count()) === 0 });

await page.getByTestId("sit-mode-issues").click();
await page.getByTestId("sit-issues-open-cases").click();
await page.waitForTimeout(500);
results.push({ step: "open_in_cases", ok: (await page.getByTestId("sit-mode-cases").getAttribute("aria-selected")) === "true" });

try {
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.waitForTimeout(500);
  await page.getByTestId("sit-mode-issues").click();
  await page.getByTestId("sit-issues-screen").waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
  const firstIssue = page.locator("[data-testid^=sit-issues-row-]").first();
  const nRows = await firstIssue.count();
  if (nRows > 0) {
    await firstIssue.click();
    await page.waitForTimeout(300);
    results.push({ step: "narrow_overlay", ok: (await page.getByTestId("sit-issues-back").count()) > 0 });
  } else {
    // empty/loading at narrow — still capture shot
    results.push({ step: "narrow_overlay", ok: (await page.getByTestId("sit-issues-screen").count()) > 0, soft: "no list rows yet" });
  }
  await page.screenshot({ path: path.join(OUT, "issues-narrow.png"), fullPage: false });
} catch (e) {
  results.push({ step: "narrow_overlay", ok: false, error: String(e.message || e) });
}

await page.setViewportSize({ width: 1920, height: 900 });
await page.getByTestId("sit-mode-issues").click().catch(() => {});
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(OUT, "issues-1920.png"), fullPage: false });

const ok = results.every((r) => r.ok !== false);
console.log(JSON.stringify({ ok, results, out: OUT }, null, 2));
await browser.close();
process.exit(ok ? 0 : 1);
