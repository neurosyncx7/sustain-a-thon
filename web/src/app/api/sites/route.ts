import { NextResponse } from "next/server";
import { PROVENANCE, readJson, type SiteResult } from "@/lib/data";

export async function GET() {
  const r3 = await readJson<Record<string, SiteResult>>("r3/known_sites.json");
  const stacks = await readJson("web/stacks.json");
  const gamma = await readJson("web/era5_gamma.json");
  return NextResponse.json({
    sites: Object.entries(r3).map(([slug, s]) => ({ slug, ...s, stack: stacks[slug] ?? null, era5: gamma[slug] ?? null })),
    units: "kg/h at gamma=1 (ECMWF 10 m wind); multiply by gamma for transport-layer wind",
    provenance: PROVENANCE.tropomi,
  });
}
