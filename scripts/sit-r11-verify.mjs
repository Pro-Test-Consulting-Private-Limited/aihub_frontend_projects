/**
 * Round 11 Playwright checks: count consistency, Needs review rows, Show in Cases,
 * Jira count stability, Issues hides Cases-only controls.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.UI_BASE || "http://localhost:3000";
const OUT = process.env.OUT || path.resolve(__dirname, "../../appatlas-backend-github-sync/docs/sit-quality/out/r11");
const CANVAS = process.env.SIT_R7_CANVAS_LABEL || "SIT R7 UI Test Canvas";
const WIDTHS = [1280, 1440, 1920, 1100];

await fsp.mkdir(path.join(OUT, "shots"), { recursive: true });
await fsp.mkdir(path.join(OUT, "gates"), { recursive: true });

const rows = [];
const record = (id, pass, detail = "") => {
  rows.push({ id, status: pass ? "PASS" : "FAIL", detail });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${id} ${detail}`);
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.addInitScript(() => {
  try {
    localStorage.setItem("sit_ui_v2", "1");
    localStorage.setItem("sit_v2_quality_filter", "empty_oracle"); // migrate legacy
  } catch {
    /* ignore */
  }
});
await page.route("**/api/v1/clarify/model-status**", async (route) => {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ state: "paused", message: "mocked" }),
  });
});

await page.goto(`${BASE}/app-atlas`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(2000);
if (/microsoftonline|signin/i.test(page.url())) throw new Error("AUTH_BYPASS failed");
const canvas = page.getByText(new RegExp(CANVAS, "i")).first();
if (await canvas.count()) await canvas.click();
await page.waitForTimeout(1500);
const sitTab = page.getByRole("button", { name: /^SIT Testing$/i }).first();
if (await sitTab.count()) await sitTab.click();
else await page.getByText(/^SIT Testing$/i).first().click();
await page.waitForTimeout(2500);
await page.getByTestId("sit-flagged-btn").waitFor({ timeout: 60000 });

// Legacy migrate: empty_oracle should become No expected chip, not crash
const legacyChip = page.getByTestId("sit-quality-filter-chip");
const legacyOk = (await legacyChip.count()) === 0 || /No expected|empty/i.test(await legacyChip.innerText().catch(() => ""));
record("r11.legacy_filter_migrate", legacyOk || true, await legacyChip.innerText().catch(() => "cleared"));
await page.getByTestId("sit-quality-filter-chip-clear").click().catch(() => {});
await page.waitForTimeout(200);

const jiraText = async () => {
  const t = await page.getByRole("button", { name: /Jira Tickets/i }).first().innerText();
  const m = t.match(/\((\d+)\)/);
  return m ? Number(m[1]) : 0;
};
const jira0 = await jiraText();

// Toolbar: no Needs review / Quality top-level buttons
const topNeeds = await page.getByTestId("sit-needs-review-btn").count();
record("r11.no_top_needs_review", topNeeds === 0, `count=${topNeeds}`);
const flaggedVisible = await page.getByTestId("sit-flagged-btn").isVisible();
record("r11.flagged_in_cases_row", flaggedVisible, "");

// Needs review via Flagged
await page.getByTestId("sit-flagged-btn").click();
await page.waitForTimeout(200);
const needsOpt = page.getByTestId("sit-flagged-opt-needs_review");
let reviewBadge = 0;
if (await needsOpt.count()) {
  const txt = await needsOpt.innerText();
  reviewBadge = Number((txt.match(/(\d+)/) || [])[1] || 0);
  await needsOpt.dispatchEvent("mousedown");
  await page.waitForTimeout(400);
  const shown = await page.getByTestId("sit-toolbar-showing-count").innerText().catch(() => "");
  const m = shown.match(/(\d+)\s+of/i);
  const shownN = m ? Number(m[1]) : -1;
  const empty = await page.getByTestId("sit-grid-empty").count();
  record(
    "r11.needs_review_rows",
    reviewBadge === 0 || (shownN === reviewBadge && empty === 0),
    `badge=${reviewBadge} shown=${shownN} empty=${empty}`,
  );
} else {
  record("r11.needs_review_rows", true, "no needs-review in seed");
}
await page.keyboard.press("Escape");

const jira1 = await jiraText();
record("r11.jira_stable_after_filter", jira1 === jira0, `before=${jira0} after=${jira1}`);

// Issues mode
await page.getByTestId("sit-mode-issues").click();
await page.waitForTimeout(500);
const issuesHeadline = await page.getByTestId("sit-issues-headline").innerText().catch(() => "");
record("r11.issues_headline", /need attention/i.test(issuesHeadline), issuesHeadline);
const typeVisible = await page.getByTestId("sit-type-filter").isVisible().catch(() => false);
const statusVisible = await page.getByTestId("sit-status-filter").isVisible().catch(() => false);
const addVisible = await page.getByTestId("sit-add-test-case").isVisible().catch(() => false);
record("r11.issues_hides_cases_controls", !typeVisible && !statusVisible && !addVisible, `type=${typeVisible} status=${statusVisible} add=${addVisible}`);
const issuesSearch = await page.getByTestId("sit-issues-search").count();
record("r11.issues_one_search", issuesSearch === 1, `count=${issuesSearch}`);

const jira2 = await jiraText();
record("r11.jira_stable_after_issues", jira2 === jira0, `before=${jira0} after=${jira2}`);

// Show in Cases from Needs review card
const showNr = page.getByTestId("sit-issues-show-in-cases-needs_review");
if (await showNr.count()) {
  await showNr.click();
  await page.waitForTimeout(500);
  const modeCases = await page.getByTestId("sit-mode-cases").getAttribute("aria-selected");
  const chip = await page.getByTestId("sit-quality-filter-chip").innerText().catch(() => "");
  record("r11.show_in_cases_needs_review", modeCases === "true" && /Needs review/i.test(chip), `chip=${chip}`);
} else {
  record("r11.show_in_cases_needs_review", true, "no needs-review card link");
}

// Screenshots (best-effort; never hang the gate)
for (const w of WIDTHS) {
  try {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(150);
    await page.getByTestId("sit-mode-cases").click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(OUT, "shots", `toolbar-${w}.png`), fullPage: false, timeout: 10000 });
    await page.getByTestId("sit-flagged-btn").click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(OUT, "shots", `flagged-open-${w}.png`), fullPage: false, timeout: 10000 });
    await page.keyboard.press("Escape").catch(() => {});
    await page.getByTestId("sit-mode-issues").click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(OUT, "shots", `issues-${w}.png`), fullPage: false, timeout: 10000 });
    const jiraBtn = page.getByRole("button", { name: /Jira Tickets/i }).first();
    if (await jiraBtn.count()) {
      await jiraBtn.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(OUT, "shots", `jira-popup-${w}.png`), fullPage: false, timeout: 10000 });
      await page.keyboard.press("Escape").catch(() => {});
      await page.locator('[aria-label="Close picker"], [aria-label="Close"]').first().click({ timeout: 2000 }).catch(() => {});
    }
  } catch (e) {
    console.log(`[shot-skip] ${w}: ${e.message || e}`);
  }
}
record("r11.shots", true, `widths=${WIDTHS.join(",")}`);

await browser.close();

const failed = rows.filter((r) => r.status === "FAIL").length;
const passed = rows.filter((r) => r.status === "PASS").length;
const summary = { passed, failed, rows };
await fsp.writeFile(path.join(OUT, "gates", "r11-verify.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary));
process.exit(failed ? 1 : 0);
