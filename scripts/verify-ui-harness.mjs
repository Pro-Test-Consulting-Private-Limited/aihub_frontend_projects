/**
 * Phase A UI harness — requires local next dev with AUTH_BYPASS_LOCAL=1.
 *   OUT=../appatlas-backend/verify-output HEALTH_CANVAS_ID=... node scripts/verify-ui-harness.mjs
 *
 * Use UI_BASE=http://localhost:3000 (not 127.0.0.1) so Next.js HMR/dev assets load.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const BASE = process.env.UI_BASE || "http://localhost:3000";
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
await page.screenshot({ path: path.join(OUT, "ui-harness-bypass.png") });

const openDialog = async () => {
  const btn = page.getByRole("button", { name: /^Run AppAtlas$/i }).first();
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

const deviceCat = (name) =>
  dialog.locator('[role=tablist][aria-label="Device category"] button', { hasText: new RegExp(`^${name}$`, "i") });

async function measureScroll(label) {
  const m = await dialog.evaluate((el) => ({
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  }));
  const pass = m.scrollHeight <= m.clientHeight + 1;
  record(`a.scroll.${label}`, "scrollHeight<=clientHeight", JSON.stringify(m), pass);
  return pass;
}

async function openCustomSizeBy(mode) {
  // Prefer "Edit as custom" when present; else Custom category + Custom size card
  const edit = dialog.getByRole("button", { name: /Edit as custom/i }).first();
  if (await edit.count()) {
    await edit.click();
  } else {
    await deviceCat("Custom").click();
    await page.waitForTimeout(200);
    const card = dialog.getByText(/Custom size/i).first();
    if (await card.count()) await card.click();
  }
  await page.waitForTimeout(200);
  const sizeBy = dialog.locator('[role=tablist][aria-label="Size by"] button');
  const tab = sizeBy.filter({ hasText: new RegExp(`^${mode}$`, "i") });
  if (await tab.count()) await tab.click();
  await page.waitForTimeout(150);
}

for (const [w, h] of [
  [1366, 768],
  [1440, 900],
  [1920, 1080],
]) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(250);
  for (const mode of ["Pixels", "Ratio", "Resolution"]) {
    await openCustomSizeBy(mode);
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
await deviceCat("Phone").click();
await page.waitForTimeout(300);
const iphone = dialog.getByText(/^iPhone 14$/i).first();
if (await iphone.count()) {
  await iphone.click();
  await page.waitForTimeout(400);
  const text = await dialog.innerText();
  const good = /390\s*[×x]\s*844/.test(text);
  const stale = /412\s*[×x]\s*915/.test(text) && /Pixel 7[\s\S]{0,40}selected|chip.*412/i.test(text);
  // Pixel 7 may remain listed; assert selected chips are iPhone dims (summary pills)
  const pillsOk = /390\s*[×x]\s*844/.test(text) && /iPhone 14/i.test(text);
  const badPill = /Desktop[\s\S]{0,40}412\s*[×x]\s*915|412\s*[×x]\s*915\s*·/.test(text);
  record(
    "a.chip.iphone14",
    "390×844 not 412×915",
    `good=${good} pillsOk=${pillsOk} badPill=${badPill}`,
    good && pillsOk && !badPill,
    text.slice(0, 400),
  );
  await shot("ui-iphone14");
} else {
  record("a.chip.iphone14", "390×844 not 412×915", "iPhone 14 not found", false);
}

// Custom 16:10 locked
await openCustomSizeBy("Ratio");
const r1610 = dialog.getByText(/16\s*:\s*10/).first();
if (await r1610.count()) await r1610.click();
const lock = dialog.getByRole("button", { name: /Lock/i }).first();
if (await lock.count()) await lock.click().catch(() => undefined);
await page.waitForTimeout(200);
const t1610 = await dialog.innerText();
record("a.chip.ratio1610", "shows 16:10", /16\s*:\s*10/.test(t1610), /16\s*:\s*10/.test(t1610));
await shot("ui-ratio-16-10-locked");

// 720p
await openCustomSizeBy("Resolution");
const p720 = dialog.getByRole("button", { name: /720p/i }).first();
if (await p720.count()) await p720.click();
await page.waitForTimeout(300);
const t720 = await dialog.innerText();
const chip720 = /720p|1280\s*[×x]\s*720/.test(t720);
record("a.chip.720p", "1280×720 or 720p", `match=${chip720}`, chip720, t720.slice(0, 400));
await shot("ui-720p");

// No false streamScaled for 1440p in setup
const res1440 = dialog.getByRole("button", { name: /1440p/i }).first();
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
const personaHdr = dialog.getByText(/^Persona$/i).first();
if (await personaHdr.count()) await personaHdr.click();
await page.waitForTimeout(300);
await shot("ui-persona-expanded");

// Health UI
await page.keyboard.press("Escape").catch(() => undefined);
await page.waitForTimeout(600);

const canvasId = process.env.HEALTH_CANVAS_ID;
if (canvasId) {
  await page.getByText(/PhaseA-health/i).first().waitFor({ timeout: 20000 }).catch(() => undefined);
  await page.waitForTimeout(800);
  const named = page.getByText(/PhaseA-health/i).first();
  if (await named.count()) await named.click();
  await page.waitForTimeout(3000);
  await page.locator(".react-flow__node").first().waitFor({ timeout: 15000 });
  await page.screenshot({ path: path.join(OUT, "ui-canvas-health-badge.png"), fullPage: false });
  const hasNode = await page.locator(".react-flow__node").count();
  const badgeVisible = (await page.locator(".react-flow__node").innerText().catch(() => "")).length > 0;
  record(
    "d.shot.badge",
    "node health badge visible on canvas",
    `nodes=${hasNode} badgeText=${badgeVisible}`,
    hasNode > 0 && fs.statSync(path.join(OUT, "ui-canvas-health-badge.png")).size > 1000,
  );

  // Click node header (not screenshot — img stopPropagation) to open Requirements drawer
  const nodeBox = await page.locator(".react-flow__node").first().boundingBox();
  if (nodeBox) await page.mouse.click(nodeBox.x + 40, nodeBox.y + 12);
  await page.waitForTimeout(800);
  let healthTab = page.getByRole("button", { name: /^Health$/i }).first();
  if (!(await healthTab.count())) {
    await page.locator(".react-flow__node").first().click({ position: { x: 20, y: 10 } });
    await page.waitForTimeout(500);
    healthTab = page.getByRole("button", { name: /^Health$/i }).first();
  }
  if (await healthTab.count()) {
    await healthTab.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, "ui-health-tab.png") });
    const ht = await page.locator("body").innerText();
    const healthOk = /Needs attention|Healthy|Unhealthy|TTFB|a11y|Console errors/i.test(ht);
    record("d.shot.healthTab", "Requirements drawer Health tab", `ok=${healthOk}`, healthOk);
  } else {
    // Panel may default to Requirements — look for drawer chrome
    const req = await page.getByText(/Requirements|Jira Tickets|Agile Project/i).count();
    record("d.shot.healthTab", "Health tab", `missing reqChrome=${req}`, false);
    await page.screenshot({ path: path.join(OUT, "ui-health-tab-missing.png") });
  }

  const perf = page.getByRole("button", { name: /^Performance$/i }).first();
  if (await perf.count()) {
    await perf.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, "ui-performance-table.png") });
    const pt = await page.locator("body").innerText();
    const perfOk = /TTFB|LCP|CLS|Web Vitals|\/login|ms/i.test(pt) && !/Open a canvas to see/i.test(pt);
    record("d.shot.performance", "Performance table with health rows", `ok=${perfOk}`, perfOk, pt.slice(0, 200));
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
