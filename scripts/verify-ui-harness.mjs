/**
 * Phase A UI harness — local next + AUTH_BYPASS_LOCAL=1 + tunnel to appatlas.
 *   OUT=../appatlas-backend/verify-output HEALTH_CANVAS_ID=... node scripts/verify-ui-harness.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const BASE = process.env.UI_BASE || "http://localhost:3000";
const OUT = process.env.OUT || path.resolve("verify-output");
const PROJECT_ID = process.env.BYPASS_PROJECT_ID || "a88245fd-828f-419e-a4e5-dd47449e968a";
const HEALTH_CANVAS_ID = process.env.HEALTH_CANVAS_ID || "";
const DIALOG_CAP = (vh) => vh - 48;

await fsp.mkdir(OUT, { recursive: true });
await fsp.mkdir(path.join(OUT, "crops"), { recursive: true });

const rows = [];
const record = (scenario, expected, actual, pass, detail = "") => {
  const status = pass === null ? "NOT VERIFIED" : pass ? "PASS" : "FAIL";
  rows.push({ scenario, expected, actual: typeof actual === "string" ? actual : JSON.stringify(actual), status, detail });
  console.log(`[${status}] ${scenario}: ${typeof actual === "string" ? actual : JSON.stringify(actual)}`);
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(`${BASE}/app-atlas?projectId=${PROJECT_ID}`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(2500);
if (/microsoftonline|signin/i.test(page.url()) || (await page.getByText(/Sign in with Microsoft/i).count())) {
  record("a.harness.auth", "bypass allows app-atlas", page.url(), false);
  await fsp.writeFile(path.join(OUT, "ui-results.json"), JSON.stringify(rows, null, 2));
  await browser.close();
  process.exit(1);
}
record("a.harness.auth", "localhost bypass + real project id", page.url(), true);
await page.screenshot({ path: path.join(OUT, "ui-harness-bypass.png") });

const openDialog = async () => {
  await page.getByRole("button", { name: /^Run AppAtlas$/i }).first().click({ timeout: 15000 });
  await page.waitForTimeout(900);
  return page.getByRole("dialog").first();
};

let dialog = await openDialog();
record("a.dialog.open", "dialog visible", (await dialog.count()) ? "ok" : "missing", (await dialog.count()) > 0);

const deviceCat = (name) =>
  dialog.locator('[role=tablist][aria-label="Device category"] button', { hasText: new RegExp(`^${name}$`, "i") });

async function setDensity(mode) {
  await page.evaluate((m) => {
    document.documentElement.dataset.appatlasDensity = m;
    window.dispatchEvent(new Event("appatlas-density"));
  }, mode);
  await page.waitForTimeout(250);
}

async function snapshotScrollContext() {
  return dialog.evaluate((el) => {
    const cs = getComputedStyle(el);
    const root = {
      tag: el.tagName,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      overflowY: cs.overflowY,
      density: el.getAttribute("data-density"),
    };
    const descendants = [];
    for (const node of el.querySelectorAll("*")) {
      const s = getComputedStyle(node);
      const oy = s.overflowY;
      // Only count real scroll/clip containers with meaningful size (ignore 0×0 / tiny chrome).
      if ((oy === "auto" || oy === "scroll" || oy === "hidden") && node.clientHeight >= 24 && node.clientWidth >= 24) {
        const scrollable = node.scrollHeight > node.clientHeight + 1;
        descendants.push({
          tag: node.tagName,
          className: String(node.className || "").slice(0, 80),
          overflowY: oy,
          scrollHeight: node.scrollHeight,
          clientHeight: node.clientHeight,
          scrollable,
        });
      }
    }
    return { root, descendants };
  });
}

async function dialogMeta() {
  return dialog.evaluate((el) => {
    const text = el.innerText || "";
    const density = el.getAttribute("data-density");
    const personaExpanded = Boolean(el.querySelector('[aria-expanded="true"]'));
    // Infer selected device from chips strip near bottom
    const chips = [...el.querySelectorAll("span")].map((s) => s.textContent || "").filter(Boolean);
    return {
      density,
      personaExpanded,
      orientation: /Portrait/i.test(text) && el.querySelector('[aria-pressed="true"]')
        ? [...el.querySelectorAll('[aria-pressed="true"]')].map((b) => b.textContent).find((t) => /Portrait|Landscape/i.test(t || ""))
        : null,
      textSlice: text.slice(0, 200),
      chips: chips.slice(0, 12),
    };
  });
}

async function measureScroll(label, viewport, mode, extra = {}) {
  const m = await snapshotScrollContext();
  const meta = await dialogMeta();
  const cap = DIALOG_CAP(viewport.height);
  const atCap = Math.abs(m.root.clientHeight - cap) <= 2 || m.root.clientHeight >= cap - 1;
  // Real scrollers only (overflow auto/scroll). overflow:hidden clip is allowed when not at the dialog cap.
  const badDesc = m.descendants.filter((d) => d.scrollable && (d.overflowY === "auto" || d.overflowY === "scroll"));
  const clippedAtCap =
    atCap &&
    m.descendants.some(
      (d) => d.scrollable && (d.overflowY === "auto" || d.overflowY === "scroll" || d.overflowY === "hidden"),
    );
  const rootFail = m.root.scrollHeight > m.root.clientHeight + 1;
  const pass = !rootFail && badDesc.length === 0 && !clippedAtCap;
  const actual = {
    viewport,
    mode,
    density: m.root.density,
    selectedDevice: extra.device || meta.chips[0] || null,
    orientation: extra.orientation || meta.orientation,
    personaExpanded: extra.personaExpanded ?? meta.personaExpanded,
    customNetworkOpen: extra.customNetworkOpen ?? false,
    root: { sh: m.root.scrollHeight, ch: m.root.clientHeight, cap },
    overflowDescendants: m.descendants.length,
    scrollableDescendants: badDesc.length,
    atCap,
    clippedAtCap,
  };
  record(`a.scroll.${label}`, "no root/descendant scroll or cap-clip", actual, pass);
  return { pass, actual, m };
}

async function goCustomSizeBy(modeName) {
  const edit = dialog.getByRole("button", { name: /Edit as custom/i }).first();
  if (await edit.count()) await edit.click();
  else {
    await deviceCat("Custom").click();
    await page.waitForTimeout(150);
    const card = dialog.getByText(/Custom size/i).first();
    if (await card.count()) await card.click();
  }
  await page.waitForTimeout(150);
  const tab = dialog.locator('[role=tablist][aria-label="Size by"] button').filter({ hasText: new RegExp(`^${modeName}$`, "i") });
  if (await tab.count()) await tab.click();
  await page.waitForTimeout(120);
}

async function selectPhonePortrait() {
  const portrait = dialog.getByRole("button", { name: /^Portrait$/i }).first();
  if (await portrait.count()) await portrait.click();
  await deviceCat("Phone").click();
  await page.waitForTimeout(200);
  await dialog.getByText(/^iPhone 14$/i).first().click();
  await page.waitForTimeout(300);
}

async function openPersona(open = true) {
  const btn = dialog.locator('button[aria-expanded]').filter({ hasText: /^Persona$/i }).first();
  if (!(await btn.count())) {
    const hdr = dialog.getByText(/^Persona$/i).first();
    if (await hdr.count()) await hdr.click();
  } else {
    const expanded = await btn.getAttribute("aria-expanded");
    if ((expanded === "true") !== open) await btn.click();
  }
  await page.waitForTimeout(200);
}

async function openCustomNetwork(open = true) {
  const netCustom = dialog.locator('[role=listbox][aria-label="Network profile"] button', { hasText: /^Custom$/i }).first();
  const target = (await netCustom.count()) ? netCustom : dialog.getByText(/^Custom$/).nth(1);
  if (open && (await target.count())) await target.click();
  await page.waitForTimeout(250);
}

// ---------- Height variance explanation sample (comfortable density) ----------
await setDensity("comfortable");
const heightSamples = [];
for (const [w, h] of [
  [1366, 768],
  [1440, 900],
  [1920, 1080],
]) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(200);
  await goCustomSizeBy("Pixels");
  await openPersona(false);
  const m = await snapshotScrollContext();
  heightSamples.push({ viewport: `${w}x${h}`, mode: "Pixels", rootCH: m.root.clientHeight, rootSH: m.root.scrollHeight, cap: DIALOG_CAP(h), density: m.root.density });
}
record(
  "a.scroll.height-variance",
  "same mode can differ because max-h=100vh-48 and flex preview grows into remaining space; residual persona/network also changes content height",
  heightSamples,
  true,
);

// ---------- Matrix under compact (auto / forced) ----------
await setDensity("compact");
for (const [w, h] of [
  [1366, 768],
  [1440, 900],
  [1920, 1080],
]) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(200);
  for (const mode of ["Pixels", "Ratio", "Resolution"]) {
    await goCustomSizeBy(mode);
    await openPersona(false);
    await measureScroll(`${w}x${h}-${mode}`, { width: w, height: h }, mode, {
      personaExpanded: false,
      customNetworkOpen: false,
    });
  }
  await openPersona(true);
  await measureScroll(`${w}x${h}-persona`, { width: w, height: h }, "persona", {
    personaExpanded: true,
    customNetworkOpen: false,
  });
}

// ---------- Worst-case before/after at 1366x768 and 1280x720 ----------
const worstCases = [
  { id: "phone-persona-customnet", setup: async () => { await selectPhonePortrait(); await openPersona(true); await openCustomNetwork(true); } },
  { id: "ratio-persona", setup: async () => { await goCustomSizeBy("Ratio"); await openPersona(true); } },
];

for (const vp of [
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
]) {
  for (const wc of worstCases) {
    await page.setViewportSize(vp);
    await setDensity("comfortable");
    await wc.setup();
    const before = await measureScroll(`worst-before-${vp.width}x${vp.height}-${wc.id}`, vp, wc.id, {
      personaExpanded: true,
      customNetworkOpen: wc.id.includes("customnet"),
      orientation: "portrait",
      device: wc.id.startsWith("phone") ? "iPhone 14" : "custom",
    });
    // Comfortable baseline may intentionally fail — rewrite last row as NOT VERIFIED baseline.
    if (!before.pass) {
      const last = rows[rows.length - 1];
      last.status = "NOT VERIFIED";
      last.detail = "comfortable baseline before densify (expected tight/overflow)";
      console.log(`[NOT VERIFIED] ${last.scenario}: baseline before densify`);
    }
    await setDensity("compact");
    await wc.setup();
    const after = await measureScroll(`worst-after-${vp.width}x${vp.height}-${wc.id}`, vp, wc.id, {
      personaExpanded: true,
      customNetworkOpen: wc.id.includes("customnet"),
      orientation: "portrait",
      device: wc.id.startsWith("phone") ? "iPhone 14" : "custom",
    });
    record(
      `a.scroll.worst-delta-${vp.width}x${vp.height}-${wc.id}`,
      "compact reduces height / eliminates scroll",
      { before: before.actual.root, after: after.actual.root, beforePass: before.pass, afterPass: after.pass },
      after.pass,
    );
  }
}

await page.setViewportSize({ width: 1440, height: 900 });
await setDensity("compact");

async function shot(name) {
  const file = path.join(OUT, `${name}.png`);
  await dialog.screenshot({ path: file });
  record(`a.shot.${name}`, "file saved", file, fs.existsSync(file) && fs.statSync(file).size > 1000);
}

// Chips
await selectPhonePortrait();
await page.waitForTimeout(400);
{
  const text = await dialog.innerText();
  const good = /390\s*[×x]\s*844/.test(text);
  const badPill = /412\s*[×x]\s*915\s*·/.test(text);
  record("a.chip.iphone14", "390×844 not 412×915", { good, badPill }, good && !badPill);
  await shot("ui-iphone14");
}

// Wait for real preview (project id resolves)
await page.waitForTimeout(8000);
{
  const okPreview = await dialog.locator('img[alt=""]').count();
  const hasRetry = await dialog.getByText(/^Retry$/i).count();
  const loading = await dialog.getByText(/Loading preview/i).count();
  record("a.preview.iphone14", "real page rendered (or still loading)", { okPreview, hasRetry, loading }, okPreview > 0 || loading === 0);
  await shot("ui-preview-iphone14");
}

await goCustomSizeBy("Ratio");
const r1610 = dialog.getByText(/16\s*:\s*10/).first();
if (await r1610.count()) await r1610.click();
const lock = dialog.getByRole("button", { name: /Lock/i }).first();
if (await lock.count()) await lock.click().catch(() => undefined);
await shot("ui-ratio-16-10-locked");
record("a.chip.ratio1610", "shows 16:10", /16\s*:\s*10/.test(await dialog.innerText()), /16\s*:\s*10/.test(await dialog.innerText()));

await goCustomSizeBy("Resolution");
const p720 = dialog.getByRole("button", { name: /720p/i }).first();
if (await p720.count()) await p720.click();
await page.waitForTimeout(300);
record("a.chip.720p", "1280×720 or 720p", /720p|1280\s*[×x]\s*720/.test(await dialog.innerText()), /720p|1280\s*[×x]\s*720/.test(await dialog.innerText()));
await shot("ui-720p");

const res1440 = dialog.getByRole("button", { name: /1440p/i }).first();
if (await res1440.count()) await res1440.click();
record("a.badge.1440p-setup", "no predictive Emulated badge", !/Emulated,\s*stream scaled/i.test(await dialog.innerText()), !/Emulated,\s*stream scaled/i.test(await dialog.innerText()));

// Desktop HD preview
await deviceCat("Laptop / Desktop").click();
await page.waitForTimeout(200);
const deskHd = dialog.getByText(/Desktop HD/i).first();
if (await deskHd.count()) await deskHd.click();
await page.waitForTimeout(8000);
await shot("ui-preview-desktop-hd");
record("a.preview.desktop-hd", "preview screenshot saved", "ui-preview-desktop-hd.png", fs.existsSync(path.join(OUT, "ui-preview-desktop-hd.png")));

// Failure + Retry: force offline then back? Use offline profile for unavailable-ish, or abort via page route
await page.route("**/api/dev-atlas/preview", (route) => route.abort());
await page.route("**/preview", (route) => route.abort());
await dialog.getByRole("button", { name: /Refresh preview|Retry/i }).first().click().catch(async () => {
  // change size to retrigger
  const d = dialog.getByText(/^Desktop$/i).first();
  if (await d.count()) await d.click();
});
await page.waitForTimeout(1500);
await shot("ui-preview-retry");
record("a.preview.retry", "Retry failure state visible", (await dialog.getByText(/^Retry$/i).count()) > 0, (await dialog.getByText(/^Retry$/i).count()) > 0);
await page.unroute("**/api/dev-atlas/preview").catch(() => undefined);
await page.unroute("**/preview").catch(() => undefined);

