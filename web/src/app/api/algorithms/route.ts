import { NextResponse } from "next/server";
import { readJson } from "@/lib/data";

// The algorithms running in the inventory (each passed its pre-declared test on real data).
// ?all=1 returns the complete test record, including designs that were not built or did not pass.
export async function GET(req: Request) {
  const doc = await readJson("inventory/algorithms.json");
  const all = new URL(req.url).searchParams.get("all") === "1";
  return NextResponse.json(all ? doc : { ...doc, algorithms: doc.algorithms.filter((a: any) => a.in_inventory) });
}
