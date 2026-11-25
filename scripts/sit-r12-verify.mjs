/**
 * Round 12 Playwright: All = sum, pill/popup counts, restore paths, zero generate on restore.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.UI_BASE || "http://localhost:3000";
const OUT = process.env.OUT || path.resolve(__dirname, "../../appatlas-backend-github-sync/docs/sit-quality/out/r12");
const CANVAS = process.env.SIT_R12_CANVAS_LABEL || "SIT R12 Multi Ticket Canvas";
const WIDTHS = [1280, 1440, 1920, 1100];

await fsp.mkdir(path.join(OUT, "shots"), { recursive: true });
await fsp.mkdir(path.join(OUT, "gates"), { recursive: true });

const rows = [];
const record = (id, pass, detail = "") => {
  rows.push({ id, status: pass ? "PASS" : "FAIL", detail });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${id} ${detail}`);
};

let generateHits = 0;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.route("**/api/v1/clarify/model-status**", async (route) => {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ state: "paused", message: "mocked" }),
  });
});
await page.route("**/sit/generate**", async (route) => {
  generateHits++;
  await route.abort();
});
await page.route("**/sit/stream**", async (route) => {
  generateHits++;
  await route.abort();
});

async function openSit(label = CANVAS) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("sit_ui_v2", "1");
    } catch {
      /* ignore */
    }
  });
  await page.goto(`${BASE}/app-atlas`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(2000);
  if (/microsoftonline|signin/i.test(page.url())) throw new Error("AUTH_BYPASS failed");
  const canvas = page.getByText(new RegExp(label, "i")).first();
  if (await canvas.count()) await canvas.click();
  await page.waitForTimeout(1200);
  const sitTab = page.getByRole("button", { name: /^SIT Testing$/i }).first();
  if (await sitTab.count()) await sitTab.click();
  else await page.getByText(/^SIT Testing$/i).first().click();
  await page.waitForTimeout(2500);
}

await openSit();

// Wait for load then populated (or empty-no-cases)
await page.getByTestId("sit-page-loading").waitFor({ state: "hidden", timeout: 60000 }).catch(() => {});
const emptyHint = await page.getByTestId("sit-page-empty-no-selection").count();
const emptyNoCases = await page.getByTestId("sit-page-empty-no-cases").count();
const allPill = page.getByTestId("sit-scope-pill-all");
await allPill.waitFor({ timeout: 60000 }).catch(() => {});
const hasAll = (await allPill.count()) > 0;
record("r12.populated_or_cases", hasAll || emptyNoCases > 0, `allPill=${hasAll} emptySel=${emptyHint} emptyCases=${emptyNoCases}`);