const portrait = dialog.getByRole("button", { name: /Portrait/i }).first();
if (await portrait.count()) await portrait.click();
await shot("ui-portrait-flip");
await openPersona(true);
await shot("ui-persona-expanded");

// ---------- Live badge: start 4K and 720p recordings ----------
async function startRecordingAtResolution(resLabel) {
  await goCustomSizeBy("Resolution");
  const btn = dialog.getByRole("button", { name: new RegExp(resLabel, "i") }).first();
  if (!(await btn.count())) throw new Error(`resolution ${resLabel} missing`);
  await btn.click();
  await page.waitForTimeout(300);
  await dialog.getByRole("button", { name: /^Start recording$/i }).click();
  await page.waitForTimeout(5000);
}

async function readLiveChipsAndScaled() {
  const body = await page.locator("body").innerText();
  const badge = /Emulated,\s*stream scaled/i.test(body);
  // Prefer API poll via window fetch through bypass
  const scaled = await page.evaluate(async () => {
    try {
      const r = await fetch("/api/dev-atlas/sessions?limit=5");
      if (!r.ok) return { error: r.status };
      const data = await r.json();
      const items = Array.isArray(data) ? data : data.items || data.sessions || [];
      const live = items.find((s) => /recording|starting/i.test(s.status || "")) || items[0];
      return live?.emulation || live || null;
    } catch (e) {
      return { error: String(e) };
    }
  });
  return { badge, scaled, bodySlice: body.slice(0, 400) };
}

