import { NextResponse } from "next/server";
import { PROVENANCE, readJson } from "@/lib/data";

// The integrated R6 inventory (validated algorithms only). ?status=confirmed|detected|all
export async function GET(req: Request) {
  const inv = await readJson("inventory/inventory.json");
  const want = new URL(req.url).searchParams.get("status") ?? "all";
  const keep = (s: any) => want === "all" || (want === "detected" ? ["confirmed", "detected"].includes(s.status) : s.status === want);
  const run = await readJson("inventory/run.json").catch(() => null);
  return NextResponse.json({ ...inv, sites: inv.sites.filter(keep), run, provenance: PROVENANCE });
}
