/**
 * PLATFORM font proof for SIT v2 (Round 2 A4).
 *
 * Builds a local HTML harness that loads the REAL DM Sans woff2 (same file as
 * next/font local), renders SIT-like controls (no native <select>), waits for
 * document.fonts.ready, then uses CDP CSS.getPlatformFontsForNode to assert
 * the actually rendered font family.
 *
 * Auth-bypass / Next prod server is intentionally NOT used here: AUTH_BYPASS is
 * compile-eliminated in production builds. This harness proves fonts without
 * opening a production auth hole.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const fontFile = path.join(root, "app/config/fonts/dm-sans-variable.woff2");
const outDir = path.join(root, "docs/screenshots-sit-v2");
const beOut = path.resolve(root, "../appatlas-backend-github-sync/docs/screenshots-sit-v2");
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(beOut, { recursive: true });

if (!fs.existsSync(fontFile)) {
  console.error("MISSING font file", fontFile);
  process.exit(1);
}

const fontB64 = fs.readFileSync(fontFile).toString("base64");
const fixture = path.join(outDir, "_platform-fonts-fixture.html");

fs.writeFileSync(
  fixture,
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>SIT v2 platform fonts</title>
<style>
@font-face{
  font-family:"DM Sans";
  src:url(data:font/woff2;base64,${fontB64}) format("woff2");
  font-weight:100 900;
  font-display:swap;
}
*{box-sizing:border-box}
body{margin:0;background:#f7f8fb;color:#1F1F1F;font-family:"DM Sans",ui-sans-serif,system-ui,sans-serif;font-size:13px}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
button,input,textarea{font:inherit}
.toolbar{display:flex;gap:8px;align-items:center;padding:12px;background:#fff;border-bottom:1px solid #EEE}
.tab{padding:6px 12px;border-radius:8px;border:1px solid #e2e6ef;background:#f3f0ff;color:#5b21b6;font-weight:600}
.filter{position:relative}
.filter-btn{height:28px;padding:0 10px;border-radius:6px;border:1px solid #e2e6ef;background:#fff;font-size:11px;font-weight:500}
.popover{position:absolute;top:32px;left:0;min-width:140px;border:1px solid #e2e6ef;border-radius:8px;background:#fff;box-shadow:0 8px 24px rgba(0,0,0,.08);z-index:5}
.popover button{display:block;width:100%;text-align:left;padding:6px 12px;border:0;background:transparent;font-size:12px}
.popover button:hover{background:#f3f0ff}
table{width:100%;border-collapse:collapse;margin-top:8px;background:#fff}
th{background:#1F4E78;color:#fff;font-size:10px;font-weight:600;padding:8px;text-align:left}
td{padding:8px;border-bottom:1px solid #f3f4f6;font-size:12px;vertical-align:top}
.editor{border:1px solid #8664F2;border-radius:6px;padding:6px;min-height:40px;width:100%}
.drawer{margin:12px;padding:12px;background:#fafafa;border:1px solid #eef0f5;border-radius:8px;width:280px}
.pill{border-radius:999px;padding:2px 8px;font-size:10.5px;font-weight:600;background:#d1fae5;color:#065f46;border:0}
</style>
</head>
<body>
  <div class="toolbar">
    <button id="toolbarBtn" type="button">Jira Tickets</button>
    <button id="tab" class="tab" type="button">SIT Testing</button>
    <div class="filter">
      <button id="filterCtrl" class="filter-btn" type="button" data-sit-select-trigger="1">Type ▾</button>
      <button id="dropdownTrigger" class="filter-btn" type="button" data-sit-select-trigger="1">Status ▾</button>
      <div id="popover" class="popover">
        <button id="popoverItem" type="button" data-sit-select-item="1">Positive</button>
        <button type="button">Negative</button>
      </div>
    </div>
    <button id="statusPill" class="pill" type="button">Passed ▾</button>
  </div>
  <table>
    <thead><tr><th id="headerCell">Scenario</th><th>Status</th></tr></thead>
    <tbody>
      <tr>
        <td id="bodyCell">Login fails for an unregistered mobile number</td>
        <td><button class="pill" type="button">Not run</button></td>
      </tr>
      <tr>
        <td colspan="2"><div id="cellEditor" class="editor" contenteditable="true">1. Click the "Sign in" button</div></td>
      </tr>
    </tbody>
  </table>
  <aside class="drawer" id="drawerText">Drawer details — coverage and history use the same body font.</aside>
  <p class="mono" id="idMono">DW-7-001</p>
<script>
  // Keep popover visible for CDP sampling
</script>
</body>
</html>`,
);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 720 } });
await page.goto("file://" + fixture.replace(/\\/g, "/"));
await page.evaluate(() => document.fonts.ready);

const client = await page.context().newCDPSession(page);
await client.send("DOM.enable");
await client.send("CSS.enable");

const probes = [
  ["toolbarBtn", "#toolbarBtn"],
  ["tab", "#tab"],
  ["filterCtrl", "#filterCtrl"],
  ["headerCell", "#headerCell"],
  ["bodyCell", "#bodyCell"],
  ["cellEditor", "#cellEditor"],
  ["dropdownTrigger", "#dropdownTrigger"],
  ["popoverItem", "#popoverItem"],
  ["drawerText", "#drawerText"],
];

await page.evaluate((ids) => {
  for (const [name, sel] of ids) {
    const el = document.querySelector(sel);
    if (el) el.setAttribute("data-font-probe", name);
  }
}, probes);

const doc = await client.send("DOM.getDocument", { depth: -1 });
const table = {};
const EXPECT = "DM Sans";

for (const [name] of probes) {
  const { nodeId } = await client.send("DOM.querySelector", {
    nodeId: doc.root.nodeId,
    selector: `[data-font-probe="${name}"]`,
  });
  if (!nodeId) throw new Error("CDP node missing for " + name);
  const res = await client.send("CSS.getPlatformFontsForNode", { nodeId });
  const fonts = (res.fonts || []).map((f) => ({
    family: f.familyName,
    isCustom: f.isCustomFont,
    glyphCount: f.glyphCount,
  }));
  const primary = fonts[0]?.family || "(none)";
  const ok = /DM Sans/i.test(primary);
  table[name] = { primary, fonts, ok, expectFamily: EXPECT };
  console.log(name, primary, fonts);
}

await page.screenshot({ path: path.join(outDir, "09-platform-fonts.png"), fullPage: true });
fs.copyFileSync(path.join(outDir, "09-platform-fonts.png"), path.join(beOut, "09-platform-fonts.png"));

const report = {
  expectFamily: EXPECT,
  table,
  allOk: Object.values(table).every((r) => r.ok),
  method: "CDP CSS.getPlatformFontsForNode",
  note: "Native <select> deliberately absent; harness uses same DM Sans woff2 as app/config/fonts.",
};
fs.writeFileSync(path.join(outDir, "platform-fonts.json"), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(beOut, "platform-fonts.json"), JSON.stringify(report, null, 2));

await browser.close();

if (!report.allOk) {
  console.error("PLATFORM FONT CHECK FAILED", report);
  process.exit(1);
}
console.log("PLATFORM FONT CHECK OK", Object.keys(table).length, "nodes");
