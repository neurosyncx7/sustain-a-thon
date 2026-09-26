import { NextResponse } from "next/server";
import { readJson } from "@/lib/data";
import { canDispatch, currentWinds, fxUsdInr, latestPass, mirrorToday, passHistory, pipelineRuns } from "@/lib/live";

export const dynamic = "force-dynamic";

// One call for everything that is live: the newest real pass the pipeline processed, what the
// Copernicus mirror holds right now, current winds at the top sites, the exchange rate the
// priority index depends on, and the state of the pipeline's own runs. Each source carries its
// own status and fetch time; nothing is substituted when a source is down.
export async function GET() {
  const inv = await readJson("inventory/inventory_public.json");
  const top = inv.sites.filter((s: any) => s.status !== "not detected").slice(0, 8)
    .map((s: any) => ({ slug: s.slug, lat: s.lat, lon: s.lon }));
  const [pass, history, nrti, winds, fx, runs] = await Promise.all([
    latestPass(), passHistory(), mirrorToday("NRTI"), currentWinds(top), fxUsdInr(), pipelineRuns(),
  ]);
  return NextResponse.json({
    server_utc: new Date().toISOString(),
    latest_pass: pass, history, mirror: nrti, winds, fx, pipeline: runs,
    inventory: { generated_utc: inv.generated_utc, data_span: inv.data_span, n_tested: inv.n_tested, n_confirmed: inv.n_confirmed, n_detected: inv.n_detected },
    dispatch_enabled: canDispatch(),
  }, { headers: { "cache-control": "no-store" } });
}
