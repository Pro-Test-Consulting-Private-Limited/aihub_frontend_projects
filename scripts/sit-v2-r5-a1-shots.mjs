/**
 * Round 5 A1: stubbed-auth selection highlight screenshots (test mode only).
 * Asserts exactly one data-selected=1 after click B; Escape → zero; outside → zero.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "../docs/screenshots-sit-v2");
const beOut = path.resolve(__dirname, "../../appatlas-backend-github-sync/docs/screenshots-sit-v2");
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(beOut, { recursive: true });

const fixture = path.join(outDir, "_sit-r5-a1-fixture.html");
fs.writeFileSync(
  fixture,
  `<!doctype html>
<html><head><meta charset="utf-8"/>
<style>
@font-face{font-family:"DM Sans";src:local("DM Sans"),local("Segoe UI")}
body{margin:0;font-family:"DM Sans",system-ui,sans-serif;background:#f7f8fb;font-size:13px}
#outside{padding:12px;background:#fff;border-bottom:1px solid #eee}
table{width:100%;border-collapse:collapse;background:#fff}
td{padding:8px;border:1px solid #eef0f5;cursor:default}
td[data-selected="1"]{background:rgba(243,240,255,.5);box-shadow:inset 0 0 0 1px rgba(134,100,242,.5)}
td[data-editing="1"]{background:rgba(243,240,255,.6);box-shadow:inset 0 0 0 2px #8664F2}
</style></head><body>
<div id="outside">Outside the grid</div>
<div id="grid" data-testid="sit-v2-grid-root">
<table>
<tr>
  <td data-sit-cell="r1:scenario" data-selected="0" data-editing="0" tabindex="0">Cell A scenario</td>
  <td data-sit-cell="r1:steps" data-selected="0" data-editing="0" tabindex="0">Cell B steps</td>
</tr>
</table>
</div>
<script>
let selected = null;
const cells = [...document.querySelectorAll("[data-sit-cell]")];
function paint() {
  for (const c of cells) {
    const id = c.getAttribute("data-sit-cell");
    c.setAttribute("data-selected", selected === id ? "1" : "0");
    c.setAttribute("data-editing", "0");
  }
}
function clear() { selected = null; paint(); }
for (const c of cells) {
  c.addEventListener("click", (e) => { e.stopPropagation(); selected = c.getAttribute("data-sit-cell"); paint(); });
}
document.getElementById("grid").addEventListener("keydown", (e) => {
  if (e.key === "Escape") clear();
});
document.addEventListener("mousedown", (e) => {
  if (!document.getElementById("grid").contains(e.target)) clear();
});
</script>
</body></html>`,
);

const browser = await chromium.launch();
const results = [];
for (const w of [1280, 1440, 1920]) {
  const page = await browser.newPage({ viewport: { width: w, height: 720 } });
  await page.goto("file://" + fixture.replace(/\\/g, "/"));
  await page.click('[data-sit-cell="r1:scenario"]');
  await page.click('[data-sit-cell="r1:steps"]');
  const nSel = await page.locator('[data-selected="1"]').count();
  if (nSel !== 1) throw new Error(`expected 1 selected after click B, got ${nSel}`);
  const name = `r5-a1-one-selected-${w}.png`;
  const buf = await page.screenshot({ path: path.join(outDir, name), fullPage: true });
  fs.writeFileSync(path.join(beOut, name), buf);
  results.push({ name, visible: "Cell B steps has thin purple selection; Cell A not selected" });

  await page.keyboard.press("Escape");
  const nEsc = await page.locator('[data-selected="1"]').count();
  if (nEsc !== 0) throw new Error(`expected 0 after Escape, got ${nEsc}`);
  const nameEsc = `r5-a1-escape-cleared-${w}.png`;
  const bufEsc = await page.screenshot({ path: path.join(outDir, nameEsc), fullPage: true });
  fs.writeFileSync(path.join(beOut, nameEsc), bufEsc);
  results.push({ name: nameEsc, visible: "No cell selected after Escape" });

  await page.click('[data-sit-cell="r1:scenario"]');
  await page.click("#outside");
  const nOut = await page.locator('[data-selected="1"]').count();
  if (nOut !== 0) throw new Error(`expected 0 after outside click, got ${nOut}`);
  const nameOut = `r5-a1-outside-cleared-${w}.png`;
  const bufOut = await page.screenshot({ path: path.join(outDir, nameOut), fullPage: true });
  fs.writeFileSync(path.join(beOut, nameOut), bufOut);
  results.push({ name: nameOut, visible: "No cell selected after click outside grid" });
  await page.close();
}
await browser.close();
fs.writeFileSync(path.join(outDir, "r5-a1-shot-notes.json"), JSON.stringify(results, null, 2));
console.log("DONE A1", results.length, "shots");
