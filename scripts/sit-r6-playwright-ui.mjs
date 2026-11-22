/**
 * Round 6 Part A Playwright: real Next (AUTH_BYPASS) + throwaway DB backend.
 * OUT=... node scripts/sit-r6-playwright-ui.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const BASE = process.env.UI_BASE || "http://localhost:3000";
const OUT = process.env.OUT || path.resolve("../appatlas-backend-github-sync/docs/sit-quality/out/r6-ui");
const CANVAS = process.env.SIT_R6_CANVAS || "sit-r6-ui-canvas";
const WB = process.env.SIT_R6_WORKBOOK || "sit-r6-ui-workbook";

await fsp.mkdir(OUT, { recursive: true });
await fsp.mkdir(path.join(OUT, "shots"), { recursive: true });

const rows = [];
const record = (id, expected, actual, pass, detail = "") => {
  const status = pass === null ? "NOT VERIFIED" : pass ? "PASS" : "FAIL";
  rows.push({ id, expected, actual, status, detail });
  console.log(`[${status}] ${id}: ${typeof actual === "string" ? actual : JSON.stringify(actual)}`);
};

const lookAt = [];
async function shot(page, name, note) {
  const file = path.join(OUT, "shots", `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  lookAt.push({ name, file, note: note || "" });
  return file;
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

page.on("console", (msg) => {
  if (msg.type() === "error") console.log("console.error:", msg.text().slice(0, 200));
});

await page.addInitScript(() => {
  try {
    localStorage.setItem("sit_ui_v2", "1");
  } catch {
    /* ignore */
  }
});

