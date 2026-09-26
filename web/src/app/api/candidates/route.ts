import { NextResponse } from "next/server";
import { PROVENANCE, readJson } from "@/lib/data";
import { coarse, getPartner } from "@/lib/access";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const scope = new URL(req.url).searchParams.get("scope") ?? "india";
  const partner = await getPartner();
  const doc = await readJson("web/candidates.json");
  const list = doc.candidates.filter((c: any) => scope === "all" || c.in_india)
    .map((c: any) => partner ? c : { ...c, lat: coarse(c.lat), lon: coarse(c.lon) });
  return NextResponse.json({
    method: doc.method, labels_source: doc.labels_source, scope, count: list.length,
    location_precision_deg: partner ? 0.1 : 0.25,
    candidates: list, blind_recovery: await readJson("web/blind_recovery.json"),
    caveat: "Screening leads, not inventory entries: each needs its own stack, null test and corroboration. Rates use 10 m winds (gamma=1).",
    provenance: PROVENANCE.tropomi,
  }, { headers: { "cache-control": partner ? "private, no-store" : "public, max-age=300" } });
}
