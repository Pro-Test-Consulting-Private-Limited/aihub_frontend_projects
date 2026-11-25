/**
 * Round 5 A3: Quality drawer screenshot (stubbed-auth).
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

const fixture = path.join(outDir, "_sit-r5-a3-fixture.html");
fs.writeFileSync(
  fixture,
  `<!doctype html>
<html><head><meta charset="utf-8"/>
<style>
body{margin:0;font-family:system-ui,sans-serif;background:#f7f8fb}
.bar{display:flex;gap:8px;padding:12px;background:#fff;border-bottom:1px solid #eee}
.btn{border:1px solid #fcd34d;background:#fffbeb;color:#92400e;border-radius:8px;padding:6px 12px;font-size:12.5px}
.chip{border:1px solid #e2e6ef;border-radius:8px;padding:6px 10px;font-size:12.5px;color:#5b647a}
.drawer{position:fixed;right:12px;top:56px;width:420px;height:480px;background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;display:flex;flex-direction:column;box-shadow:0 12px 40px rgba(0,0,0,.12)}
.head{padding:10px 12px;border-bottom:1px solid #fde68a;font-size:12px;font-weight:700;text-transform:uppercase;color:#92400e}
.body{flex:1;overflow:auto;padding:10px 12px;font-size:12px}
.g{margin-bottom:12px}
.g h4{margin:0 0 6px;color:#92400e}
.item{display:block;width:100%;text-align:left;border:1px solid #fde68a;background:#fff;border-radius:8px;padding:8px;margin:4px 0;color:#78350f}
code{font-weight:700}
</style></head><body>
<div class="bar">
  <span class="chip" data-testid="sit-needs-review-chip" title="Priority and Severity not reviewed yet">Needs review 3</span>
  <button class="btn" data-testid="sit-quality-btn" title="Counts duplicates, empty expected results, unlinked ACs, thin cases, contradictions">Quality: 4 flagged</button>
</div>
<div class="drawer" data-testid="sit-quality-drawer">
  <div class="head">Quality findings</div>
  <div class="body" data-testid="sit-quality-case-list">
    <div class="g"><h4>Duplicate · 1</h4>
      <button class="item"><code>DW-11-08</code> · Same flow again<div>DW-11-08 is 92% similar to DW-11-03 (same steps and expected result).</div></button>
    </div>
    <div class="g"><h4>Empty expected result · 1</h4>
      <button class="item"><code>DW-11-empty</code> · Empty expected<div>DW-11-empty has no expected result (or it is too short to assert anything).</div></button>
    </div>
    <div class="g"><h4>No linked acceptance criterion · 1</h4>
      <button class="item"><code>DW-11-unlinked</code> · No AC<div>DW-11-unlinked does not cover any acceptance criterion.</div></button>
    </div>
    <div class="g"><h4>Thin (fewer than 4 steps) · 1</h4>
      <button class="item"><code>DW-11-thin</code> · Thin case<div>DW-11-thin has only 2 steps. Needs at least 4.</div></button>
    </div>
  </div>
</div>
</body></html>`,
);

const notes = [];
const browser = await chromium.launch();
for (const w of [1280, 1440, 1920]) {
  const page = await browser.newPage({ viewport: { width: w, height: 800 } });
  await page.goto("file://" + fixture.replace(/\\/g, "/"));
  const name = `r5-a3-quality-drawer-${w}.png`;
  await page.screenshot({ path: path.join(outDir, name), fullPage: true });
  fs.copyFileSync(path.join(outDir, name), path.join(beOut, name));
  notes.push({
    name,
    visible:
      "Needs review 3 chip separate; Quality: 4 flagged; drawer lists Duplicate, Empty expected, No linked AC, Thin with case ids and plain reasons",
  });
  await page.close();
}
await browser.close();
fs.writeFileSync(path.join(outDir, "r5-a3-shot-notes.json"), JSON.stringify(notes, null, 2));
console.log("DONE A3", notes.length);
