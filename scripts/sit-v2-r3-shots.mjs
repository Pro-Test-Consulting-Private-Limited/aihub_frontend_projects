/**
 * Round 3 stubbed-auth screenshots (self-contained HTML; no tokens).
 * Viewports: 1280, 1440, 1920. OUT → docs/screenshots-sit-v2
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

const fixture = path.join(outDir, "_sit-r3-fixture.html");
fs.writeFileSync(
  fixture,
  `<!doctype html>
<html><head><meta charset="utf-8"/>
<style>
@font-face{font-family:"DM Sans";src:local("DM Sans"),local("Segoe UI");font-weight:100 900}
body{margin:0;font-family:"DM Sans",system-ui,sans-serif;background:#f7f8fb;color:#1F1F1F;font-size:13px}
button,input{font:inherit}
.bar{display:flex;flex-wrap:wrap;gap:6px;padding:10px;background:#fff;border-bottom:1px solid #EEE;align-items:center}
.chip{border-radius:999px;padding:2px 10px;font-size:11px;font-weight:600;border:1px solid #e2e6ef;background:#fff}
.ai{background:#f5f3ff;border-color:#ddd6fe;color:#5b21b6}
.human{background:#eff6ff;border-color:#bfdbfe;color:#1d4ed8}
.edited{background:#fffbeb;border-color:#fde68a;color:#92400e}
.gen{background:#8664F2;color:#fff;border:0;border-radius:8px;padding:6px 12px;font-weight:600}
table{width:100%;table-layout:fixed;border-collapse:collapse;background:#fff;font-size:12px}
th{background:#1F4E78;color:#fff;font-size:10px;text-align:left;padding:8px;position:relative}
td{padding:8px;border-bottom:1px solid #f3f4f6;vertical-align:top}
.mono{font-family:ui-monospace,Menlo,monospace;font-size:11px;white-space:nowrap}
.prio{display:inline-block;border-radius:999px;padding:2px 8px;font-size:10px;font-weight:600;background:#fee2e2;color:#991b1b}
.sev{display:inline-block;border-radius:999px;padding:2px 8px;font-size:10px;font-weight:600;background:#fef3c7;color:#92400e;margin-top:4px}
.type{border-radius:4px;padding:2px 6px;font-size:10px;font-weight:600;background:#FCE4E4;color:#9b1c1c}
.expand{background:#fafafa;border-top:1px solid #eef0f5;padding:10px}
.tabon{background:#8664F2;color:#fff;border:0;border-radius:6px;padding:2px 8px}
.tab{border:1px solid #e2e6ef;background:#fff;border-radius:6px;padding:2px 8px}
.prog{height:8px;width:112px;background:#e5e7eb;border-radius:999px;overflow:hidden;display:inline-block;vertical-align:middle}
.prog>i{display:block;height:100%;width:20%;background:#059669}
.resize{position:absolute;right:0;top:0;width:6px;height:100%;cursor:col-resize;background:rgba(255,255,255,.25)}
.more{color:#8664F2;font-size:10px;font-weight:500}
.toast{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:#fff;border:1px solid #e2e6ef;border-radius:10px;padding:8px 16px;box-shadow:0 8px 24px rgba(0,0,0,.12)}
.statusdd{position:absolute;z-index:5;background:#fff;border:1px solid #e2e6ef;border-radius:8px;padding:4px 0;min-width:140px;box-shadow:0 8px 24px rgba(0,0,0,.08)}
.statusdd div{padding:6px 12px;font-size:11px}
.statusdd .sel{background:#f3f0ff;font-weight:600}
.menu{position:absolute;background:#fff;border:1px solid #e2e6ef;border-radius:8px;padding:4px 0;width:140px;box-shadow:0 8px 24px rgba(0,0,0,.08);font-size:11px}
.menu button{display:block;width:100%;text-align:left;padding:6px 12px;border:0;background:transparent}
</style></head><body>
<div class="bar">
  <strong>SIT Testing</strong>
  <button class="gen" id="generateBtn" title="Model ready">Generate for 1 ticket(s)</button>
  <span class="chip" id="counts">All 15</span>
  <span class="chip ai">AI 13</span>
  <span class="chip human">Human 2</span>
  <span class="chip edited">Edited 1</span>
  <span id="statusBar">0 of 15 run</span>
  <span class="prog"><i></i></span>
  <span class="chip">Not run 13</span>
  <span class="chip">Draft 2</span>
  <button id="addBtn">+ Add test case</button>
  <button id="columnsBtn">Columns</button>
</div>
<table id="grid">
<thead><tr>
  <th style="width:32px"><input type="checkbox" aria-label="Select all"/></th>
  <th style="width:120px">ID<span class="resize"></span></th>
  <th>Priority / Severity<span class="resize"></span></th>
  <th>Scenario<span class="resize"></span></th>
  <th>Preconditions<span class="resize"></span></th>
  <th>Test Steps<span class="resize"></span></th>
  <th>Expected Result<span class="resize"></span></th>
  <th>Status</th>
</tr></thead>
<tbody>
<tr id="row1">
  <td><input type="checkbox"/></td>
  <td class="mono" id="idCell">
    <button id="chevron" aria-expanded="false">▸</button> ✨ DW-10-01
    <button id="rowMenuBtn" style="opacity:.5">⋮</button>
  </td>
  <td><div class="prio">Priority High</div><div class="sev">Severity Med</div></td>
  <td><span class="type">Negative</span> Login fails for unregistered mobile
    <div id="typeEditor" style="display:none;margin-top:4px">
      <select><option>Negative</option><option>Positive</option></select>
      <input value="Login fails for unregistered mobile"/>
    </div>
  </td>
  <td><span class="chip ai">DW-10</span>
    <div>- Login page (/login) open<br/>- User not signed in<br/>- {{unregisteredMobile}} has no account</div>
  </td>
  <td id="stepsCell">
    <div>1. Open /login. Login page shows Mobile number field.<br/>2. Click Mobile number; type {{unregisteredMobile}}.<br/>3. Click Password; type {{validPassword}}.<br/>4. Click Sign in.<br/>5. Observe stay on /login.<br/>6. Confirm no session.</div>
    <button class="more" id="showMore">Show more</button>
  </td>
  <td>- Stay on /login<br/>- Error near form<br/>- No session</td>
  <td style="position:relative">
    <button id="statusTrig" class="chip">Not run ▾</button>
    <div class="statusdd" id="statusList" style="display:none">
      <div style="font-size:9px;color:#9ca3af;padding:4px 12px">Authoring</div>
      <div>Draft</div>
      <div style="font-size:9px;color:#9ca3af;padding:4px 12px">Results</div>
      <div class="sel">Not run</div>
      <div>Passed</div>
      <div>Failed</div>
      <div>Partial</div>
      <div>Blocked</div>
      <div>Skipped</div>
    </div>
  </td>
</tr>
<tr id="expandRow" style="display:none">
  <td colspan="8">
    <div class="expand" id="expandPanel">
      <button class="tabon">Details</button>
      <button class="tab">Test data</button>
      <button class="tab">Coverage</button>
      <button class="tab">History</button>
      <p style="margin-top:8px">Show original AI version · Revert to AI version</p>
    </div>
  </td>
</tr>
<tr>
  <td></td>
  <td class="mono">👤 DW-10-14</td>
  <td><div class="prio" style="background:#dcfce7;color:#166534">P Low</div><div class="sev">S Med</div></td>
  <td>Human-written blank check</td>
  <td><span class="chip ai">DW-10</span></td>
  <td></td>
  <td></td>
  <td><span class="chip" style="background:#e0e7ff;color:#3730a3">Draft</span></td>
</tr>
</tbody>
</table>
<div class="menu" id="ctxMenu" style="display:none;top:120px;left:80px">
  <button>Duplicate</button><button>Insert below</button><button style="color:#b91c1c">Delete</button>
</div>
<div class="toast" id="undoToast" style="display:none">Row deleted. <button style="color:#8664F2;font-weight:600;border:0;background:transparent">Undo</button></div>
<script>
document.getElementById('chevron').onclick=()=>{
  const ex=document.getElementById('expandRow');
  const open=ex.style.display==='none';
  ex.style.display=open?'table-row':'none';
  document.getElementById('chevron').textContent=open?'▾':'▸';
  document.getElementById('chevron').setAttribute('aria-expanded', open?'true':'false');
};
document.getElementById('statusTrig').onclick=()=>{
  const l=document.getElementById('statusList');
  l.style.display=l.style.display==='none'?'block':'none';
};
document.getElementById('rowMenuBtn').onclick=()=>{
  document.getElementById('ctxMenu').style.display='block';
};
document.getElementById('idCell').ondblclick=()=>document.getElementById('chevron').click();
</script>
</body></html>`,
);

const browser = await chromium.launch();
const viewports = [1280, 1440, 1920];

for (const w of viewports) {
  const page = await browser.newPage({ viewport: { width: w, height: 900 } });
  await page.goto("file://" + fixture.replace(/\\/g, "/"));
  const shot = async (name) => {
    const file = `r3-${name}-${w}.png`;
    const buf = await page.screenshot({ fullPage: false });
    fs.writeFileSync(path.join(outDir, file), buf);
    fs.writeFileSync(path.join(beOut, file), buf);
    console.log("wrote", file);
  };
  await shot("no-template-fullwidth");
  await page.click("#chevron");
  await shot("chevron-expand");
  await page.click("#statusTrig");
  await shot("status-dropdown");
  await page.click("#rowMenuBtn");
  await shot("row-menu");
  await page.evaluate(() => {
    document.getElementById("undoToast").style.display = "block";
    document.getElementById("typeEditor").style.display = "block";
  });
  await shot("type-editor-undo");
  await page.close();
}

await browser.close();
console.log("DONE", outDir);
