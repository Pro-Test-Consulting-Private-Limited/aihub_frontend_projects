/**
 * Post-deploy DEV-data checks (model OFF OK).
 * Local AUTH_BYPASS -> SSH tunnel -> live appatlas.
 * Expects FE at 5fb8b18+ (viewWorkingKeys / no selection collapse).
 */
import { chromium } from "playwright";
import fsp from "node:fs/promises";
import path from "node:path";

const OUT = process.env.OUT || "C:/code/appatlas-backend-github-sync/docs/sit-quality/out/r17b-dev-deep";
const BASE = (process.env.UI_BASE || "http://localhost:3000").replace("127.0.0.1", "localhost");
const CANVAS = process.env.SIT_DEV_CANVAS || "shashankprotest";

await fsp.mkdir(path.join(OUT, "shots"), { recursive: true });
await fsp.mkdir(path.join(OUT, "gates"), { recursive: true });

const results = {
  mode: "postdeploy-bypass-to-dev-api",
  canvas: CANVAS,
  base: BASE,
  checks: {},
  at: new Date().toISOString(),
};
const log = (...a) => console.error(new Date().toISOString(), ...a);
const record = (id, pass, detail, extra = {}) => {
  results.checks[id] = { pass, detail, ...extra };
  log(pass ? "PASS" : "FAIL", id, detail);
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(30000);

await page.route("**/api/v1/clarify/model-status**", async (route) => {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ state: "idle", message: "mocked-clarify" }),
  });
});

const textOr = async (loc, fb = "MISSING") => {
  try {
    if ((await loc.count()) === 0) return fb;
    return (await loc.first().innerText({ timeout: 4000 })).trim();
  } catch {
    return fb;
  }
};

const readDom = async () => {
  const jira = await textOr(page.getByRole("button", { name: /Jira Tickets/i }), "");
  const all = await textOr(page.getByTestId("sit-scope-pill-all"), "");
  const un = await textOr(page.getByTestId("sit-scope-pill-unassigned"), "MISSING");
  const pills = {};
  for (const k of ["DW-6", "DW-7", "DW-9", "DW-11", "DW-12", "DW-14"]) {
    pills[k] = await textOr(page.getByTestId(`sit-scope-pill-${k}`), "MISSING");
  }
  return { jira, all, un, pills };
};

const jiraNM = (t) => {
  const m = String(t).match(/(\d+)\s+of\s+(\d+)/i);
  return m ? { n: Number(m[1]), m: Number(m[2]) } : { n: -1, m: -1 };
};
const num = (t) => {
  const m = String(t).match(/(\d+)\s*$/);
  return m ? Number(m[1]) : -1;
};

async function openSit() {
  await page.addInitScript(() => {
    localStorage.setItem("sit_ui_v2", "1");
    // Do not clear sit_v2_selected_keys here — reload tests must persist selection.
    if (!localStorage.getItem("sit_v2_scope_pill")) {
      localStorage.setItem("sit_v2_scope_pill", "all");
    }
  });
  await page.goto(`${BASE}/app-atlas`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(1500);
  if (/microsoftonline|Welcome Back/i.test(page.url() + (await page.title()))) {
    throw new Error("AUTH_BYPASS failed — still on sign-in");
  }
  await page.getByText(CANVAS, { exact: false }).first().click();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /^SIT Testing$/i }).last().click();
  await page.getByTestId("sit-scope-pill-all").waitFor({ timeout: 90000 });
  await page.waitForTimeout(1200);
}

async function setSelection(keys) {
  await page.getByRole("button", { name: /Jira Tickets/i }).first().click();
  await page.waitForTimeout(400);
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /^Clear$/i }).click().catch(() => undefined);
  await page.waitForTimeout(150);
  for (const k of keys) {
    const byAria = dialog.locator(`input[type="checkbox"][aria-label*="${k}"]`).first();
    if ((await byAria.count()) > 0) {
      await byAria.check({ force: true });
      continue;
    }
    await dialog
      .locator("li")
      .filter({ hasText: new RegExp(`\\b${k}\\b`) })
      .locator('input[type="checkbox"]')
      .last()
      .check({ force: true, timeout: 8000 });
  }
  await dialog.getByRole("button", { name: /^Done$/i }).click();
  await dialog.waitFor({ state: "hidden", timeout: 8000 }).catch(() => undefined);
  await page.waitForTimeout(700);
}

