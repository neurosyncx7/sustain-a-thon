import { NextResponse } from "next/server";
import { PROVENANCE, readJson } from "@/lib/data";

export async function GET() {
  const ex = await readJson("web/extraction.json");
  const cands = await readJson("web/candidates.json");
  const blind = await readJson("web/blind_recovery.json");
  const inIndia = cands.candidates.filter((c: any) => c.in_india).length;
  const recovered = Object.values(blind).filter((b: any) => b.recovered).length;
  return NextResponse.json({
    period: ex.period, granules: ex.granules, pixels: ex.pixels, failed_granules: ex.failed_granules,
    product: ex.product, region: ex.region,
    screen: { candidates: cands.candidates.length, in_india: inIndia, method: cands.method },
    blind_recovery: { recovered, of: Object.keys(blind).length },
    status: {
      done: ["R1 ingestion (2 years)", "R2 continuity derivation", "R3 quantifier comparison", "R4 ablation", "national blind screen"],
      pending: ["R5 independent validation and facility attribution", "R6 Monte Carlo uncertainty and calibrated rates"],
    },
    provenance: PROVENANCE,
  });
}
