/**
 * Screenshot real CanvasPosture React components against live atlas-api fixtures.
 * Production method: next dev + Playwright at 1280x720, light and dark.
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "docs/evidence/posture-redesign-2026-11-25");
const port = 3457;
const base = `http://127.0.0.1:${port}`;

fs.mkdirSync(outDir, { recursive: true });

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer() {
  for (let i = 0; i < 90; i++) {
    try {
      const res = await fetch(`${base}/dev/posture-preview`);
      if (res.ok || res.status === 200) return;
    } catch {
      /* retry */
    }
    await wait(1000);
  }
  throw new Error("Preview server did not become ready");
}

const env = {
  ...process.env,
  PORT: String(port),
  NEXT_PUBLIC_POSTURE_PREVIEW: "1",
};

const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["next", "dev", "-p", String(port), "-H", "127.0.0.1"],
  { cwd: root, env, stdio: ["ignore", "pipe", "pipe"], shell: true },
);
child.stdout.on("data", (d) => process.stdout.write(d));
child.stderr.on("data", (d) => process.stderr.write(d));

const shots = [];
try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  const capture = async (name, url, prepare) => {
    await page.goto(url, { waitUntil: "networkidle", timeout: 120000 });
    if (prepare) await prepare(page);
    await wait(500);
    const file = path.join(outDir, name);
    await page.screenshot({ path: file, fullPage: false });
    shots.push({
      file: name,
      url,
      method:
        "Playwright chromium 1280x720 against /dev/posture-preview mounting real CanvasPosture with fixtures from live atlas-api (wallet z-47xXi7aWIK). No shared-backend auth bypass.",
      at: new Date().toISOString(),
    });
    console.log("SHOT", name);
  };

  for (const theme of ["light", "dark"]) {
    const q = `theme=${theme}`;
    await capture(`checklist-${theme}.png`, `${base}/dev/posture-preview?${q}&tab=checklist`, async (p) => {
      // URL tab may need client navigation via buttons
      await p.getByTestId("tab-checklist").click().catch(() => undefined);
    });
    await capture(`checklist-filter-fail-${theme}.png`, `${base}/dev/posture-preview?${q}&tab=checklist&status=fail`);
    await capture(`failures-${theme}.png`, `${base}/dev/posture-preview?${q}&tab=failures`, async (p) => {
      await p.getByTestId("tab-failures").click();
    });
    await capture(`screens-${theme}.png`, `${base}/dev/posture-preview?${q}&tab=screens`, async (p) => {
      await p.getByTestId("tab-screens").click();
    });
    await capture(`runs-${theme}.png`, `${base}/dev/posture-preview?${q}&tab=runs`, async (p) => {
      await p.getByTestId("tab-runs").click();
    });
    await capture(`runs-pass2-detail-${theme}.png`, `${base}/dev/posture-preview?${q}&tab=runs`, async (p) => {
      await p.getByTestId("tab-runs").click();
      await p.getByTestId("pass-card-pass2_light_probes").getByText("View run").first().click();
      await wait(800);
    });
    await capture(`runs-discovery-detail-${theme}.png`, `${base}/dev/posture-preview?${q}&tab=runs`, async (p) => {
      await p.getByTestId("tab-runs").click();
      await p.getByTestId("pass-card-inventory").getByText("View run").first().click();
      await wait(800);
    });
    await capture(`evidence-${theme}.png`, `${base}/dev/posture-preview?${q}&tab=evidence`, async (p) => {
      await p.getByTestId("tab-evidence").click();
    });
    await capture(`drawer-fail-${theme}.png`, `${base}/dev/posture-preview?${q}&tab=failures`, async (p) => {
      await p.getByTestId("tab-failures").click();
      await p.getByTestId("posture-failures").locator("tr").nth(1).click();
      await wait(500);
    });
    await capture(`drawer-partial-${theme}.png`, `${base}/dev/posture-preview?${q}&tab=checklist&status=partial`, async (p) => {
      await p.getByTestId("posture-checklist").locator("tbody tr").first().click();
      await wait(500);
    });
    await capture(`summary-strip-${theme}.png`, `${base}/dev/posture-preview?${q}&tab=checklist`);
    await capture(`export-vs-checklist-${theme}.png`, `${base}/dev/posture-preview?${q}&compare=1`);
  }

  fs.writeFileSync(path.join(outDir, "SHOT_MANIFEST.json"), JSON.stringify(shots, null, 2));
  await browser.close();
} finally {
  child.kill("SIGTERM");
}

console.log("DONE shots in", outDir);