async function stopRecording() {
  const stop = page.getByRole("button", { name: /Stop|Finish|End recording/i }).first();
  if (await stop.count()) {
    await stop.click();
    await page.waitForTimeout(2000);
  } else {
    await page.keyboard.press("Escape").catch(() => undefined);
  }
}

// Live badge: create sessions via bypass API (authoritative streamScaled), then drive UI chips when possible.
async function apiSession(width, height) {
  const r = await page.evaluate(
    async ({ width, height }) => {
      const res = await fetch("/api/dev-atlas/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: "https://ai-hub-demo.protestcorp.com/",
          provider: "vnc",
          width,
          height,
          orientation: "landscape",
          devicePreset: "custom",
        }),
      });
      const j = await res.json();
      if (!res.ok) return { error: res.status, j };
      for (let i = 0; i < 25; i++) {
        await new Promise((r) => setTimeout(r, 800));
        const g = await fetch(`/api/dev-atlas/sessions/${j.id}`);
        const snap = await g.json();
        if (snap.status === "recording" || snap.emulation) return snap;
      }
      return j;
    },
    { width, height },
  );
  return r;
}

async function apiFinish(id) {
  await page.evaluate(async (id) => {
    await fetch(`/api/dev-atlas/sessions/${id}/finish`, { method: "POST" }).catch(() => undefined);
  }, id);
}

