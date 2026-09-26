import { NextResponse } from "next/server";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

// Reads real, versioned research output from /data-pipeline — never a hardcoded number.
// Currently surfaces what R1 has actually produced (real TROPOMI CH4 pixel counts per orbit,
// per day); it does not yet return a ranked emission inventory, because R3-R6 haven't run.
// The `status` field is explicit so the frontend never silently presents partial data as final.
const DATA_ROOT = path.join(process.cwd(), "..", "data-pipeline");

export async function GET() {
  try {
    const ch4Root = path.join(DATA_ROOT, "tropomi", "CH4");
    const days = await readdir(ch4Root).catch(() => [] as string[]);

    const perDay = await Promise.all(
      days.map(async (day) => {
        const dayDir = path.join(ch4Root, day);
        const files = (await readdir(dayDir).catch(() => [])).filter((f) =>
          f.endsWith(".parquet")
        );
        return {
          date: day,
          orbits: files.map((f) => f.replace(".parquet", "")),
        };
      })
    );

    return NextResponse.json({
      status: "screening-only",
      note:
        "R1 (real ingestion) and R2 (derivation) are complete and reflect live TROPOMI/ERA5 " +
        "data. R3-R6 (quantification comparison, ablation, independent validation, calibrated " +
        "emission rates) have not run yet, so no ranked inventory exists. This endpoint " +
        "reflects exactly what has been ingested, nothing more.",
      source: "research/findings.md",
      tropomi_ch4_days: perDay,
    });
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: String(err) },
      { status: 500 }
    );
  }
}
