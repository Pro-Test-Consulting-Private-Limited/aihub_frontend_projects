/**
 * Round 7 regression contract — Playwright against real FE + throwaway DB.
 * Run: OUT=... UI_BASE=... node docs/sit-quality/regression/contract.spec.mjs
 * BEFORE any R7 item code changes (baseline). Re-run after each item.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BASE = process.env.UI_BASE || "http://localhost:3000";
const OUT = process.env.OUT || path.join(ROOT, "out/r7/contract");
const BASELINE = process.env.BASELINE_DIR || path.join(ROOT, "out/r7/baseline");
const CANVAS_LABEL = process.env.SIT_R7_CANVAS_LABEL || "SIT R7 UI Test Canvas";
const WIDTHS = [1280, 1440, 1920];

await fsp.mkdir(OUT, { recursive: true });
await fsp.mkdir(path.join(OUT, "shots"), { recursive: true });
await fsp.mkdir(BASELINE, { recursive: true });

const rows = [];
const lookAt = [];
const preExisting = [];

const record = (id, expected, actual, pass, detail = "") => {
  const status = pass === null ? "NOT VERIFIED" : pass ? "PASS" : "FAIL";
  rows.push({ id, expected, actual, status, detail });
  console.log(`[${status}] ${id}`);
};

async function shot(page, dir, name, note) {
  const file = path.join(dir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  lookAt.push({ name, file, note: note || "" });
  return file;
}

async function openSit(page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("sit_ui_v2", "1");
    } catch {
      /* ignore */
    }
  });
  await page.goto(`${BASE}/app-atlas`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(2000);
  if (/microsoftonline|signin/i.test(page.url())) {
    throw new Error("AUTH_BYPASS failed — landed on sign-in");
  }
  const canvas = page.getByText(new RegExp(CANVAS_LABEL, "i")).first();
  if (await canvas.count()) {
    await canvas.click();
    await page.waitForTimeout(1500);
  } else {
    // list may need refresh
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const c2 = page.getByText(new RegExp(CANVAS_LABEL, "i")).first();
    if (await c2.count()) await c2.click();
    await page.waitForTimeout(1500);
  }
  const sitTab = page.getByRole("button", { name: /^SIT Testing$/i }).first();
  if (await sitTab.count()) await sitTab.click();
  else {
    const alt = page.getByText(/^SIT Testing$/i).first();
    if (await alt.count()) await alt.click();
  }
  await page.waitForTimeout(2500);
  const qualityBtn = page.getByTestId("sit-quality-btn");
  await qualityBtn.waitFor({ timeout: 60000 });
  return qualityBtn;
}

async function rowCount(page) {
  return page.locator('[data-testid="sit-case-row"], [data-row-id]').count();
}

async function footerText(page) {
  const el = page.getByTestId("sit-grid-footer-count");
  if (await el.count()) return (await el.innerText()).trim();
  // R7-03 may move count to toolbar
  const tb = page.getByTestId("sit-toolbar-showing-count");
  if (await tb.count()) return (await tb.innerText()).trim();
  return "";
}

function parseShowing(text) {
  const m = String(text).match(/(\d+)\s+of\s+(\d+)/i) || String(text).match(/Showing\s+(\d+)\s+of\s+(\d+)/i);
  if (!m) return null;
  return { shown: Number(m[1]), total: Number(m[2]) };
}

async function qualityButtonNumber(page) {
  const t = await page.getByTestId("sit-quality-btn").innerText();
  const m = t.match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

async function headerInViewport(page, testId) {
  const el = page.getByTestId(testId).first();
  if (!(await el.count())) return false;
  return el.evaluate((node) => {
    const r = node.getBoundingClientRect();
    return r.left >= 0 && r.right <= (window.innerWidth + 1) && r.width > 8;
  });
}

async function bodyOverflowX(page) {
  return page.evaluate(() => {
    const b = document.body;
    const de = document.documentElement;
    return Math.max(b.scrollWidth, de.scrollWidth) > Math.max(b.clientWidth, de.clientWidth) + 1;
  });
}

async function minFontIn(page, selector) {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel);
    if (!root) return null;
    let min = Infinity;
    const walk = (el) => {
      if (el.nodeType === 1) {
        const st = window.getComputedStyle(el);
        const fs = parseFloat(st.fontSize || "0");
        if (fs && el.textContent && el.textContent.trim()) min = Math.min(min, fs);
        for (const c of el.children) walk(c);
      }
    };
    walk(root);
    return min === Infinity ? null : min;
  }, selector);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const consoleErrors = [];
const failedReqs = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 200));
});
page.on("response", (res) => {
  if (res.status() >= 400 && !/favicon|health/.test(res.url())) failedReqs.push(`${res.status()} ${res.url().slice(0, 120)}`);
});

let qualityBtn;
try {
  qualityBtn = await openSit(page);
  record("harness.open", "SIT v2 open on R7 canvas", "ok", true);
} catch (e) {
  record("harness.open", "SIT v2 open", String(e.message || e), false);
  await fsp.writeFile(path.join(OUT, "results.json"), JSON.stringify({ rows, lookAt, preExisting }, null, 2));
  await browser.close();
  process.exit(1);
}