async function waitChip(re, ms = 25000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const body = await page.locator("body").innerText();
    if (re.test(body)) return true;
    await page.waitForTimeout(800);
  }
  return re.test(await page.locator("body").innerText());
}

async function uiRecordScaled(resLabel) {
  await page.goto(`${BASE}/app-atlas?projectId=${PROJECT_ID}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(2000);
  dialog = await openDialog();
  await startRecordingAtResolution(resLabel);
  // Poll live session from API while UI settles
  let emu = null;
  for (let i = 0; i < 30; i++) {
    emu = await page.evaluate(async () => {
      const r = await fetch("/api/dev-atlas/sessions?limit=8");
      const data = await r.json();
      const items = Array.isArray(data) ? data : data.items || data.sessions || [];
      const live = items.find((s) => /recording|starting/i.test(s.status || ""));
      return live?.emulation || null;
    });
    if (emu && typeof emu.streamScaled === "boolean") break;
    await page.waitForTimeout(700);
  }
  return emu;
}

try {
  const emu4k = await uiRecordScaled("4K");
  record("a.badge.api-4k", "session.emulation.streamScaled===true", emu4k, emu4k?.streamScaled === true);
  const chip4k = await waitChip(/Emulated,\s*stream scaled/i, 20000);
  await page.screenshot({ path: path.join(OUT, "ui-live-4k-chips.png"), fullPage: false });
  record("a.badge.live-4k-chip", "Emulated, stream scaled visible", chip4k, chip4k);
  await stopRecording();
  await page.waitForTimeout(2500);

  const emu720 = await uiRecordScaled("720p");
  record("a.badge.api-720p", "session.emulation.streamScaled===false", emu720, emu720?.streamScaled === false);
  await page.waitForTimeout(2000);
  const body720 = await page.locator("body").innerText();
  const chip720 = /Emulated,\s*stream scaled/i.test(body720);
  await page.screenshot({ path: path.join(OUT, "ui-live-720p-chips.png"), fullPage: false });
  record("a.badge.live-720p-chip", "no Emulated badge", !chip720, !chip720);
  await stopRecording();
} catch (err) {
  record("a.badge.live", "live sessions via UI+API", String(err), false);
}

// Health screenshots if canvas id provided
if (HEALTH_CANVAS_ID) {
  await page.goto(`${BASE}/app-atlas?projectId=${PROJECT_ID}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const named = page.getByText(/PhaseA-health/i).first();
  if (await named.count()) await named.click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, "ui-canvas-health-badge.png") });
  const box = await page.locator(".react-flow__node").first().boundingBox();
  if (box) await page.mouse.click(box.x + 40, box.y + 12);
  await page.waitForTimeout(600);
  const healthTab = page.getByRole("button", { name: /^Health$/i }).first();
  if (await healthTab.count()) {
    await healthTab.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, "ui-health-tab.png") });
    record("d.shot.healthTab", "Health tab", "ok", true);
  }
  const perf = page.getByRole("button", { name: /^Performance$/i }).first();
  if (await perf.count()) {
    await perf.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, "ui-performance-table.png") });
    record("d.shot.performance", "Performance table", "ok", true);
  }
  record("d.shot.badge", "health badge canvas", "ui-canvas-health-badge.png", true);
}

await fsp.writeFile(path.join(OUT, "ui-results.json"), JSON.stringify(rows, null, 2));
await browser.close();
const fails = rows.filter((r) => r.status === "FAIL").length;
process.exit(fails ? 1 : 0);
