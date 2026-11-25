/**
 * Screenshot LIVE hosted evidence pages on ai-hub-dev (real scan data).
 * Labels filenames with theme + panel; embeds URL/timestamp in a sidecar JSON.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(__dirname, "security-posture-live-shots");
fs.mkdirSync(out, { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, "-");
const pages = [
  { theme: "dark", url: "https://ai-hub-dev.protestcorp.com/security-harness/live-dashboard.html" },
  { theme: "light", url: "https://ai-hub-dev.protestcorp.com/security-harness/live-dashboard-light.html" },
];
const panels = ["hero", "owasp", "screens", "findings", "drawer", "headers", "csp", "cookies", "thirdparty", "diff"];

const browser = await chromium.launch();
const meta = [];
for (const p of pages) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(p.url, { waitUntil: "networkidle", timeout: 60000 });
  const stamped = await page.evaluate((t) => {
    const el = document.createElement("div");
    el.textContent = `${location.href} · ${t}`;
    el.style.cssText =
      "position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#111;color:#bbf7d0;font:11px/1.4 monospace;padding:6px 10px";
    document.body.appendChild(el);
    return location.href;
  }, new Date().toISOString());
  for (const id of panels) {
    const file = path.join(out, `${p.theme}-${id}-${ts}.png`);
    const loc = page.locator(`#${id}`);
    if (await loc.count()) {
      await loc.screenshot({ path: file });
      meta.push({ file: path.basename(file), url: stamped, panel: id, theme: p.theme, at: new Date().toISOString() });
    }
  }
  const full = path.join(out, `${p.theme}-full-${ts}.png`);
  await page.screenshot({ path: full, fullPage: true });
  meta.push({ file: path.basename(full), url: stamped, panel: "full", theme: p.theme, at: new Date().toISOString() });
  await page.close();
}
await browser.close();
fs.writeFileSync(path.join(out, `manifest-${ts}.json`), JSON.stringify(meta, null, 2));
console.log(JSON.stringify({ out, count: meta.length, ts }, null, 2));