try {
  await openSit();
  record("bypass_lands_app_atlas", true, page.url());

  const base = await readDom();
  await page.screenshot({ path: path.join(OUT, "shots", "postdeploy-01-initial.png"), fullPage: true });
  record(
    "initial_scope",
    num(base.all) >= 100 && base.pills["DW-6"] !== "MISSING" && base.pills["DW-7"] !== "MISSING",
    `all=${base.all} jira=${base.jira} un=${base.un} dw6=${base.pills["DW-6"]} dw7=${base.pills["DW-7"]}`,
  );

  // O1: select DW-6 only — must NOT collapse (M stays full ticket set)
  await setSelection(["DW-6"]);
  const s1 = await readDom();
  await page.screenshot({ path: path.join(OUT, "shots", "postdeploy-02-sel-dw6.png"), fullPage: true });
  const nm1 = jiraNM(s1.jira);
  const noCollapse1 =
    nm1.n === 1 &&
    nm1.m >= 6 &&
    s1.pills["DW-7"] !== "MISSING" &&
    s1.un === "MISSING" &&
    num(s1.all) === num(base.all);
  record(
    "O1_select_dw6_no_collapse",
    noCollapse1,
    `jira=${s1.jira} all=${s1.all} un=${s1.un} dw7=${s1.pills["DW-7"]}`,
  );

  // O2: select three — N=3, M>=6, other pills remain
  await setSelection(["DW-6", "DW-7", "DW-9"]);
  const s3 = await readDom();
  await page.screenshot({ path: path.join(OUT, "shots", "postdeploy-03-sel-3.png"), fullPage: true });
  const nm3 = jiraNM(s3.jira);
  const noCollapse3 = nm3.n === 3 && nm3.m >= 6 && s3.pills["DW-11"] !== "MISSING" && s3.un === "MISSING";
  record(
    "O2_select_three_no_collapse",
    noCollapse3,
    `jira=${s3.jira} all=${s3.all} dw11=${s3.pills["DW-11"]} un=${s3.un}`,
  );

  // O3: all six via localStorage (picker list virtualizes mid keys)
  await page.evaluate((ks) => {
    localStorage.setItem("sit_v2_selected_keys", JSON.stringify(ks));
    localStorage.setItem("sit_v2_scope_pill", "all");
  }, ["DW-6", "DW-7", "DW-9", "DW-11", "DW-12", "DW-14"]);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByText(CANVAS, { exact: false }).first().click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /^SIT Testing$/i }).last().click();
  await page.getByTestId("sit-scope-pill-all").waitFor({ timeout: 90000 });
  await page.waitForTimeout(1000);
  const s6 = await readDom();
  await page.screenshot({ path: path.join(OUT, "shots", "postdeploy-04-sel-6.png"), fullPage: true });
  const nm6 = jiraNM(s6.jira);
  record(
    "O3_select_all_six",
    nm6.n === 6 && nm6.m >= 6 && s6.pills["DW-14"] !== "MISSING",
    `jira=${s6.jira} all=${s6.all} dw14=${s6.pills["DW-14"]}`,
  );

  // Soft canvas switch (no generate) — no foreign DW-6 on other canvas
  const names = await page.evaluate(async () => {
    const r = await fetch("/api/dev-atlas/canvases?limit=50");
    const j = await r.json();
    return (Array.isArray(j) ? j : j.items || []).map((c) => c.name).filter(Boolean);
  });
  const otherName = names.find((n) => n && !new RegExp(CANVAS, "i").test(n));
  if (otherName) {
    await page.getByText(otherName, { exact: false }).first().click();
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: /^SIT Testing$/i }).last().click().catch(() => undefined);
    await page.waitForTimeout(2000);
    for (let i = 0; i < 12; i++) {
      if ((await page.getByTestId("sit-scope-pill-DW-6").count()) === 0) break;
      await page.waitForTimeout(300);
    }
    const otherDw6 = await page.getByTestId("sit-scope-pill-DW-6").count();
    const otherJira = await textOr(page.getByRole("button", { name: /Jira Tickets/i }), "");
    await page.screenshot({ path: path.join(OUT, "shots", "postdeploy-05-other-canvas.png"), fullPage: true });
    record(
      "S11_soft_switch_no_dw6",
      otherDw6 === 0,
      `other=${otherName} dw6count=${otherDw6} jira=${otherJira}`,
    );
    await page.getByText(CANVAS, { exact: false }).first().click();
    await page.waitForTimeout(800);
    await page.getByRole("button", { name: /^SIT Testing$/i }).last().click();
    await page.getByTestId("sit-scope-pill-all").waitFor({ timeout: 60000 });
    const back = await readDom();
    record("S11_switch_back", back.pills["DW-6"] !== "MISSING", `back dw6=${back.pills["DW-6"]} jira=${back.jira}`);
  } else {
    record("S11_soft_switch_no_dw6", false, "no other canvas");
  }

  // Reload with DW-6 selection persisted — still no collapse
  await setSelection(["DW-6"]);
  const beforeReload = await readDom();
  await page.evaluate(() => {
    localStorage.setItem("sit_v2_selected_keys", JSON.stringify(["DW-6"]));
    localStorage.setItem("sit_v2_scope_pill", "all");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByText(CANVAS, { exact: false }).first().click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /^SIT Testing$/i }).last().click();
  await page.getByTestId("sit-scope-pill-all").waitFor({ timeout: 90000 });
  await page.waitForTimeout(1000);
  const afterReload = await readDom();
  const nmR = jiraNM(afterReload.jira);
  record(
    "reload_selection_no_collapse",
    nmR.n === 1 && nmR.m >= 6 && afterReload.pills["DW-7"] !== "MISSING",
    `before=${beforeReload.jira} after=${afterReload.jira} dw7=${afterReload.pills["DW-7"]}`,
  );

  const modelApi = await page.evaluate(async () => {
    const r = await fetch("/api/dev-atlas/sit/model");
    return r.json();
  });
  record("sit_model_idle_ok", modelApi?.state !== "up", JSON.stringify(modelApi).slice(0, 220));
  record("generate_skipped_model_off", true, "Model off — append/generate not re-run");
} catch (err) {
  results.error = err instanceof Error ? err.stack || err.message : String(err);
  log("ERROR", results.error);
  await page.screenshot({ path: path.join(OUT, "shots", "postdeploy-error.png") }).catch(() => undefined);
}

const passed = Object.values(results.checks).filter((c) => c.pass === true).length;
const failed = Object.values(results.checks).filter((c) => c.pass === false).length;
results.summary = { passed, failed };
await fsp.writeFile(path.join(OUT, "gates", "postdeploy-ui-checks.json"), JSON.stringify(results, null, 2));
console.log(
  JSON.stringify(
    {
      summary: results.summary,
      checks: Object.fromEntries(Object.entries(results.checks).map(([k, v]) => [k, { pass: v.pass, detail: v.detail }])),
    },
    null,
    2,
  ),
);
await browser.close();
process.exit(failed || results.error ? 1 : 0);
