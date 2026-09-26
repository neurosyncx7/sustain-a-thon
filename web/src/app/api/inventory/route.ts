import { NextResponse } from "next/server";
import { PROVENANCE, readJson } from "@/lib/data";
import { inventoryForRequest } from "@/lib/access";

export const dynamic = "force-dynamic";

// The integrated R6 inventory at the caller's tier (public: rounded locations, no plume evidence;
// verified partner: the full package). ?status=confirmed|detected|all
export async function GET(req: Request) {
  const { doc, partner } = await inventoryForRequest("api/inventory");
  const want = new URL(req.url).searchParams.get("status") ?? "all";
  const keep = (s: any) => want === "all" || (want === "detected" ? ["confirmed", "detected"].includes(s.status) : s.status === want);
  const run = await readJson("inventory/run.json").catch(() => null);
  return NextResponse.json({ ...doc, sites: doc.sites.filter(keep), run, viewer: partner ? { tier: "partner", org: partner } : { tier: "public" }, provenance: PROVENANCE },
    { headers: { "cache-control": partner ? "private, no-store" : "public, max-age=60" } });
}
