/**
 * Headless Playwright shots for GitHub polish (pill, panel states, full modal categories).
 * Uses a self-contained fixture (no tokens). OUT → sibling backend docs/screenshots-github-sync.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir =
  process.env.OUT ||
  path.resolve(__dirname, "../../appatlas-backend-github-sync/docs/screenshots-github-sync");
fs.mkdirSync(outDir, { recursive: true });

const fixture = path.join(outDir, "_polish-fixture.html");
fs.writeFileSync(
  fixture,
  `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<script src="https://cdn.tailwindcss.com"></script>
<script>tailwind.config={darkMode:'class'}</script>
<style>
  body{font-family:system-ui,sans-serif;margin:0;background:#f5f5f5}
  .pill{display:flex;height:36px;min-width:0;width:220px;align-items:center;gap:8px;border-radius:8px;border:1px solid #C9B8F7;background:#F4EFFE;padding:0 10px;font-size:12.5px;font-weight:500;color:#8664F2}
  .pill span.label{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .dot{width:8px;height:8px;border-radius:999px;flex-shrink:0}
  .panel{width:420px;background:#fff;border-radius:16px;padding:20px;box-shadow:0 8px 30px rgba(0,0,0,.12)}
  .modal{width:520px;max-height:70vh;overflow:auto;background:#fff;border-radius:16px;padding:20px}
  .cat{border:1px solid #ECECEC;border-radius:12px;background:#FAFAFA;padding:16px;margin:10px 0}
  .tile{width:56px;height:56px;border-radius:10px;border:1px solid #E5E7EB;display:flex;align-items:center;justify-content:center;background:#fff;opacity:.4;filter:grayscale(1)}
  .tile.ok{opacity:1;filter:none;border:2px solid #22C55E}
  .grid{display:flex;flex-wrap:wrap;gap:12px}
  .name{width:64px;text-align:center;font-size:10px;color:#5E6066;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .status{display:inline-block;border-radius:999px;border:1px solid;padding:2px 10px;font-size:11px;font-weight:600}
</style>
</head>
<body>
<div id="root" class="p-6 space-y-8"></div>
<script>
const cats = [
  {t:'AGILE PROJECT MANAGEMENT & ISSUE TRACKING', apps:[['Jira',1],['Linear',0]]},
  {t:'API DESIGN & DOCUMENTATION', apps:[['Swagger / OpenAPI',1],['Redoc / Redocly',0],['Stoplight',0]]},
  {t:'SOURCE CODE MANAGEMENT & VERSION CONTROL', apps:[['GitHub',1],['GitLab',0],['GitBucket',0],['AWS CodeCommit',0],['Azure Repos',0]]},
  {t:'UI/UX DESIGN & PROTOTYPING', apps:[['Figma',0]]},
  {t:'TEAM COLLABORATION & COMMUNICATION', apps:[['Microsoft Teams',1],['Slack',0]]},
];
const tones = [
  {id:'synced', label:'Synced', cls:'bg-emerald-50 text-emerald-700 border-emerald-300'},
  {id:'waiting', label:'Waiting to sync', cls:'bg-blue-50 text-blue-700 border-blue-300'},
  {id:'syncing', label:'Syncing', cls:'bg-blue-50 text-blue-700 border-blue-300'},
  {id:'paused', label:'Paused by admin', cls:'bg-amber-50 text-amber-700 border-amber-300'},
  {id:'attention', label:'Needs attention', cls:'bg-red-50 text-red-700 border-red-300'},
  {id:'reconnect', label:'Reconnect GitHub', cls:'bg-red-50 text-red-700 border-red-300'},
];
const root = document.getElementById('root');
root.innerHTML = \`
<section id="pill-long">
  <h2 class="text-sm font-semibold mb-2">Explorer pill (long repo)</h2>
  <div class="pill" title="Repo: Pro-Test-Consulting-Private-Limited/very-long-repository-name-that-should-ellipsis · Branch: appatlas-sync · Status: ok">
    <span style="width:20px;height:20px;background:#fff;border-radius:5px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">GH</span>
    <span class="label">GitHub · very-long-repository-name-that-should-ellipsis</span>
    <span class="dot" style="background:#22C55E"></span>
  </div>
</section>
<section id="modal-all" class="mt-8">
  <h2 class="text-sm font-semibold mb-2">Connect apps modal (all categories)</h2>
  <div class="modal">
    <h3 class="text-lg font-semibold border-b pb-2 mb-3">Select an app to connect with this canvas</h3>
    \${cats.map(c=>\`<div class="cat"><div class="text-xs font-semibold tracking-wide">\${c.t}</div><div class="grid mt-3">\${c.apps.map(([n,ok])=>\`<div><div class="tile \${ok?'ok':''}">●</div><div class="name" title="\${n}">\${n}</div></div>\`).join('')}</div></div>\`).join('')}
  </div>
</section>
<section id="panels" class="mt-8 space-y-4">
  <h2 class="text-sm font-semibold">Panel states</h2>
  \${tones.map(t=>\`
    <div class="panel" id="panel-\${t.id}">
      <div class="flex items-center gap-3 border rounded-lg p-3">
        <div class="w-9 h-9 rounded-lg border-2 border-green-500 flex items-center justify-center">GH</div>
        <div><div class="font-medium text-sm">Connected to GitHub</div><div class="text-xs text-gray-500">org/appatlas-data</div></div>
      </div>
      <div class="mt-3 text-xs space-y-2 bg-gray-50 border rounded-lg p-3">
        <div class="flex justify-between"><span class="text-gray-500">Repository</span><span class="text-purple-600">org/appatlas-data</span></div>
        <div class="flex justify-between"><span class="text-gray-500">Branch</span><span class="text-purple-600">appatlas-sync</span></div>
        <div class="flex justify-between"><span class="text-gray-500">Last synced</span><span>2m ago · <span class="font-mono">3494b97</span></span></div>
        <div class="flex justify-between items-center"><span class="text-gray-500">Status</span><span class="status \${t.cls}">\${t.label}</span></div>
      </div>
      <p class="mt-3 text-xs text-gray-600">Changes to this canvas and its SIT are saved to GitHub automatically about a minute after you stop editing.</p>
    </div>\`).join('')}
</section>
\`;
</script>
</body></html>`,
);

const browser = await chromium.launch({ headless: true });

async function shot(page, sel, file, dark = false) {
  if (dark) await page.evaluate(() => document.documentElement.classList.add("dark"));
  else await page.evaluate(() => document.documentElement.classList.remove("dark"));
  const loc = page.locator(sel);
  await loc.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await loc.screenshot({ path: path.join(outDir, file) });
}

try {
  for (const width of [1280, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto("file://" + fixture.replace(/\\/g, "/"), { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    if (width === 1280) {
      await shot(page, "#modal-all .modal", "10-modal-all-categories-light.png", false);
      await shot(page, "#modal-all .modal", "10-modal-all-categories-dark.png", true);
      await shot(page, "#pill-long .pill", "11-explorer-pill-long-repo.png", false);
      for (const t of ["synced", "waiting", "syncing", "paused", "attention", "reconnect"]) {
        await shot(page, `#panel-${t}`, `12-panel-${t}.png`, false);
      }
    } else {
      await page.screenshot({ path: path.join(outDir, "13-narrow-390-modal.png"), fullPage: false });
      await page.locator("#modal-all .modal").screenshot({ path: path.join(outDir, "13-narrow-390-categories.png") });
    }
    await page.close();
  }
  // Explorer-width pill (~240px rail)
  const page = await browser.newPage({ viewport: { width: 240, height: 200 } });
  await page.goto("file://" + fixture.replace(/\\/g, "/"));
  await page.locator("#pill-long .pill").screenshot({ path: path.join(outDir, "11-explorer-pill-width-240.png") });
  await page.close();
  console.log(
    JSON.stringify({
      ok: true,
      outDir,
      files: fs.readdirSync(outDir).filter((f) => /^(10|11|12|13)-/.test(f)),
    }),
  );
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await browser.close();
}
