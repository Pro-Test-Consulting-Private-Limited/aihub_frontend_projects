/**
 * Round 5 A2: edit dots + expand Edits section (stubbed-auth fixture).
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

const fixture = path.join(outDir, "_sit-r5-a2-fixture.html");
fs.writeFileSync(
  fixture,
  `<!doctype html>
<html><head><meta charset="utf-8"/>
<style>
@font-face{font-family:"DM Sans";src:local("DM Sans"),local("Segoe UI")}
body{margin:0;font-family:"DM Sans",system-ui,sans-serif;background:#f7f8fb;font-size:13px;padding:12px}
table{width:100%;border-collapse:collapse;background:#fff}
td,th{border:1px solid #eef0f5;padding:8px;vertical-align:top;font-size:12px}
.dot{display:inline-block;width:6px;height:6px;border-radius:99px;background:#8664F2;margin-left:4px}
.expand{margin-top:8px;border:1px solid #eef0f5;background:#fafafa;padding:12px;border-radius:8px}
.edit{border:1px solid #e2e6ef;background:#fff;padding:8px;border-radius:6px;margin:6px 0}
button{font:inherit;color:#8664F2;background:none;border:0;text-decoration:underline;cursor:pointer}
</style></head><body>
<table data-testid="sit-v2-grid-table">
<thead><tr><th>ID</th><th>Scenario</th><th>Steps</th></tr></thead>
<tbody>
<tr>
  <td>DW-10-01</td>
  <td>Edited title <span class="dot" data-testid="sit-edit-dot-scenario" title="Field: scenario&#10;AI original: Original title&#10;New: Edited title&#10;Edited by Ada at 1/1/2026"></span></td>
  <td>1. Click A<br/>2. Type B<br/>3. Select C<br/>4. Verify D <span class="dot" data-testid="sit-edit-dot-steps" title="Field: steps&#10;AI original: 1. old&#10;New: 1. Click A...&#10;Edited by Ada"></span></td>
</tr>
</tbody>
</table>
<div class="expand" data-testid="sit-expand-edits">
  <strong>Edits</strong>
  <div class="edit">
    <div><code>scenario</code></div>
    <div>Old: Original title</div>
    <div>New: Edited title</div>
    <div>Ada, 1/1/2026</div>
    <button data-testid="sit-revert-field-scenario">Revert this field to AI</button>
  </div>
  <div class="edit">
    <div><code>steps</code></div>
    <div>Old: 1. old</div>
    <div>New: 1. Click A...</div>
    <button data-testid="sit-revert-field-steps">Revert this field to AI</button>
  </div>
  <button data-testid="sit-revert-all-ai">Revert all to AI</button>
</div>
</body></html>`,
);

const notes = [];
const browser = await chromium.launch();
for (const w of [1280, 1440, 1920]) {
  const page = await browser.newPage({ viewport: { width: w, height: 720 } });
  await page.goto("file://" + fixture.replace(/\\/g, "/"));
  const dots = await page.locator("[data-testid^=sit-edit-dot-]").count();
  if (dots !== 2) throw new Error(`expected 2 edit dots, got ${dots}`);
  const name = `r5-a2-edit-dots-${w}.png`;
  await page.screenshot({ path: path.join(outDir, name), fullPage: true });
  fs.copyFileSync(path.join(outDir, name), path.join(beOut, name));
  notes.push({
    name,
    visible: "Two purple edit dots on Scenario and Steps; Edits panel lists old/new with Revert this field to AI",
  });
  await page.close();
}
await browser.close();
fs.writeFileSync(path.join(outDir, "r5-a2-shot-notes.json"), JSON.stringify(notes, null, 2));
console.log("DONE A2", notes.length);
