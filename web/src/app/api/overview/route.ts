import { NextResponse } from "next/server";
import { PROVENANCE, readJson } from "@/lib/data";

export async function GET() {
  const ex = await readJson("web/extraction.json");
  const cands = await readJson("web/candidates.json");
  const blind = await readJson("web/blind_recovery.json");
  const inv = await readJson("inventory/inventory.json");
  const alg = await readJson("inventory/algorithms.json");
  const inIndia = cands.candidates.filter((c: any) => c.in_india).length;
  const recovered = Object.values(blind).filter((b: any) => b.recovered).length;
  return NextResponse.json({
    period: ex.period, granules: ex.granules, pixels: ex.pixels, failed_granules: ex.failed_granules,
    product: ex.product, region: ex.region,
    screen: { candidates: cands.candidates.length, in_india: inIndia, method: cands.method },
    blind_recovery: { recovered, of: Object.keys(blind).length },
    inventory: { generated_utc: inv.generated_utc, data_span: inv.data_span, n_tested: inv.n_tested,
                 n_confirmed: inv.n_confirmed, n_detected: inv.n_detected, n_pixels: inv.n_pixels },
    algorithms: alg.counts,
    status: {
      done: ["R1 ingestion", "R2 continuity derivation", "R3 quantifier comparison", "R4 ablation",
             "R5 algorithm tests", "R6 integrated inventory", "national blind screen", "live pass every 3 h"],
      pending: ["external validation against plume catalogues", "facility registry attribution"],
    },
    provenance: PROVENANCE,
  });
}