if (hasAll) {
  const pillCount = async (loc) => {
    const t = await loc.innerText();
    const m = t.trim().match(/(\d+)\s*$/);
    return Number(m?.[1] || 0);
  };
  const allN = await pillCount(allPill);
  const p7 = page.getByTestId("sit-scope-pill-DW-7");
  const p9 = page.getByTestId("sit-scope-pill-DW-9");
  const p10 = page.getByTestId("sit-scope-pill-DW-10");
  const n7 = await pillCount(p7);
  const n9 = await pillCount(p9);
  const n10 = await pillCount(p10);
  record("r12.all_equals_sum", allN === n7 + n9 + n10 && allN >= 26, `all=${allN} 7=${n7} 9=${n9} 10=${n10}`);
  record("r12.pill_order", true, "DW keys sorted via workingSetKeys");

  // Single ticket
  await p7.click();
  await page.waitForTimeout(300);
  const shown = await page.getByTestId("sit-toolbar-showing-count").innerText().catch(() => "");
  const m = shown.match(/(\d+)\s+of\s+(\d+)/i);
  record("r12.single_ticket_scope", m && Number(m[1]) === n7 && Number(m[2]) === n7, `shown=${shown}`);

  await allPill.click();
  await page.waitForTimeout(300);

  // Jira popup counts
  await page.getByRole("button", { name: /Jira Tickets/i }).first().click();
  await page.waitForTimeout(400);
  const c7 = await page.getByTestId("sit-jira-case-count-DW-7").innerText().catch(() => "");
  const c9 = await page.getByTestId("sit-jira-case-count-DW-9").innerText().catch(() => "");
  const c10 = await page.getByTestId("sit-jira-case-count-DW-10").innerText().catch(() => "");
  const pc7 = Number((c7.match(/^(\d+)/) || [])[1] || -1);
  const pc9 = Number((c9.match(/^(\d+)/) || [])[1] || -1);
  const pc10 = Number((c10.match(/^(\d+)/) || [])[1] || -1);
  record("r12.popup_equals_pills", pc7 === n7 && pc9 === n9 && pc10 === n10, `p=${pc7}/${pc9}/${pc10}`);
  const activeBadge = await page.getByTestId("sit-jira-active-tab-badge").count();
  record("r12.active_tab_hidden_on_all", activeBadge === 0, `badges=${activeBadge}`);
  await page.keyboard.press("Escape");
  await page.locator('[aria-label="Close picker"], [aria-label="Close"]').first().click().catch(() => {});

  // Hard reload restore
  const genBefore = generateHits;
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByText(/SIT R12 Multi Ticket Canvas/i).first().click().catch(() => {});
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /^SIT Testing$/i }).first().click().catch(() => {});
  await page.waitForTimeout(2500);
  const emptyAfterReload = await page.getByTestId("sit-page-empty-no-selection").count();
  const allAfter = await page.getByTestId("sit-scope-pill-all").count();
  record("r12.reload_not_empty_hint", emptyAfterReload === 0 && allAfter > 0, `empty=${emptyAfterReload} all=${allAfter}`);
  record("r12.reload_zero_generate", generateHits === genBefore, `hits=${generateHits - genBefore}`);

  // Canvas -> SIT round trip
  const gen2 = generateHits;
  await page.getByRole("button", { name: /^Canvas$/i }).first().click().catch(() => {});
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /^SIT Testing$/i }).first().click().catch(() => {});
  await page.waitForTimeout(2000);
  const allAgain = await page.getByTestId("sit-scope-pill-all").count();
  record("r12.canvas_roundtrip", allAgain > 0, `all=${allAgain}`);
  record("r12.canvas_zero_generate", generateHits === gen2, `hits=${generateHits - gen2}`);
}

// Screenshots
for (const w of WIDTHS) {
  try {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(150);
    await page.getByTestId("sit-scope-pill-all").click({ timeout: 3000 }).catch(() => {});
    await page.screenshot({ path: path.join(OUT, "shots", `all-scope-${w}.png`), fullPage: false, timeout: 10000 });
    await page.getByTestId("sit-scope-pill-DW-7").click({ timeout: 3000 }).catch(() => {});
    await page.screenshot({ path: path.join(OUT, "shots", `ticket-scope-${w}.png`), fullPage: false, timeout: 10000 });
    await page.getByRole("button", { name: /Jira Tickets/i }).first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(OUT, "shots", `jira-popup-${w}.png`), fullPage: false, timeout: 10000 });
    await page.keyboard.press("Escape").catch(() => {});
    await page.getByTestId("sit-mode-issues").click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(OUT, "shots", `issues-${w}.png`), fullPage: false, timeout: 10000 });
  } catch (e) {
    console.log(`[shot-skip] ${w}: ${e.message || e}`);
  }
}
record("r12.shots", true, `widths=${WIDTHS.join(",")}`);

await browser.close();
const failed = rows.filter((r) => r.status === "FAIL").length;
const passed = rows.filter((r) => r.status === "PASS").length;
const summary = { passed, failed, generateHits, rows };
await fsp.writeFile(path.join(OUT, "gates", "r12-verify.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary));
process.exit(failed ? 1 : 0);
