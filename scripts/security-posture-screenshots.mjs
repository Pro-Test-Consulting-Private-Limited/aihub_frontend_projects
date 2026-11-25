/**
 * Capture light/dark screenshots of Canvas posture panels from the static harness page.
 * Output: scripts/security-posture-shots/
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(__dirname, "security-posture-shots");
fs.mkdirSync(out, { recursive: true });
const pageUrl = pathToFileURL(path.join(__dirname, "security-posture-screenshot-page.html")).href;

const shots = [
  { name: "hero", sel: "#hero", hideDrawer: true },
  { name: "owasp", sel: "#owasp", hideDrawer: true },
  { name: "screens", sel: "#screens", hideDrawer: true },
  { name: "findings", sel: "#findings", hideDrawer: true },
  { name: "headers", sel: "#headers", hideDrawer: true },
  { name: "csp", sel: "#csp", hideDrawer: true },
  { name: "cookies", sel: "#cookies", hideDrawer: true },
  { name: "thirdparty", sel: "#thirdparty", hideDrawer: true },
  { name: "diff", sel: "#diff", hideDrawer: true },
  { name: "empty", sel: "#empty", hideDrawer: true },
  { name: "node-badge", sel: "#node", hideDrawer: true },
  { name: "drawer-overview", sel: "#drawer", tab: "overview" },
  { name: "drawer-evidence", sel: "#drawer", tab: "evidence" },
  { name: "drawer-remediation", sel: "#drawer", tab: "remediation" },
  { name: "drawer-history", sel: "#drawer", tab: "history" },
];

const browser = await chromium.launch();
for (const theme of ["light", "dark"]) {
  for (const s of shots) {
    const q = new URLSearchParams({ theme });
    if (s.hideDrawer) q.set("hideDrawer", "1");
    if (s.tab) q.set("tab", s.tab);
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(`${pageUrl}?${q}`);
    const el = page.locator(s.sel);
    await el.screenshot({ path: path.join(out, `${theme}-${s.name}.png`) });
    await page.close();
  }
}
await browser.close();
console.log(`Wrote screenshots to ${out}`);
