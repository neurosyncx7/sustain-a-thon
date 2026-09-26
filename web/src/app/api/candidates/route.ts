import { NextResponse } from "next/server";
import { PROVENANCE, readJson } from "@/lib/data";

export async function GET(req: Request) {
  const scope = new URL(req.url).searchParams.get("scope") ?? "india";
  const doc = await readJson("web/candidates.json");
  const list = doc.candidates.filter((c: any) => scope === "all" || c.in_india);
  return NextResponse.json({
    method: doc.method, labels_source: doc.labels_source, scope, count: list.length,
    candidates: list, blind_recovery: await readJson("web/blind_recovery.json"),
    caveat: "Screening leads. Rates use 10 m winds (gamma=1) and are not yet calibrated (R6); facility attribution pending (R5).",
    provenance: PROVENANCE.tropomi,
  });
}
