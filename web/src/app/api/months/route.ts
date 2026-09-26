import { NextResponse } from "next/server";
import { PROVENANCE, readJson } from "@/lib/data";

// Twelve calendar months (the Rashivalaya dials) aggregated over every real month in the archive.
export async function GET() {
  const ex = await readJson("web/extraction.json");
  const ms = await readJson<any[]>("web/months.json");
  const byMonth = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, pixels: 0, granules: 0, observed_cells: 0, xch4: [] as number[], years: [] as string[] }));
  for (const m of ex.months) byMonth[Number(m.month.slice(5)) - 1].granules += m.granules;
  for (const m of ms) {
    const b = byMonth[Number(m.month.slice(5)) - 1];
    b.pixels += m.pixels; b.observed_cells += m.mean_observed_cells; b.years.push(m.month.slice(0, 4));
    if (m.mean_xch4) b.xch4.push(m.mean_xch4);
  }
  const maxPix = Math.max(...byMonth.map((b) => b.pixels));
  return NextResponse.json({
    months: byMonth.map((b) => ({
      month: b.month, pixels: b.pixels, granules: b.granules,
      mean_observed_cells_per_day: Math.round(b.observed_cells / Math.max(1, b.years.length)),
      coverage_relative: b.pixels / maxPix,
      mean_xch4_ppb: b.xch4.length ? b.xch4.reduce((a, c) => a + c, 0) / b.xch4.length : null,
      years: b.years,
    })),
    note: `Pixels passing qa>=0.5 over the India box, summed over ${ms[0].month}..${ms[ms.length - 1].month}.`,
    provenance: PROVENANCE.tropomi,
  });
}
