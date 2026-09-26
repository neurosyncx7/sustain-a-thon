import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

// The only door from the UI to research output. Files are synced from /data-pipeline by
// scripts/sync-data.mjs; nothing here computes science, it only reads, joins and labels.
const ROOT = path.join(process.cwd(), "data");
const cache = new Map<string, unknown>();

export async function readJson<T = any>(rel: string): Promise<T> {
  if (cache.has(rel) && process.env.NODE_ENV === "production") return cache.get(rel) as T;
  const v = JSON.parse(await readFile(path.join(ROOT, rel), "utf8"));
  cache.set(rel, v);
  return v as T;
}

export const PROVENANCE = {
  tropomi: "Copernicus Sentinel-5P TROPOMI OFFL L2 CH4, public mirror s3://meeo-s5p",
  era5: "ERA5 reanalysis via Open-Meteo archive API",
  boundaries: "Natural Earth 10m, India point-of-view edition (public domain)",
  findings: "research/findings.md",
};

export type SiteResult = {
  name: string; n_overpasses: number; n_pixels: number;
  rate_kg_h: Record<"IME" | "CSF" | "DIV", number>;
  ci68: Record<"IME" | "CSF" | "DIV", [number, number]>;
  null_mean: Record<string, number>; null_std: Record<string, number>;
  z: Record<"IME" | "CSF" | "DIV", number | null>;
  reference: string;
};
