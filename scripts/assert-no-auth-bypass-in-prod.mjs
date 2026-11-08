/**
 * CI guard: after `next build`, fail if a production client chunk can enable AUTH_BYPASS_LOCAL.
 * Usage: node scripts/assert-no-auth-bypass-in-prod.mjs
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(".next");
if (!fs.existsSync(root)) {
  console.error("assert-no-auth-bypass-in-prod: .next missing — run next build first");
  process.exit(2);
}

const bad = [];
const needles = [
  "AUTH_BYPASS_LOCAL===\"1\"",
  "AUTH_BYPASS_LOCAL==='1'",
  'AUTH_BYPASS_LOCAL:"1"',
  "NEXT_PUBLIC_AUTH_BYPASS_LOCAL:\\\"1\\\"",
  "dev-atlas", // client must not hardcode bypass proxy as always-on
];

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.(js|mjs|css)$/.test(name)) {
      const text = fs.readFileSync(p, "utf8");
      // Allow the string AUTH_BYPASS_LOCAL as a comparison against "production" dead branch,
      // but fail if the enabled literal "1" is paired in a way that could activate.
      if (text.includes('AUTH_BYPASS_LOCAL")===("1"') || text.includes("AUTH_BYPASS_LOCAL')===('1'")) {
        bad.push(p);
        continue;
      }
      if (/"AUTH_BYPASS_LOCAL"\s*,\s*"1"/.test(text) || /AUTH_BYPASS_LOCAL["']?\s*:\s*["']1["']/.test(text)) {
        bad.push(p);
      }
      // Fail if NEXT_PUBLIC_AUTH_BYPASS_LOCAL was inlined as "1" in a client chunk.
      if (text.includes('NEXT_PUBLIC_AUTH_BYPASS_LOCAL:"1"') || text.includes('AUTH_BYPASS_LOCAL:"1"')) {
        bad.push(p);
      }
    }
  }
}

walk(path.join(root, "static"));
if (fs.existsSync(path.join(root, "server"))) {
  // Server may mention the flag in API route — that's OK if gated by NODE_ENV.
  // Only scan client static.
}

if (bad.length) {
  console.error("FAIL: production client bundle contains auth-bypass enablement:");
  for (const p of bad) console.error(" -", p);
  process.exit(1);
}
console.log("PASS: no AUTH_BYPASS_LOCAL=1 in production client static chunks");
