/**
 * Round 16 Playwright: stream working set must not shrink.
 * Uses a local timed SSE mock (scripts/sit-r16-stream-mock-server.mjs) via route.continue.
 * Zero real generate/HF: all generate-stream traffic goes to the mock.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startSitR16MockStreamServer } from "./sit-r16-stream-mock-server.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.UI_BASE || "http://localhost:3000";
const OUT =
  process.env.OUT ||
  path.resolve(__dirname, "../../appatlas-backend-github-sync/docs/sit-quality/out/r16");
const CANVAS = process.env.SIT_R16_CANVAS_LABEL || "SIT R16 Stream Scope Canvas";

await fsp.mkdir(path.join(OUT, "shots"), { recursive: true });
await fsp.mkdir(path.join(OUT, "gates"), { recursive: true });

const rows = [];
const record = (id, pass, detail = "") => {
  rows.push({ id, status: pass ? "PASS" : "FAIL", detail });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${id} ${detail}`);
};

let realGenerateHits = 0;
const invariantLogs = [];

const mock = await startSitR16MockStreamServer({
  delayMs: Number(process.env.SIT_R16_STREAM_DELAY_MS || 100),
  caseCount: 2,
  mode: "new",
  // Parent-like foreign rows to prove FE filters them out if workbook event carries them
  parentRows: [
    {
      id: "foreign-dw7",
      cells: {
        caseId: "DW-7-foreign",
        requirementId: "DW-7",
        issueKey: "DW-7",
        deleted: "0",
        origin: "ai",
        scenario: "foreign seed",
        steps: "1. a\n2. b\n3. c\n4. d",
        expected: "- ok result here yes",
        executionStatus: "Not run",
      },
    },
  ],
});

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("console", (msg) => {
  const t = msg.text();
  if (/invariant I-[a-z]/i.test(t) || /\[sit-(working|scope)\]/i.test(t)) invariantLogs.push(t);
});

await page.route("**/api/v1/clarify/model-status**", async (route) => {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ state: "ready", message: "mocked ready" }),
  });
});
await page.route("**/sit/model-status**", async (route) => {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ state: "ready", endpointConfigured: true, paused: false }),
  });
});

const isGenerateStream = (url) => /sit\/generate-stream/i.test(url);

await page.route("**/*", async (route) => {
  const req = route.request();
  const url = req.url();
  if (isGenerateStream(url)) {
    // If someone bypasses our continue, count as real only when not mock host
    if (!url.includes(`127.0.0.1:${mock.port}`) && !url.includes(`localhost:${mock.port}`)) {
      // redirect to mock
      const mockUrl = `http://127.0.0.1:${mock.port}/sit/generate-stream`;
      await route.continue({ url: mockUrl });
      return;
    }
  }
  if (/sit\/generate(?!-stream)/i.test(url) || /huggingface|hf\.co|api-inference/i.test(url)) {
    realGenerateHits++;
    await route.abort();
    return;
  }
  await route.continue();
});

const pillCount = async (testId) => {
  const loc = page.getByTestId(testId);
  if ((await loc.count()) === 0) return null;
  const t = await loc.innerText();
  const m = t.trim().match(/(\d+)\s*$/);
  return Number(m?.[1] || 0);
};

const readScope = async () => {
  const allN = await pillCount("sit-scope-pill-all");
  const by = {
    "DW-6": await pillCount("sit-scope-pill-DW-6"),
    "DW-7": await pillCount("sit-scope-pill-DW-7"),
    "DW-9": await pillCount("sit-scope-pill-DW-9"),
  };
  const jira = await page.getByTestId("sit-jira-tickets-btn").innerText().catch(() => "");
  return { allN, by, jira };
};

async function openSit() {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("sit_ui_v2", "1");
      localStorage.setItem("sit_v2_selected_keys", JSON.stringify(["DW-6", "DW-7", "DW-9"]));
      localStorage.setItem("sit_v2_scope_pill", "all");
    } catch {
      /* ignore */
    }
  });
  await page.goto(`${BASE}/app-atlas`, { waitUntil: "domcontentloaded", timeout: 60000 });
  if (/microsoftonline|signin/i.test(page.url())) throw new Error("AUTH_BYPASS failed");
  // Pick canvas
  const canvasBtn = page.getByRole("button", { name: new RegExp(CANVAS, "i") }).first();
  if ((await canvasBtn.count()) > 0) {
    await canvasBtn.click();
  } else {
    // fallback: open canvases list / search
    await page.getByPlaceholder(/search/i).fill("R16").catch(() => undefined);
  }
  await page.getByTestId("sit-generate-btn").waitFor({ timeout: 60000 });
}

