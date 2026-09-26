import { NextResponse } from "next/server";
import { PROVENANCE, readJson } from "@/lib/data";

export async function GET() {
  return NextResponse.json({ ...(await readJson("web/maps.json")), period: "2023-2024", provenance: PROVENANCE.tropomi });
}