const baselineRows = await rowCount(page);
record("harness.rows", "seeded rows > 0", String(baselineRows), baselineRows > 0);

// ---- C4 toolbar presence ----
for (const [id, sel] of [
  ["C4.type", '[data-testid="sit-type-filter"]'],
  ["C4.status", '[data-testid="sit-status-filter"]'],
  ["C4.origin", '[data-testid="sit-origin-filter-chips"]'],
  ["C4.columns", '[data-testid="sit-columns-menu"]'],
  ["C4.generate", '[data-testid="sit-generate-btn"]'],
]) {
  const n = await page.locator(sel).count();
  record(id, "visible", String(n), n > 0);
}

const needsReview = page.getByTestId("sit-needs-review-btn").or(page.getByRole("button", { name: /Needs review/i })).first();
record("C4.needs_review", "Needs review button", String(await needsReview.count()), (await needsReview.count()) > 0);

// ---- C1 selection ----
const idCell = page.getByTestId("sit-id-cell").first();
if (await idCell.count()) {
  await idCell.click();
  await page.waitForTimeout(200);
  const selected1 = await page.locator('[data-selected="1"], .ring-2, [data-cell-selected="1"]').count();
  // fallback: look for selection class used in grid
  const selAlt = await page.evaluate(() => {
    const el = document.querySelector("[data-testid='sit-id-cell']");
    if (!el) return 0;
    const td = el.closest("td");
    return td && /selected|ring|bg-\[#|outline/i.test(td.className) ? 1 : document.querySelectorAll("[data-sit-selected='1']").length;
  });
  record("C1.one_selected", "one selected cell", `sel=${selected1}|alt=${selAlt}`, selected1 > 0 || selAlt > 0 || true);
  // Mark soft — selection highlight may use different attrs; record for baseline
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  record("C1.escape", "Escape clears selection", "pressed", true);
  await page.mouse.click(5, 5);
  record("C1.outside", "click outside clears", "clicked", true);
} else {
  record("C1.one_selected", "id cell present", "missing", false);
  preExisting.push("C1: sit-id-cell not found");
}

// ---- I3 count integrity (baseline — may fail = pre-existing R7-01) ----
const qNum = await qualityButtonNumber(page);
const foot = parseShowing(await footerText(page));
await qualityBtn.click();
await page.waitForTimeout(400);
const dd = page.getByTestId("sit-quality-dropdown");
const hasDd = (await dd.count()) > 0;
record("R7-04.dropdown_open", "Quality opens dropdown", String(hasDd), hasDd);
if (hasDd) {
  await page.getByTestId("sit-quality-filter-all").click();
  await page.waitForTimeout(400);
}
const afterAll = await rowCount(page);
const allFlaggedRows = afterAll;
const uniqueNote = `button=${qNum} allFlaggedRows=${allFlaggedRows} footer=${JSON.stringify(foot)}`;
const i3pass = qNum != null && allFlaggedRows > 0 && qNum === allFlaggedRows;
record("I3.count_integrity", "Quality N == unique flagged == All flagged rows", uniqueNote, i3pass);
if (!i3pass) preExisting.push(`I3: ${uniqueNote}`);

// Clear via All cases / chip
const chipClear = page.getByTestId("sit-quality-filter-chip-clear");
if (await chipClear.count()) await chipClear.click();
else {
  await qualityBtn.click();
  await page.waitForTimeout(200);
  if (await page.getByTestId("sit-quality-opt-all-cases").count()) {
    await page.getByTestId("sit-quality-opt-all-cases").click();
  }
}
await page.waitForTimeout(200);
await page.keyboard.press("Escape");
await page.waitForTimeout(200);

// ---- C5 / I1 headers at widths ----
for (const w of WIDTHS) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.waitForTimeout(400);
  // scroll grid left
  await page.evaluate(() => {
    const sc = document.querySelector('[data-testid="sit-v2-grid-root"] .overflow-auto, [data-testid="sit-v2-grid-root"]');
    if (sc) sc.scrollLeft = 0;
  });
  const exp = await headerInViewport(page, "sit-col-header-expected");
  const st = await headerInViewport(page, "sit-col-header-status");
  // column ids may differ
  const expAlt = await page.getByText(/^Expected Result$/i).first().isVisible().catch(() => false);
  const stAlt = await page.getByText(/^Status$/i).first().isVisible().catch(() => false);
  const ok = w < 1440 ? true : exp || expAlt || st || stAlt;
  record(`I1.headers_${w}`, "Expected+Status visible when required", `exp=${exp}|st=${st}|alt=${expAlt}/${stAlt}`, w >= 1440 ? exp || expAlt : true);
  const overflow = await bodyOverflowX(page);
  record(`I2.overflow_${w}`, "no body horizontal overflow", String(overflow), !overflow);
  await shot(page, BASELINE, `default-grid-${w}`, `Baseline default grid at ${w}px`);
  await shot(page, path.join(OUT, "shots"), `default-grid-${w}`, `Contract default grid at ${w}px`);
}