try {
  await openSit();
  const before = await readScope();
  record(
    "r16.seed_loaded",
    before.allN === 19 && before.by["DW-7"] === 11 && before.by["DW-9"] === 8,
    JSON.stringify(before),
  );

  // Select only DW-6 for generation while keeping working set
  await page.getByTestId("sit-jira-tickets-btn").click();
  // Ensure DW-6 selected - picker checkboxes
  await page.getByText("DW-6", { exact: false }).first().click().catch(() => undefined);
  await page.keyboard.press("Escape").catch(() => undefined);

  // Activate DW-6 pill
  const dw6pill = page.getByTestId("sit-scope-pill-DW-6");
  if ((await dw6pill.count()) > 0) await dw6pill.click();

  const s1 = await readScope();
  record(
    "r16.S1_before_stream",
    (s1.by["DW-7"] === 11 || s1.by["DW-7"] === null) && s1.allN >= 19,
    JSON.stringify(s1),
  );

  // Snapshot mid-stream via polling while Generating…
  const midSnapshots = [];
  const genBtn = page.getByTestId("sit-generate-btn");
  await genBtn.click();

  const started = Date.now();
  while (Date.now() - started < 15000) {
    const snap = await readScope();
    midSnapshots.push(snap);
    const generating = /Generating/i.test(await genBtn.innerText().catch(() => ""));
    if (!generating && midSnapshots.length > 2) break;
    await page.waitForTimeout(120);
  }

  const midOk = midSnapshots.every(
    (s) =>
      (s.by["DW-7"] === 11 || s.by["DW-7"] == null) &&
      (s.by["DW-9"] === 8 || s.by["DW-9"] == null) &&
      !/1 of 1/i.test(s.jira || ""),
  );
  record("r16.mid_stream_keys_stable", midOk, `snaps=${midSnapshots.length} last=${JSON.stringify(midSnapshots.at(-1))}`);

  // Wait for realign
  await page.waitForTimeout(1500);
  const after = await readScope();
  record(
    "r16.after_done_superset",
    after.allN >= 19 && (after.by["DW-7"] === 11 || after.by["DW-7"] == null),
    JSON.stringify(after),
  );

  await page.screenshot({ path: path.join(OUT, "shots", "r16-after-stream-1440.png") });

  // Cancel path: start again and cancel
  await genBtn.click();
  await page.waitForTimeout(200);
  const cancel = page.getByRole("button", { name: /Cancel/i });
  if ((await cancel.count()) > 0) {
    await cancel.click();
    await page.waitForTimeout(1500);
    const afterCancel = await readScope();
    record(
      "r16.after_cancel_realign",
      afterCancel.allN >= 19 && !/1 of 1/i.test(afterCancel.jira || ""),
      JSON.stringify(afterCancel),
    );
  } else {
    record("r16.after_cancel_realign", false, "Cancel button not found");
  }

  record("r16.zero_real_generate", realGenerateHits === 0, `hits=${realGenerateHits}`);
  record("r16.no_invariant_logs", invariantLogs.length === 0, invariantLogs.slice(0, 3).join(" | "));
} catch (err) {
  record("r16.harness", false, err instanceof Error ? err.message : String(err));
} finally {
  await browser.close();
  mock.server.close();
}

const passed = rows.filter((r) => r.status === "PASS").length;
const failed = rows.filter((r) => r.status === "FAIL").length;
const summary = { passed, failed, realGenerateHits, invariantLogs, mockPort: mock.port, rows };
await fsp.writeFile(path.join(OUT, "gates", "r16-verify.json"), JSON.stringify(summary, null, 2));
await fsp.writeFile(
  path.join(OUT, "gates", "r16-verify.txt"),
  rows.map((r) => `${r.status}\t${r.id}\t${r.detail}`).join("\n") + `\nPASS=${passed} FAIL=${failed}\n`,
);
console.log(JSON.stringify({ passed, failed, realGenerateHits }));
process.exit(failed ? 1 : 0);
