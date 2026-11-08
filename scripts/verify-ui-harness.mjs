/**
 * Phase A UI harness — requires local next dev with AUTH_BYPASS_LOCAL=1.
 *   OUT=../appatlas-backend/verify-output node scripts/verify-ui-harness.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const BASE = process.env.UI_BASE || "http://127.0.0.1:3000";
const OUT = process.env.OUT || path.resolve("verify-output");
await fsp.mkdir(OUT, { recursive: true });

const rows = [];
const record = (scenario, expected, actual, pass, detail = "") => {
  const status = pass === null ? "NOT VERIFIED" : pass ? "PASS" : "FAIL";
  rows.push({ scenario, expected, actual, status, detail });
  console.log(`[${status}] ${scenario}: ${actual}`);
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(`${BASE}/app-atlas?projectId=local-bypass-project`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(2500);

if (/microsoftonline|signin/i.test(page.url()) || (await page.getByText(/Sign in with Microsoft/i).count())) {
  record("a.harness.auth", "bypass allows app-atlas", page.url(), false, "still on login — AUTH_BYPASS_LOCAL not active?");
  await fsp.writeFile(path.join(OUT, "ui-results.json"), JSON.stringify(rows, null, 2));
  await browser.close();
  process.exit(1);
}
record("a.harness.auth", "localhost bypass", page.url(), true);

const openDialog = async () => {
  const btn = page.getByRole("button", { name: /Run AppAtlas|start recording|choose device/i }).first();
  await btn.click({ timeout: 15000 });
  await page.waitForTimeout(800);
  return page.getByRole("dialog").first();
};

let dialog = await openDialog();
if (!(await dialog.count())) {
  record("a.dialog.open", "dialog visible", "missing", false);
  await fsp.writeFile(path.join(OUT, "ui-results.json"), JSON.stringify(rows, null, 2));
  await browser.close();
  process.exit(1);
}
record("a.dialog.open", "dialog visible", "ok", true);

async function measureScroll(label) {
  const m = await dialog.evaluate((el) => ({
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  }));
  const pass = m.scrollHeight <= m.clientHeight + 1;
  record(`a.scroll.${label}`, "scrollHeight<=clientHeight", JSON.stringify(m), pass);
  return pass;
}

for (const [w, h] of [
  [1366, 768],
  [1440, 900],
  [1920, 1080],
]) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(250);
  for (const mode of ["Pixels", "Ratio", "Resolution"]) {
    const tab = dialog.getByRole("button", { name: new RegExp(`^${mode}$`, "i") }).first();
    if (await tab.count()) await tab.click().catch(() => undefined);
    await page.waitForTimeout(150);
    await measureScroll(`${w}x${h}-${mode}`);
  }
  const persona = dialog.getByText(/^Persona$/i).first();
  if (await persona.count()) {
    await persona.click().catch(() => undefined);
    await page.waitForTimeout(200);
    await measureScroll(`${w}x${h}-persona`);
  }
}

await page.setViewportSize({ width: 1440, height: 900 });

async function shot(name) {
  const file = path.join(OUT, `${name}.png`);
  await dialog.screenshot({ path: file });
  record(`a.shot.${name}`, "file saved", file, fs.existsSync(file) && fs.statSync(file).size > 1000);
}

// iPhone 14 chips
const iphone = dialog.getByText(/iPhone 14/i).first();
if (await iphone.count()) {
  await iphone.click();
  await page.waitForTimeout(400);
  const text = await dialog.innerText();
  const good = /390\s*[×x]\s*844/.test(text);
  const stale = /412\s*[×x]\s*915/.test(text);
  record("a.chip.iphone14", "390×844 not 412×915", `good=${good} stale=${stale}`, good && !stale, text.slice(0, 300));
  await shot("ui-iphone14");
}

// Custom 16:10 locked
const ratioTab = dialog.getByRole("button", { name: /^Ratio$/i }).first();
if (await ratioTab.count()) await ratioTab.click();
const r1610 = dialog.getByText(/16\s*:\s*10/).first();
if (await r1610.count()) await r1610.click();
const lock = dialog.getByRole("button", { name: /Lock/i }).first();
if (await lock.count()) await lock.click().catch(() => undefined);
await page.waitForTimeout(200);
const t1610 = await dialog.innerText();
record("a.chip.ratio1610", "shows 16:10", /16\s*:\s*10/.test(t1610), /16\s*:\s*10/.test(t1610));
await shot("ui-ratio-16-10-locked");

// 720p
const resTab = dialog.getByRole("button", { name: /^Resolution$/i }).first();
if (await resTab.count()) await resTab.click();
const p720 = dialog.getByText(/720p/i).first();
if (await p720.count()) await p720.click();
await page.waitForTimeout(200);
const t720 = await dialog.innerText();
record("a.chip.720p", "1280×720 or 720p", /720p|1280\s*[×x]\s*720/.test(t720), /720p|1280\s*[×x]\s*720/.test(t720));
await shot("ui-720p");

// No false streamScaled for 1440p in setup
const res1440 = dialog.getByText(/1440p/i).first();
if (await res1440.count()) await res1440.click();
await page.waitForTimeout(200);
const t1440 = await dialog.innerText();
const falseBadge = /Emulated,\s*stream scaled/i.test(t1440);
record(
  "a.badge.1440p",
  "no predictive Emulated badge (API scaled=false rule)",
  `badgeShown=${falseBadge}`,
  !falseBadge,
);

// Portrait flip
const portrait = dialog.getByRole("button", { name: /Portrait/i }).first();
if (await portrait.count()) await portrait.click();
await page.waitForTimeout(200);
await shot("ui-portrait-flip");

// Persona expanded
const personaHdr = dialog.getByText(/Persona/i).first();
if (await personaHdr.count()) await personaHdr.click();
await page.waitForTimeout(300);
await shot("ui-persona-expanded");

// Health UI: open a canvas if any listed
await page.keyboard.press("Escape").catch(() => undefined);
await page.waitForTimeout(500);
const canvasItem = page.locator("[class*='explorer'], aside, nav").getByText(/.+/).first();
// Try Replay / canvas node via URL param if HEALTH_CANVAS_ID set
const canvasId = process.env.HEALTH_CANVAS_ID;
if (canvasId) {
  await page.goto(`${BASE}/app-atlas?projectId=local-bypass-project&canvas=${canvasId}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(OUT, "ui-canvas-health-badge.png"), fullPage: false });
  record("d.shot.badge", "canvas screenshot", "ui-canvas-health-badge.png", true);

  // Click first screen node
  const node = page.locator(".react-flow__node").first();
  if (await node.count()) {
    await node.click();
    await page.waitForTimeout(500);
    const healthTab = page.getByRole("button", { name: /^Health$/i }).first();
    if (await healthTab.count()) {
      await healthTab.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUT, "ui-health-tab.png") });
      record("d.shot.healthTab", "Health tab", "ui-health-tab.png", true);
    } else {
      record("d.shot.healthTab", "Health tab", "missing", false);
    }
  }
  const perf = page.getByRole("button", { name: /^Performance$/i }).first();
  if (await perf.count()) {
    await perf.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, "ui-performance-table.png") });
    record("d.shot.performance", "Performance table", "ui-performance-table.png", true);
  } else {
    record("d.shot.performance", "Performance table", "missing", false);
  }
} else {
  record("d.shot.badge", "HEALTH_CANVAS_ID set", "not set", null, "Pass canvas id from API save to screenshot health UI");
  record("d.shot.healthTab", "HEALTH_CANVAS_ID set", "not set", null);
  record("d.shot.performance", "HEALTH_CANVAS_ID set", "not set", null);
}

await fsp.writeFile(path.join(OUT, "ui-results.json"), JSON.stringify(rows, null, 2));
await browser.close();
const fails = rows.filter((r) => r.status === "FAIL").length;
process.exit(fails ? 1 : 0);