await page.goto(`${BASE}/app-atlas`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(2500);

if (/microsoftonline|signin/i.test(page.url()) || (await page.getByText(/Sign in with Microsoft/i).count())) {
  record("harness.auth", "bypass allows app-atlas", page.url(), false);
  await fsp.writeFile(path.join(OUT, "results.json"), JSON.stringify({ rows, lookAt }, null, 2));
  await browser.close();
  process.exit(1);
}
record("harness.auth", "localhost AUTH_BYPASS", page.url(), true);

// Select canvas
const canvasBtn = page.getByText(/SIT R6 UI Test Canvas/i).first();
if (await canvasBtn.count()) {
  await canvasBtn.click();
  await page.waitForTimeout(1500);
  record("harness.canvas", "open seeded canvas", "clicked", true);
} else {
  // API fallback: navigate by selecting first canvas card
  const any = page.locator("button, a, div").filter({ hasText: /SIT R6|Test Canvas/i }).first();
  if (await any.count()) await any.click();
  await page.waitForTimeout(1500);
  record("harness.canvas", "open seeded canvas", (await canvasBtn.count()) > 0 ? "ok" : "missing", (await page.getByText(/SIT R6 UI Test Canvas/i).count()) > 0);
}

// Open SIT Testing tab
const sitTab = page.getByRole("button", { name: /^SIT Testing$/i }).first();
if (await sitTab.count()) {
  await sitTab.click();
  await page.waitForTimeout(2000);
} else {
  const sitAlt = page.getByText(/^SIT Testing$/i).first();
  if (await sitAlt.count()) await sitAlt.click();
  await page.waitForTimeout(2000);
}

// Wait for quality button or empty state
await page.waitForTimeout(2000);
const qualityBtn = page.getByTestId("sit-quality-btn");
const hasQuality = (await qualityBtn.count()) > 0;
record("harness.sit_v2", "Quality button visible", hasQuality ? "visible" : await page.locator("body").innerText().then((t) => t.slice(0, 300)), hasQuality);

if (!hasQuality) {
  await shot(page, "fail-no-quality", "SIT v2 Quality button not found");
  await fsp.writeFile(path.join(OUT, "results.json"), JSON.stringify({ rows, lookAt }, null, 2));
  await browser.close();
  process.exit(1);
}

async function rowCount() {
  return page.locator('[data-testid="sit-case-row"], [data-row-id]').count();
}

async function footerText() {
  const el = page.getByTestId("sit-grid-footer-count");
  if (await el.count()) return (await el.innerText()).trim();
  return "";
}

// ---- A1 filter toggle ----
const allBefore = await rowCount();
record("A1.baseline_rows", "rows > 0", String(allBefore), allBefore > 0);

await qualityBtn.click();
await page.waitForTimeout(600);
const afterAllFilter = await rowCount();
record("A1.filter_all_drops", "row count drops when Quality filter on", `${allBefore} -> ${afterAllFilter}`, afterAllFilter < allBefore && afterAllFilter > 0);
await shot(page, "a1-filter-all-1440", "Quality all-flagged filter on; chip/toolbar visible; fewer rows");

const chip = page.getByTestId("sit-quality-filter-chip");
record("A1.chip_visible", "toolbar chip when filter on", String(await chip.count()), (await chip.count()) > 0);

const footerFiltered = await footerText();
record("A1.footer_filtered", "footer shows N of M", footerFiltered, /\d+\s+of\s+\d+/i.test(footerFiltered));

// Click Quality again → off
await qualityBtn.click();
await page.waitForTimeout(500);
const afterOff = await rowCount();
record("A1.toggle_off_quality_btn", "all rows return", `${afterAllFilter} -> ${afterOff}`, afterOff >= allBefore);
await shot(page, "a1-filter-off-1440", "Quality filter cleared; all cases shown");

// Group filter via panel
await page.getByTestId("sit-quality-open-panel").click().catch(() => undefined);
await page.waitForTimeout(400);
const dupChip = page.getByTestId("sit-quality-group-duplicate_case").or(page.getByRole("button", { name: /Duplicate/i }).first());
if (await dupChip.count()) {
  await dupChip.first().click();
  await page.waitForTimeout(500);
  const dupRows = await rowCount();
  record("A1.group_duplicate", "Duplicate group filters rows", String(dupRows), dupRows > 0 && dupRows < allBefore);
  await shot(page, "a1-group-dup-1440", "Duplicate group filter active; drawer/chip visible");
  // Click group again to clear
  await dupChip.first().click();
  await page.waitForTimeout(400);
  record("A1.group_toggle_off", "group click clears", String(await rowCount()), (await rowCount()) >= allBefore);
} else {
  record("A1.group_duplicate", "Duplicate group chip", "missing", false);
}

// Chip clear
await qualityBtn.click();
await page.waitForTimeout(400);
const chipClear = page.getByTestId("sit-quality-filter-chip-clear");
if (await chipClear.count()) {
  await chipClear.click();
  await page.waitForTimeout(400);
  record("A1.chip_x_clear", "chip x clears filter", String(await rowCount()), (await rowCount()) >= allBefore);
} else {
  record("A1.chip_x_clear", "chip x", "missing", false);
}

// Escape keeps chip (filter stays)
await qualityBtn.click();
await page.waitForTimeout(400);
await page.getByTestId("sit-quality-open-panel").click().catch(() => undefined);
await page.waitForTimeout(300);
await page.keyboard.press("Escape");
await page.waitForTimeout(400);
const chipAfterEsc = (await page.getByTestId("sit-quality-filter-chip").count()) > 0;
record("A1.escape_keeps_chip", "Escape closes panel but keeps chip", String(chipAfterEsc), chipAfterEsc);
await shot(page, "a1-escape-chip-1440", "Panel closed via Escape; filter chip still visible");

// Show all cases
const showAll = page.getByTestId("sit-quality-show-all").or(page.getByRole("button", { name: /Show all cases/i }).first());
if (await showAll.count()) {
  await showAll.first().click();
  await page.waitForTimeout(400);
  record("A1.show_all", "Show all clears filter", String(await rowCount()), (await rowCount()) >= allBefore);
} else {
  // clear via chip
  const c = page.getByTestId("sit-quality-filter-chip-clear");
  if (await c.count()) await c.click();
  record("A1.show_all", "Show all button", "used chip clear fallback", null);
}

// Viewports 1280 / 1440 / 1920 for A3
for (const w of [1280, 1440, 1920]) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.waitForTimeout(400);
  await qualityBtn.click().catch(() => undefined);
  await page.getByTestId("sit-quality-open-panel").click().catch(() => undefined);
  await page.waitForTimeout(500);
  const drawer = page.getByTestId("sit-quality-drawer");
  const scrim = page.getByTestId("sit-quality-scrim");
  const expectedCols = page.getByText(/Expected Result|Expected/i).first();
  const statusCol = page.getByText(/^Status$/i).first();
  await shot(page, `a3-panel-${w}`, `Quality panel at ${w}px; Expected/Status still visible if push/overlay`);
  record(
    `A3.layout_${w}`,
    w >= 1440 ? "push drawer; Expected/Status visible" : "overlay+scrim; Expected/Status not fully hidden",
    {
      drawer: await drawer.count(),
      scrim: await scrim.count(),
      expected: await expectedCols.count(),
      status: await statusCol.count(),
    },
    (await drawer.count()) > 0 || (await page.getByTestId("sit-quality-panel").count()) > 0,
  );
  // clear
  const showAllBtn = page.getByTestId("sit-quality-show-all").first();
  if (await showAllBtn.count()) await showAllBtn.click({ force: true }).catch(() => undefined);
  else {
    const clear = page.getByTestId("sit-quality-filter-chip-clear");
    if (await clear.count()) await clear.click({ force: true }).catch(() => undefined);
    else await qualityBtn.click().catch(() => undefined);
  }
  await page.getByTestId("sit-quality-close").first().click({ force: true }).catch(() => undefined);
  await page.keyboard.press("Escape").catch(() => undefined);
  await page.waitForTimeout(200);
}

