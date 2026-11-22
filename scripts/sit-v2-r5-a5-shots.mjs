import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const fixture = path.join(root, "docs/screenshots-sit-v2/_sit-r5-a5-fixture.html");
const outDir = path.join(root, "docs/screenshots-sit-v2");

const widths = [1280, 1440, 1920];

const browser = await chromium.launch({ headless: true });
for (const w of widths) {
  const page = await browser.newPage({ viewport: { width: w, height: 900 } });
  await page.goto("file://" + fixture.replace(/\\/g, "/"));
  await page.waitForTimeout(200);
  const dest = path.join(outDir, `r5-a5-grid-${w}.png`);
  await page.screenshot({ path: dest, fullPage: true });
  console.log("wrote", dest);
  await page.close();
}
await browser.close();
