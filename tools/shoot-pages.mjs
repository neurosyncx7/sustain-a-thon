// usage: node tools/shoot-pages.mjs <outDir> <wait> <path> [path...]
import { chromium } from "../web/node_modules/playwright-core/index.mjs";
const [out, wait, ...paths] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
p.on("pageerror", (e) => errs.push(e.message.slice(0, 200)));
p.on("console", (m) => { if (m.type() === "error" && !m.text().includes("hmr")) errs.push(m.text().slice(0, 200)); });
for (const path of paths) {
  await p.goto("http://127.0.0.1:3311" + path, { waitUntil: "load", timeout: 120000 });
  await p.waitForTimeout(Number(wait));
  const name = path.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home";
  await p.screenshot({ path: `${out}/${name}.png`, fullPage: !path.startsWith("/?") && path !== "/" });
  console.log("shot", name);
}
console.log(errs.join("\n"));
await b.close();