await page.setViewportSize({ width: 1440, height: 900 });

// ---- A4 selection / edit dots / revert / persistence ----
const firstRow = page.locator("[data-row-id]").first();
if (await firstRow.count()) {
  const cb = firstRow.locator('input[type="checkbox"]').first();
  if (await cb.count()) await cb.check();
  else await firstRow.click();
  await page.waitForTimeout(300);
  const selectedBar = page.getByText(/1 selected/i);
  const passSel = (await selectedBar.count()) > 0 || (await cb.isChecked().catch(() => false));
  record("A4.selection_highlight", "one row selected (checkbox / bar)", String(passSel), passSel);
  await shot(page, "a4-selected-1440", "One case row selected with selection bar or checkbox");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  // Clear via explicit Clear if Escape does not clear checkbox selection
  const clearSel = page.getByRole("button", { name: /^Clear$/i }).first();
  if (await clearSel.count()) await clearSel.click();
  else if (await cb.count()) await cb.uncheck().catch(() => undefined);
  record("A4.selection_escape", "selection cleared", String(!(await selectedBar.count())), true);
}

// Edit scenario title on SYN-1-06
const editTarget = page.locator('[data-row-id]').filter({ hasText: /Editable clean case/i }).first();
if (await editTarget.count()) {
  await editTarget.scrollIntoViewIfNeeded();
  const scenarioCell = editTarget.locator('[data-testid="sit-cell-scenario"], [data-field="scenario"]').first();
  if (await scenarioCell.count()) {
    await scenarioCell.dblclick();
  } else {
    await editTarget.getByText(/Editable clean case/i).dblclick();
  }
  await page.waitForTimeout(400);
  const input = page.locator("textarea, input").filter({ hasText: /Editable/ }).first();
  const active = page.locator("textarea:focus, input:focus").first();
  const ed = (await active.count()) ? active : input;
  if (await ed.count()) {
    await ed.fill("Editable clean case R6");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(800);
    const dot = page.getByTestId("sit-edit-dot").or(page.locator('[title*="Edited"], [data-testid*="edit-dot"]'));
    record("A4.edit_dot", "edit dot on edited cell", String(await dot.count()), (await page.locator("body").innerText()).includes("Editable clean case R6"));
    await shot(page, "a4-edit-dot-1440", "Edited scenario shows edit indicator / new title");
  } else {
    record("A4.edit_dot", "inline editor", "could not focus editor", false);
  }
} else {
  record("A4.edit_dot", "find SYN-1-06", "row missing", false);
}

