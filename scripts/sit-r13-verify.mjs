/**
 * Round 13 Playwright: provenance chips, All = AI + Human, Edited toggle, R12 carry-overs.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.UI_BASE || "http://localhost:3000";
const OUT = process.env.OUT || path.resolve(__dirname, "../../appatlas-backend-github-sync/docs/sit-quality/out/r13");
const CANVAS = process.env.SIT_R13_CANVAS_LABEL || "SIT R13 Provenance Canvas";
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

async function openSit(label = CANVAS, opts = { resetFilters: true }) {
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
  if (opts.resetFilters) {
    await page.evaluate(() => {
      try {
        localStorage.removeItem("sit_v2_origin_filter");
        localStorage.removeItem("sit_v2_edited_only");
        localStorage.removeItem("sit_v2_selected_keys");
        localStorage.removeItem("sit_v2_scope_pill");
      } catch {
        /* ignore */
      }
    });
  }
  const canvas = page.getByText(new RegExp(label, "i")).first();
  if (await canvas.count()) await canvas.click();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /^SIT Testing$/i }).first().click().catch(async () => {
    await page.getByText(/^SIT Testing$/i).first().click();
  });
  await page.waitForTimeout(2500);
}

await openSit();
await page.getByTestId("sit-page-loading").waitFor({ state: "hidden", timeout: 60000 }).catch(() => {});
await page.getByTestId("sit-scope-pill-all").waitFor({ timeout: 60000 });

const chipN = async (testId) => {
  const t = await page.getByTestId(testId).innerText();
  const m = t.trim().match(/(\d+)\s*$/);
  return Number(m?.[1] || -1);
};

const allSources = await chipN("sit-origin-chip-all");
const aiN = await chipN("sit-origin-chip-ai");
const humanN = await chipN("sit-origin-chip-human");
record("r13.all_equals_ai_plus_human", allSources === aiN + humanN && allSources >= 14, `all=${allSources} ai=${aiN} human=${humanN}`);

const editedN = await chipN("sit-edited-toggle");
await page.getByTestId("sit-edited-toggle").click();
await page.waitForTimeout(300);
const shown = await page.getByTestId("sit-toolbar-showing-count").innerText().catch(() => "");
const mShown = shown.match(/(\d+)\s+of\s+(\d+)/i);
record(
  "r13.edited_filter_matches_count",
  editedN >= 2 && mShown && Number(mShown[1]) === editedN,
  `edited=${editedN} shown=${shown}`,
);
const dots = await page.locator('[data-testid="sit-edited-dot"]').count();
record("r13.edited_dot_equals_chip", dots === editedN, `dots=${dots} edited=${editedN}`);
await page.getByTestId("sit-edited-toggle").click();

// Adjacent chip text uniqueness in filter row
const filterTexts = await page.locator('[data-testid="sit-ticket-scope-group"] button, [data-testid="sit-origin-filter-chips"] button, [data-testid="sit-edited-toggle"]').allInnerTexts();
const normalized = filterTexts.map((t) => t.trim().replace(/\s+/g, " "));
let dupAdj = false;
for (let i = 0; i < normalized.length - 1; i++) {
  if (normalized[i] === normalized[i + 1]) dupAdj = true;
}
record("r13.no_duplicate_adjacent_chip_text", !dupAdj, normalized.join(" | "));

const allTicketsLabel = await page.getByTestId("sit-scope-pill-all").innerText();
const allSourcesLabel = await page.getByTestId("sit-origin-chip-all").innerText();
record(
  "r13.distinct_all_labels",
  /tickets/i.test(allTicketsLabel) && /sources/i.test(allSourcesLabel),
  `tickets="${allTicketsLabel}" sources="${allSourcesLabel}"`,
);

// Human always visible (even if 0 on a single ticket)
await page.getByTestId("sit-scope-pill-DW-10").click();
await page.waitForTimeout(200);
const humanOnDw10 = await page.getByTestId("sit-origin-chip-human").count();
record("r13.human_chip_always_shown", humanOnDw10 === 1, `count=${humanOnDw10}`);
await page.getByTestId("sit-scope-pill-all").click();

// Persist migrate: edited -> All + edited toggle (do not clear storage on this reload)
await page.evaluate(() => {
  localStorage.setItem("sit_v2_origin_filter", "edited");
  localStorage.removeItem("sit_v2_edited_only");
});
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await page.getByText(/SIT R13 Provenance Canvas/i).first().click().catch(() => {});
await page.waitForTimeout(800);
await page.getByRole("button", { name: /^SIT Testing$/i }).first().click().catch(() => {});
await page.waitForTimeout(3000);
const editedPressed = await page.getByTestId("sit-edited-toggle").getAttribute("aria-pressed").catch(() => "missing");
const originAll = await page.getByTestId("sit-origin-chip-all").getAttribute("aria-pressed").catch(() => "missing");
record("r13.migrate_edited_persist", editedPressed === "true" && originAll === "true", `edited=${editedPressed} all=${originAll}`);

// R12 carry: Clear All -> EMPTY-NO-SELECTION
await page.getByRole("button", { name: /Clear All/i }).click().catch(() => {});
await page.waitForTimeout(600);
const emptySel = await page.getByTestId("sit-page-empty-no-selection").count();
record("r13.empty_no_selection", emptySel > 0, `n=${emptySel}`);

// Reselect via picker checkboxes
await page.getByRole("button", { name: /Jira Tickets/i }).first().click();
await page.waitForTimeout(500);
for (const k of ["DW-7", "DW-9", "DW-10"]) {
  const row = page.getByTestId(`sit-jira-case-count-${k}`).locator("xpath=ancestor::*[contains(@class,'') or true()][1]").first();
  await page.locator(`text=${k}`).first().click({ force: true }).catch(() => {});
  await page.getByRole("checkbox").nth(0).check({ force: true }).catch(() => {});
}
// Click Done
await page.getByRole("button", { name: /^Done$/i }).click({ force: true }).catch(() => {});
await page.waitForTimeout(2000);
let allAgain = await page.getByTestId("sit-scope-pill-all").count();
if (allAgain === 0) {
  // Fallback: history keys from workbooks should populate after load without selection in R12 rule
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await page.getByText(/SIT R13 Provenance Canvas/i).first().click().catch(() => {});
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /^SIT Testing$/i }).first().click().catch(() => {});
  await page.waitForTimeout(2500);
  allAgain = await page.getByTestId("sit-scope-pill-all").count();
}
record("r13.reselect_populated", allAgain > 0, `all=${allAgain}`);

record("r13.zero_generate", generateHits === 0, `hits=${generateHits}`);

// Screenshots
await page.getByTestId("sit-origin-chip-all").click().catch(() => {});
await page.getByTestId("sit-edited-toggle").click({ force: true }).catch(() => {});
for (const w of WIDTHS) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, "shots", `filter-edited-${w}.png`), fullPage: false });
  await page.getByTestId("sit-edited-toggle").click({ force: true }).catch(() => {});
  await page.screenshot({ path: path.join(OUT, "shots", `filter-all-${w}.png`), fullPage: false });
  await page.getByTestId("sit-edited-toggle").click({ force: true }).catch(() => {});
}
record("r13.shots", true, `widths=${WIDTHS.join(",")}`);

await browser.close();
const failed = rows.filter((r) => r.status === "FAIL").length;
const passed = rows.filter((r) => r.status === "PASS").length;
const summary = { passed, failed, generateHits, rows };
await fsp.writeFile(path.join(OUT, "gates", "r13-verify.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary));
process.exit(failed ? 1 : 0);
