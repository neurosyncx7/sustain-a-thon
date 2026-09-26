import { NextResponse } from "next/server";
import { PROVENANCE, readJson } from "@/lib/data";
import { inventoryForRequest } from "@/lib/access";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { doc: inv, partner } = await inventoryForRequest(`api/sites/${slug}`);
  const r3 = await readJson("r3/known_sites.json");
  const entry = inv.sites.find((s: any) => s.slug === slug);
  if (!entry && !r3[slug]) return NextResponse.json({ error: "unknown site", known: inv.sites.map((s: any) => s.slug) }, { status: 404 });
  const ablation = await readJson("r3/ablation.json");
  const blind = await readJson("web/blind_recovery.json");
  return NextResponse.json({
    slug, viewer: partner ? { tier: "partner", org: partner } : { tier: "public" }, inventory: entry ?? null, r3: r3[slug] ?? null,
    ablation: r3[slug] ? Object.fromEntries(Object.entries(ablation).map(([v, s]: any) => [v, s[slug]])) : null,
    blind_recovery: blind[slug] ?? null, method: inv.method, provenance: PROVENANCE,
  });
}