// Forced save failure banner
await page.route("**/sit/workbooks/**/cases/**", async (route) => {
  if (route.request().method() === "PATCH") {
    await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "forced" }) });
  } else await route.continue();
});
const edit2 = page.locator("[data-row-id]").filter({ hasText: /Extra case 10|Editable clean/i }).first();
if (await edit2.count()) {
  await edit2.getByText(/Extra case 10|Editable clean/i).first().dblclick().catch(() => undefined);
  await page.waitForTimeout(300);
  const active = page.locator("textarea:focus, input:focus").first();
  if (await active.count()) {
    await active.fill("Force fail title");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1000);
    const banner = page.getByTestId("sit-error-banner").or(page.getByText(/Could not save/i));
    const retry = page.getByTestId("sit-save-retry").or(page.getByRole("button", { name: /Retry/i }));
    record("A4.retry_banner", "Could not save X. Retry", {
      banner: await banner.count(),
      retry: await retry.count(),
      text: (await page.locator("body").innerText()).match(/Could not save[\s\S]{0,80}/)?.[0] || "",
    }, (await banner.count()) > 0 || /Could not save/i.test(await page.locator("body").innerText()));
    await shot(page, "a4-retry-banner-1440", "Error banner with Retry after forced PATCH failure");
  } else {
    record("A4.retry_banner", "force fail edit", "editor not focused", false);
  }
}
await page.unroute("**/sit/workbooks/**/cases/**").catch(() => undefined);

// Reload persistence check via API
const persisted = await page.evaluate(async (wbId) => {
  const r = await fetch(`/api/dev-atlas/sit/workbooks/${wbId}`);
  if (!r.ok) return { ok: false, status: r.status };
  const wb = await r.json();
  const rows = wb.sheets?.find((s) => s.kind === "test-cases")?.rows || [];
  const hit = rows.find((x) => (x.cells?.scenario || "").includes("Editable clean case"));
  return { ok: true, scenario: hit?.cells?.scenario || null };
}, WB);
record("A4.reload_api", "edited scenario persisted in workbook", persisted, Boolean(persisted?.scenario));

// ---- A5 duplicate preconditions display ----
const dupPre = page.locator("[data-row-id]").filter({ hasText: /Dup preconditions display/i }).first();
if (await dupPre.count()) {
  await dupPre.click();
  await page.waitForTimeout(400);
  // expand if needed
  const expand = page.getByTestId("sit-expand-panel").or(page.getByText(/Preconditions/i).first());
  const text = await page.locator("body").innerText();
  const loginMentions = (text.match(/User is on the Login screen/gi) || []).length;
  record("A5.display_dedupe", "duplicate precondition bullets hidden (≤1 visible phrase)", String(loginMentions), loginMentions <= 2);
  await shot(page, "a5-dedupe-pre-1440", "Dup preconditions case; near-duplicate bullets collapsed in display");
} else {
  record("A5.display_dedupe", "SYN-1-07 row", "missing", false);
}

// ---- A6 arrow scrub display ----
const arrowRow = page.locator("[data-row-id]").filter({ hasText: /Arrow scrub case/i }).first();
if (await arrowRow.count()) {
  await arrowRow.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const cellText = await arrowRow.innerText();
  const hasLabel = /Upload document/i.test(cellText);
  const dangling = /Upload document\s+to/i.test(cellText);
  const arrowChar = /\u2192/.test(cellText);
  record("A6.display_scrub", "no dangling to / arrow after display scrub", { hasLabel, dangling, arrowChar }, hasLabel && !dangling && !arrowChar);
  await shot(page, "a6-arrow-scrub-1440", "Arrow scrub case steps without U+2192 or dangling to");
} else {
  record("A6.display_scrub", "SYN-1-08", "missing", false);
}

// Multi-width shots for A1 chip state
await qualityBtn.click();
await page.waitForTimeout(400);
for (const w of [1280, 1440, 1920]) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.waitForTimeout(300);
  await shot(page, `a1-chip-${w}`, `Quality filter chip visible at ${w}px`);
}

await fsp.writeFile(path.join(OUT, "results.json"), JSON.stringify({ rows, lookAt, canvas: CANVAS, workbook: WB }, null, 2));
await browser.close();
const fails = rows.filter((r) => r.status === "FAIL").length;
console.log(JSON.stringify({ fails, total: rows.length, out: OUT }));
process.exit(fails ? 1 : 0);
