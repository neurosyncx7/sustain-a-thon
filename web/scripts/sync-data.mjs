// Copies the research outputs the web is allowed to read (data-pipeline/web, r3, r5, inventory) into
// web/data so the app is self-contained for deployment. Never generates or edits numbers.
import { cpSync, mkdirSync, existsSync, rmSync } from "node:fs";
const root = new URL("../../data-pipeline/", import.meta.url);
const dest = new URL("../data/", import.meta.url);
rmSync(dest, { recursive: true, force: true });   // no stale file (e.g. an old unredacted inventory) survives a sync
mkdirSync(dest, { recursive: true });
for (const [from, to] of [["web", "web"], ["r3/known_sites.json", "r3/known_sites.json"], ["r3/ablation.json", "r3/ablation.json"],
  ["inventory", "inventory"], ["r5", "r5"], ["../research/pipeline/inventory_sites.json", "inventory/family.json"]]) {
  const src = new URL(from, root);
  if (!existsSync(src)) { console.warn("sync-data: missing", from); continue; }
  mkdirSync(new URL(to.split("/").slice(0, -1).join("/") + "/", dest), { recursive: true });
  cpSync(src, new URL(to, dest), { recursive: true });
}
console.log("sync-data: ok");
