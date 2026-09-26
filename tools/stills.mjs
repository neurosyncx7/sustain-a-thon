// Renders the static-fallback stills (web/public/stills/<slug>.jpg) and the social card
// (web/public/og.jpg) from the real scene, HUD hidden. usage: node tools/stills.mjs [baseUrl]
import { chromium } from "../web/node_modules/playwright-core/index.mjs";
import { mkdirSync } from "node:fs";
const base = process.argv[2] ?? "http://127.0.0.1:3311";
const slugs = ["prologue", "ingest", "observe", "seasons", "anomalies", "attribution", "ledger"];
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
mkdirSync("web/public/stills", { recursive: true });
const shoot = async (w, h, slug, path) => {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.goto(`${base}/?at=${slug}&render=3d`, { waitUntil: "load", timeout: 180000 });
  await p.waitForTimeout(11000);
  await p.addStyleTag({ content: "header, .fixed:not(canvas), [role=radiogroup], nextjs-portal { visibility: hidden !important; }" });
  await p.waitForTimeout(400);
  await p.screenshot({ path, type: "jpeg", quality: 82 });
  await p.close();
  console.log("wrote", path);
};
for (const s of slugs) await shoot(1600, 900, s, `web/public/stills/${s}.jpg`);
await shoot(1200, 630, "prologue", "web/public/og.jpg");
await b.close();
