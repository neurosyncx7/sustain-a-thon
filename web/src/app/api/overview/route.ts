import { NextResponse } from "next/server";
import { PROVENANCE, readJson } from "@/lib/data";

export async function GET() {
  const ex = await readJson("web/extraction.json");
  const cands = await readJson("web/candidates.json");
  const blind = await readJson("web/blind_recovery.json");
  const inv = await readJson("inventory/inventory_public.json");
  const alg = await readJson("inventory/algorithms.json");
  const abl = await readJson("r3/ablation.json");
  const inIndia = cands.candidates.filter((c: any) => c.in_india).length;
  const recovered = Object.values(blind).filter((b: any) => b.recovered).length;
  return NextResponse.json({
    period: ex.period, granules: ex.granules, pixels: ex.pixels, failed_granules: ex.failed_granules,
    product: ex.product, region: ex.region,
    screen: { candidates: cands.candidates.length, in_india: inIndia, method: cands.method },
    blind_recovery: { recovered, of: Object.keys(blind).length },
    inventory: { generated_utc: inv.generated_utc, data_span: inv.data_span, n_tested: inv.n_tested,
                 n_confirmed: inv.n_confirmed, n_detected: inv.n_detected, n_pixels: inv.n_pixels,
                 avoidable_tco2e20_per_yr: inv.sites.filter((s: any) => s.status === "confirmed")
                   .reduce((a: number, s: any) => a + s.priority.avoidable_tco2e20_per_yr[1], 0),
                 confirmed_rate_t_h: inv.sites.filter((s: any) => s.status === "confirmed").reduce((a: number, s: any) => a + s.rate_t_h.p50, 0),
                 obc_slope: inv.sites[0]?.obc_slope ?? null,
                 n_confirmed_india: inv.sites.filter((s: any) => s.status === "confirmed" && s.in_india !== false).length,
                 n_tested_india: inv.sites.filter((s: any) => s.in_india !== false).length,
                 tasking: inv.sites.filter((s: any) => s.tasking?.recommend).map((s: any) => ({ slug: s.slug, name: s.name, rank: s.tasking.rank })) },
    ablation_floor_t_h: Object.fromEntries(Object.entries(abl).map(([k, v]: any) => [k, Object.values(v).reduce((a: number, x: any) => a + x.DIV.null_sd, 0) / Object.keys(v).length / 1000])),
    algorithms: { running: alg.algorithms.filter((a: any) => a.in_inventory).map((a: any) => a.name) },
    status: {
      done: ["R1 ingestion", "R2 continuity derivation", "R3 quantifier comparison", "R4 ablation",
             "R5 algorithm tests", "R6 integrated inventory", "national blind screen", "live pass every 3 h"],
      pending: ["external validation against plume catalogues", "facility registry attribution"],
    },
    provenance: PROVENANCE,
  });
}
