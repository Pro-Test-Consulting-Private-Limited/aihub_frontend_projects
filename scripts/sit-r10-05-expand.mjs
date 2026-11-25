/**
 * R10-05 Playwright: expand panel cleanup on throwaway harness.
 * Asserts: reason text once per flag; no AI original on Legacy; left-aligned columns @1440/1920.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.UI_BASE || "http://localhost:3000";
const OUT = process.env.OUT || path.resolve(__dirname, "../../appatlas-backend-github-sync/docs/sit-quality/out/r10/after-r10-05");
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

async function expandCase(idText) {
  const row = page.locator("[data-row-id]").filter({ hasText: idText }).first();
  await row.waitFor({ timeout: 15000 });
  await row.getByTestId("sit-row-chevron").click();
  await page.getByTestId("sit-row-expand-panel").waitFor({ timeout: 10000 });
}

async function collapse() {
  const open = page.getByTestId("sit-row-expand-panel");
  if ((await open.count()) === 0) return;
  const chevron = page.locator('[data-testid="sit-row-chevron"][aria-expanded="true"]').first();
  if ((await chevron.count()) > 0) {
    await chevron.click();
    await page.waitForTimeout(400);
  }
}

// --- Flagged multi-flag row: reason appears once each ---
await expandCase("SYN-1-18");
const panelText = await page.getByTestId("sit-row-expand-panel").innerText();
const qualityText = await page.getByTestId("sit-expand-quality").innerText().catch(() => "");
const coversText = await page.getByTestId("sit-expand-covers").innerText();
results.push({
  step: "flagged_covers_no_ac_wording",
  coversHasNoAc: /No acceptance criteria linked/i.test(coversText),
  coversHasOld: /No AC ids on this case/i.test(coversText),
});

// Count long reason phrases in whole panel (not short chip labels)
const reasonSnippets = [];
const reasons = await page.getByTestId("sit-expand-quality").locator("li").allTextContents().catch(() => []);
for (const r of reasons) {
  const core = r.replace(/\s+/g, " ").trim().slice(0, 40);
  if (!core) continue;
  const re = new RegExp(core.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
  const matches = panelText.match(re) || [];
  reasonSnippets.push({ core, count: matches.length });
}
results.push({ step: "reason_once", reasons: reasonSnippets, ok: reasonSnippets.every((x) => x.count === 1) });

await page.screenshot({ path: path.join(OUT, "expand-flagged-1440.png"), fullPage: false });
await collapse();

// --- Legacy: no AI original tab ---
await expandCase("SYN-1-19");
const aiTab = await page.getByTestId("sit-expand-tab-ai").count();
const histTab = await page.getByTestId("sit-expand-tab-history").count();
results.push({ step: "legacy_no_ai_tab", aiTab, histTab, ok: aiTab === 0 && histTab === 1 });
await page.screenshot({ path: path.join(OUT, "expand-legacy-1440.png"), fullPage: false });
await collapse();

// --- AI row ---
await expandCase("SYN-1-01");
const aiTabAi = await page.getByTestId("sit-expand-tab-ai").count();
results.push({ step: "ai_has_ai_tab", aiTabAi, ok: aiTabAi === 1 });
await page.screenshot({ path: path.join(OUT, "expand-ai-1440.png"), fullPage: false });
await collapse();

// --- Edited AI row: double-click scenario title on SYN-1-10, save, expand History ---
await collapse();
const editRow = page.locator("[data-row-id]").filter({ hasText: "SYN-1-10" }).first();
await editRow.getByTestId("sit-scenario-title").dblclick({ timeout: 10000 });
await page.waitForTimeout(300);
const titleEditor = page.getByTestId("sit-scenario-title-editor");
if ((await titleEditor.count()) > 0) {
  await titleEditor.fill("Editable AI case with error wording (edited for R10-05)");
  await titleEditor.press("Enter");
  await page.waitForTimeout(1000);
} else {
  const ta = page.locator("textarea").first();
  if ((await ta.count()) > 0) {
    await ta.fill("Editable AI case with error wording (edited for R10-05)");
    await ta.press("Enter");
    await page.waitForTimeout(1000);
  }
}
await expandCase("SYN-1-10");
const editsBlock = page.getByTestId("sit-expand-edits");
const editsText = (await editsBlock.count()) > 0 ? await editsBlock.innerText() : "";
const hasEdit =
  /scenario|edited|Revert|changed/i.test(editsText) ||
  (await page.getByTestId("sit-revert-all-ai").count()) > 0 ||
  (await page.getByTestId("sit-expand-header").innerText()).includes("Edited");
results.push({ step: "edited_row_history", hasEdit, snippet: editsText.slice(0, 160), ok: hasEdit });
await page.screenshot({ path: path.join(OUT, "expand-edited-1440.png"), fullPage: false });

// --- Column left-align @1440 and @1920 ---
for (const w of [1440, 1920]) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.waitForTimeout(300);
  const geo = await page.evaluate(() => {
    const cols = document.querySelector('[data-testid="sit-expand-columns"]');
    const covers = document.querySelector('[data-testid="sit-expand-covers"]');
    const quality = document.querySelector('[data-testid="sit-expand-quality-col"]');
    const activity = document.querySelector('[data-testid="sit-expand-activity"]');
    if (!cols || !covers || !quality || !activity) return { ok: false, reason: "missing" };
    const cr = cols.getBoundingClientRect();
    const a = covers.getBoundingClientRect();
    const b = quality.getBoundingClientRect();
    const c = activity.getBoundingClientRect();
    // left-aligned: first column near left of panel; no huge stretch gap between first and last on same row
    const leftAligned = Math.abs(a.left - cr.left) < 24;
    const sameRow = Math.abs(a.top - b.top) < 40 && Math.abs(a.top - c.top) < 40;
    const gapAB = b.left - a.right;
    const gapBC = c.left - b.right;
    const noHugeGap = !sameRow || (gapAB < 120 && gapBC < 120);
    return {
      ok: leftAligned && noHugeGap,
      leftAligned,
      sameRow,
      gapAB,
      gapBC,
      widths: { a: a.width, b: b.width, c: c.width },
    };
  });
  results.push({ step: `columns_align_${w}`, ...geo });
  await page.screenshot({ path: path.join(OUT, `expand-columns-${w}.png`), fullPage: false });
}

const ok = results.every((r) => r.ok !== false);
console.log(JSON.stringify({ ok, results, out: OUT }, null, 2));
await browser.close();
process.exit(ok ? 0 : 1);
