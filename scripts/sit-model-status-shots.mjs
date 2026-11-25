/**
 * Model-status Playwright shots: AUTH_BYPASS Next + mocked clarify model-status.
 * Never calls the real HF endpoint.
 * Home + SIT for ready / warming_up / inactive / checking at 1280, 1440, 1920.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.UI_BASE || "http://localhost:3000";
const OUT = process.env.OUT || join("docs", "sit-quality", "out", "model-pill", "shots");
const WIDTHS = [1280, 1440, 1920];
const CANVAS_LABEL = process.env.SIT_R7_CANVAS_LABEL || "SIT R7 UI Test Canvas";

mkdirSync(OUT, { recursive: true });

async function installMocks(page, { state, delayMs = 0, sitUnconfigured = false, clarifyFail = false }) {
  await page.route("**/api/v1/clarify/model-status**", async (route) => {
    if (clarifyFail) {
      await route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"unavailable"}' });
      return;
    }
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ state }),
    });
  });
  const unconfiguredBody = JSON.stringify({
    state: "unconfigured",
    label: "Not configured",
    detail: "Set SIT_HF_URL / SIT_HF_TOKEN on App Atlas",
    model: null,
    httpCode: null,
    ms: null,
  });
  for (const pattern of ["**/sit/model**", "**/api/appatlas/sit/model**", "**/dev-atlas/sit/model**"]) {
    await page.route(pattern, async (route) => {
      if (sitUnconfigured) {
        await route.fulfill({ status: 200, contentType: "application/json", body: unconfiguredBody });
        return;
      }
      await route.continue();
    });
  }
}

async function openSit(page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("sit_ui_v2", "1");
    } catch {
      /* ignore */
    }
  });
  await page.goto(`${BASE}/app-atlas`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(1500);
  const canvas = page.getByText(new RegExp(CANVAS_LABEL, "i")).first();
  if (await canvas.count()) {
    await canvas.click();
    await page.waitForTimeout(1200);
  }
  const sitTab = page.getByRole("button", { name: /^SIT Testing$/i }).first();
  if (await sitTab.count()) await sitTab.click();
  else {
    const alt = page.getByText(/^SIT Testing$/i).first();
    if (await alt.count()) await alt.click();
  }
  await page.waitForTimeout(2000);
  await page.getByTestId("sit-quality-btn").waitFor({ timeout: 60_000 }).catch(() => undefined);
}

const lookat = [];
const browser = await chromium.launch({ headless: true });

const scenarios = [
  { key: "ready", state: "running", waitMs: 1500 },
  { key: "warming_up", state: "pending", waitMs: 1500 },
  { key: "inactive", state: "paused", waitMs: 1500 },
  { key: "checking", state: "running", delayMs: 30_000, waitMs: 700 },
];

try {
  for (const sc of scenarios) {
    for (const w of WIDTHS) {
      const context = await browser.newContext({
        viewport: { width: w, height: 900 },
        ignoreHTTPSErrors: true,
      });
      const page = await context.newPage();
      await installMocks(page, {
        state: sc.state,
        delayMs: sc.delayMs || 0,
      });

      await page.goto(`${BASE}/pages`, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await page.waitForTimeout(sc.waitMs);
      await page.getByTestId("home-ai-model-pill").waitFor({ timeout: 20_000 }).catch(() => undefined);
      const hp = join(OUT, `home-${sc.key}-${w}.png`);
      await page.screenshot({ path: hp, fullPage: false });
      lookat.push(`home-${sc.key}-${w}.png`);

      await openSit(page);
      await page.waitForTimeout(sc.key === "checking" ? 400 : 800);
      const pill = page.getByTestId("sit-model-status-pill");
      if (await pill.count()) {
        await pill.scrollIntoViewIfNeeded().catch(() => undefined);
      }
      const sp = join(OUT, `sit-${sc.key}-${w}.png`);
      await page.screenshot({ path: sp, fullPage: false });
      lookat.push(`sit-${sc.key}-${w}.png`);
      await context.close();
    }
  }
} finally {
  await browser.close();
}

writeFileSync(join(OUT, "files.json"), JSON.stringify({ lookat, out: OUT }, null, 2));
console.log(JSON.stringify({ ok: true, count: lookat.length, out: OUT }, null, 2));
