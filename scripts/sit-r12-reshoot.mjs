/**
 * Re-capture R12 screenshots with reliable dialog close.
 */
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.UI_BASE || "http://localhost:3000";
const OUT = process.env.OUT || path.resolve(__dirname, "../../appatlas-backend-github-sync/docs/sit-quality/out/r12");
const WIDTHS = [1280, 1440, 1920, 1100];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.route("**/api/v1/clarify/model-status**", (r) =>
  r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ state: "paused", message: "mocked" }) }),
);
await page.route("**/sit/generate**", (r) => r.abort());
await page.route("**/sit/stream**", (r) => r.abort());
await page.addInitScript(() => {
  try {
    localStorage.setItem("sit_ui_v2", "1");
  } catch {
    /* ignore */
  }
});
await page.goto(`${BASE}/app-atlas`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(2000);
await page.getByText(/SIT R12 Multi Ticket Canvas/i).first().click();
await page.waitForTimeout(1000);
await page.getByRole("button", { name: /^SIT Testing$/i }).first().click();
await page.waitForTimeout(3000);
await page.getByTestId("sit-page-loading").waitFor({ state: "hidden", timeout: 60000 }).catch(() => {});
await page.getByTestId("sit-scope-pill-all").waitFor({ timeout: 30000 });

async function closeOverlays() {
  await page.getByRole("button", { name: /^Done$/i }).click({ force: true, timeout: 1500 }).catch(() => {});
  await page.keyboard.press("Escape").catch(() => {});
  const closes = page.locator('[aria-label="Close"]');
  const n = await closes.count();
  for (let i = 0; i < n; i++) {
    await closes.nth(i).click({ force: true, timeout: 500 }).catch(() => {});
  }
  await page.evaluate(() => {
    document.querySelectorAll(".fixed.inset-0").forEach((el) => el.remove());
  }).catch(() => {});
  await page.waitForTimeout(150);
}

for (const w of WIDTHS) {
  await page.setViewportSize({ width: w, height: 900 });
  await closeOverlays();
  await page.getByTestId("sit-mode-cases").click({ timeout: 3000 }).catch(() => {});
  await page.getByTestId("sit-scope-pill-all").click({ timeout: 5000 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, "shots", `all-scope-${w}.png`), fullPage: false });

  await page.getByTestId("sit-scope-pill-DW-7").click({ timeout: 5000 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, "shots", `ticket-scope-${w}.png`), fullPage: false });

  await page.getByTestId("sit-scope-pill-all").click({ timeout: 5000 });
  await page.waitForTimeout(150);
  await page.getByRole("button", { name: /Jira Tickets/i }).first().click();
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(OUT, "shots", `jira-popup-${w}.png`), fullPage: false });
  await closeOverlays();

  await page.getByTestId("sit-mode-issues").click({ timeout: 5000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, "shots", `issues-${w}.png`), fullPage: false });
  await page.getByTestId("sit-mode-cases").click({ timeout: 3000 }).catch(() => {});
  console.log(`shot ${w} ok`);
}

await browser.close();
console.log("reshoot-done");