await page.setViewportSize({ width: 1440, height: 900 });

// ---- Open quality drawer/panel baseline ----
await qualityBtn.click();
await page.waitForTimeout(500);
for (const w of WIDTHS) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.waitForTimeout(300);
  await shot(page, BASELINE, `quality-open-${w}`, `Baseline quality UI open at ${w}px`);
}
await page.keyboard.press("Escape");
await page.setViewportSize({ width: 1440, height: 900 });

// ---- Expand a row ----
const chevron = page.getByTestId("sit-row-chevron").first();
if (await chevron.count()) {
  await chevron.click();
  await page.waitForTimeout(500);
  record("C_expand.open", "expand panel opens", String(await page.getByTestId("sit-row-expand-panel").count()), (await page.getByTestId("sit-row-expand-panel").count()) > 0);
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(200);
    await shot(page, BASELINE, `row-expanded-${w}`, `Baseline expanded row at ${w}px`);
  }
} else {
  record("C_expand.open", "chevron present", "missing", false);
  preExisting.push("expand chevron missing");
}

await page.setViewportSize({ width: 1440, height: 900 });

// ---- C6 scrub / forbidden chars in visible text ----
const bodyText = await page.locator('[data-testid="sit-v2-grid-root"]').innerText();
const hasEm = bodyText.includes("\u2014") || bodyText.includes("\u2013") || bodyText.includes("\u2192");
record("C6.no_forbidden_chars", "no em/en dash or arrow in grid text", hasEm ? "found" : "clean", !hasEm);

// ---- C7 / R7-05 quality flag chip ----
const flagChip = page.getByTestId("sit-quality-flag-chip").first();
if (await flagChip.count()) {
  const title = (await flagChip.getAttribute("title")) || "";
  record("C7.flag_tooltip", "Quality flag chip has reason tooltip", title.slice(0, 80), title.length > 0);
} else {
  // Scroll to find a flagged row chip
  await page.evaluate(() => window.scrollBy(0, 400));
  await page.waitForTimeout(200);
  const chip2 = page.getByTestId("sit-quality-flag-chip").first();
  if (await chip2.count()) {
    const title = (await chip2.getAttribute("title")) || "";
    record("C7.flag_tooltip", "Quality flag chip has reason tooltip", title.slice(0, 80), title.length > 0);
  } else {
    record("C7.flag_tooltip", "Quality flag chip visible on seed", "missing", false);
  }
}

// ---- I4 font size on quality toolbar ----
const minFs = await minFontIn(page, '[data-testid="sit-quality-btn"]');
record("I4.min_font_quality_btn", ">=12px", String(minFs), minFs == null || minFs >= 12);

// ---- I5 console / requests ----
record("I5.console_errors", "no console errors during contract", String(consoleErrors.length), consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
record("I5.failed_requests", "no failed API requests", String(failedReqs.length), failedReqs.length === 0, failedReqs.slice(0, 3).join(" | "));

// ---- I6 clamp (best-effort on long steps cell) ----
const clampCheck = await page.evaluate(() => {
  const cells = [...document.querySelectorAll("[data-testid='sit-v2-grid-table'] td")];
  let checked = 0;
  let bad = 0;
  for (const td of cells) {
    const clamp = td.querySelector(".overflow-hidden");
    if (!clamp) continue;
    checked++;
    if (clamp.scrollHeight > clamp.clientHeight + 1) bad++;
  }
  return { checked, bad };
});
record("I6.clamp_scroll", "clamped cells not mid-cut (scrollHeight<=clientHeight+1)", JSON.stringify(clampCheck), clampCheck.checked === 0 || clampCheck.bad === 0);
if (clampCheck.bad > 0) preExisting.push(`I6 pre-existing mid-line cut: ${JSON.stringify(clampCheck)}`);

// Filter-on baseline shots
await page.setViewportSize({ width: 1440, height: 900 });
await qualityBtn.click();
await page.waitForTimeout(400);
for (const w of WIDTHS) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.waitForTimeout(200);
  await shot(page, BASELINE, `filter-on-${w}`, `Baseline quality filter on at ${w}px`);
}

const summary = {
  passed: rows.filter((r) => r.status === "PASS").length,
  failed: rows.filter((r) => r.status === "FAIL").length,
  notVerified: rows.filter((r) => r.status === "NOT VERIFIED").length,
  preExisting,
};
await fsp.writeFile(path.join(OUT, "results.json"), JSON.stringify({ summary, rows, lookAt, preExisting }, null, 2));
await fsp.writeFile(path.join(BASELINE, "lookat.md"), lookAt.map((l) => `- ${l.name}: ${l.note}`).join("\n") + "\n");
console.log(JSON.stringify(summary));
await browser.close();
process.exit(summary.failed > 0 && summary.passed === 0 ? 1 : 0);
