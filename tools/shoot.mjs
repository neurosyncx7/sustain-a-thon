// Render QA: headless Chromium + SwiftShader (no GPU in CI/container). Captures each stage.
// usage: node tools/shoot.mjs <baseUrl> <outDir> [slug,slug...] [waitMs]
import { chromium } from "../web/node_modules/playwright-core/index.mjs";
const [base = "http://127.0.0.1:3311", out = "shots", list = "prologue,ingest,seasons,anomalies,attribution,ledger", wait = "9000"] = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
const logs = [];
page.on("console", (m) => { if (["error", "warning"].includes(m.type())) logs.push(`${m.type()}: ${m.text()}`.slice(0, 300)); });
page.on("pageerror", (e) => logs.push("pageerror: " + e.message.slice(0, 300)));
const fs = await import("node:fs");
fs.mkdirSync(out, { recursive: true });
for (const slug of list.split(",")) {
  await page.goto(`${base}/?at=${slug}`, { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(Number(wait));
  await page.screenshot({ path: `${out}/${slug}.png` });
  console.log("shot", slug);
}
console.log([...new Set(logs)].slice(0, 25).join("\n"));
await browser.close();
