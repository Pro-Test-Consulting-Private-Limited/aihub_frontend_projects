/**
 * Quick re-check of live 4K/720p streamScaled + chips (assumes bypass next on :3000).
 */
import { chromium } from "playwright";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const BASE = process.env.UI_BASE || "http://localhost:3000";
const OUT = process.env.OUT || path.resolve("verify-output");
const PROJECT_ID = process.env.BYPASS_PROJECT_ID || "a88245fd-828f-419e-a4e5-dd47449e968a";
await fsp.mkdir(OUT, { recursive: true });

const rows = [];
const record = (scenario, expected, actual, pass) => {
  const status = pass ? "PASS" : "FAIL";
  rows.push({ scenario, expected, actual, status });
  console.log(`[${status}] ${scenario}: ${typeof actual === "string" ? actual : JSON.stringify(actual)}`);
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

async function openDialog() {
  await page.getByRole("button", { name: /^Run AppAtlas$/i }).first().click({ timeout: 20000 });
  await page.waitForTimeout(900);
  return page.getByRole("dialog").first();
}

async function startAt(resLabel) {
  const dialog = page.getByRole("dialog").first();
  const edit = dialog.getByRole("button", { name: /Edit as custom/i }).first();
  if (await edit.count()) await edit.click();
  else {
    await dialog.locator('[role=tablist][aria-label="Device category"] button', { hasText: /^Custom$/i }).click();
    await page.waitForTimeout(150);
    const card = dialog.getByText(/Custom size/i).first();
    if (await card.count()) await card.click();
  }
  await page.waitForTimeout(150);
  await dialog.locator('[role=tablist][aria-label="Size by"] button').filter({ hasText: /^Resolution$/i }).click();
  await page.waitForTimeout(120);
  await dialog.getByRole("button", { name: new RegExp(resLabel, "i") }).first().click();
  await page.waitForTimeout(300);
  const createdWait = page.waitForResponse(
    (r) => /\/api\/dev-atlas\/sessions\/?$/.test(new URL(r.url()).pathname) && r.request().method() === "POST",
    { timeout: 120000 },
  );
  await dialog.getByRole("button", { name: /^Start recording$/i }).click();
  const created = await (await createdWait).json();
  let emu = created.emulation || null;
  for (let i = 0; i < 30; i++) {
    const snap = await page.evaluate(async (sid) => {
      const g = await fetch(`/api/dev-atlas/sessions/${sid}`);
      return g.ok ? await g.json() : null;
    }, created.id);
    emu = snap?.emulation || emu;
    if (emu && typeof emu.streamScaled === "boolean") break;
    await page.waitForTimeout(700);
  }
  return { id: created.id, emulation: emu };
}

async function stop() {
  const stop = page.getByRole("button", { name: /Stop|Finish|End recording/i }).first();
  if (await stop.count()) {
    await stop.click();
    await page.waitForTimeout(2500);
  }
}

await page.goto(`${BASE}/app-atlas?projectId=${PROJECT_ID}`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(2000);
await openDialog();
const r4 = await startAt("4K");
record("a.badge.api-4k", "streamScaled===true", r4.emulation, r4.emulation?.streamScaled === true);
let chip4 = false;
for (let i = 0; i < 25; i++) {
  chip4 = /Emulated,\s*stream scaled/i.test(await page.locator("body").innerText());
  if (chip4) break;
  await page.waitForTimeout(800);
}
await page.screenshot({ path: path.join(OUT, "ui-live-4k-chips.png") });
record("a.badge.live-4k-chip", "Emulated, stream scaled visible", chip4, chip4);
await stop();

await page.goto(`${BASE}/app-atlas?projectId=${PROJECT_ID}`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(2000);
await openDialog();
const r7 = await startAt("720p");
record("a.badge.api-720p", "streamScaled===false", r7.emulation, r7.emulation?.streamScaled === false);
await page.waitForTimeout(2000);
const chip7 = /Emulated,\s*stream scaled/i.test(await page.locator("body").innerText());
await page.screenshot({ path: path.join(OUT, "ui-live-720p-chips.png") });
record("a.badge.live-720p-chip", "no Emulated badge", !chip7, !chip7);
await stop();

await fsp.writeFile(path.join(OUT, "ui-badge-results.json"), JSON.stringify(rows, null, 2));
await browser.close();
process.exit(rows.some((r) => r.status === "FAIL") ? 1 : 0);
