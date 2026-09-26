import { NextResponse } from "next/server";
import { PROVENANCE, readJson, type SiteResult } from "@/lib/data";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r3 = await readJson<Record<string, SiteResult>>("r3/known_sites.json");
  if (!r3[slug]) return NextResponse.json({ error: "unknown site", known: Object.keys(r3) }, { status: 404 });
  const ablation = await readJson("r3/ablation.json");
  const stacks = await readJson("web/stacks.json");
  const gamma = await readJson("web/era5_gamma.json");
  const blind = await readJson("web/blind_recovery.json");
  return NextResponse.json({
    slug, ...r3[slug],
    ablation: Object.fromEntries(Object.entries(ablation).map(([v, s]: any) => [v, s[slug]])),
    stack: stacks[slug] ?? null, era5: gamma[slug] ?? null, blind_recovery: blind[slug] ?? null,
    provenance: PROVENANCE,
  });
}
