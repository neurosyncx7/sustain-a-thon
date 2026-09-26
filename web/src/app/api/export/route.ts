import { readJson } from "@/lib/data";

const f = (x: number | null | undefined, d = 2) => (x == null || !Number.isFinite(x) ? "" : x.toFixed(d));

// Citable CSV of the integrated inventory (every tested site, ranked), with the method line and
// the data span in the header comment so a downloaded copy stays self-describing.
export async function GET() {
  const inv = await readJson("inventory/inventory.json");
  const rows = [
    `# Vayu Lekha methane inventory; generated ${inv.generated_utc}; TROPOMI ${inv.data_span.first}..${inv.data_span.last}; ${inv.fdr.statement}`,
    "rank,slug,name,lat,lon,status,z,p,q_BY,rate_t_h_p16,rate_t_h_p50,rate_t_h_p84,null_floor_t_h,gamma,sector,avoidable_tCO2e20_yr_p50,wrpi_tCO2e20_per_lakh_inr_p50,overpasses,first_overpass,last_overpass",
    ...inv.sites.map((s: any) => [
      s.priority_rank, s.slug, `"${s.name}"`, s.lat, s.lon, s.status, f(s.z), s.p.toExponential(2), f(s.q, 4),
      f(s.rate_t_h.p16, 1), f(s.rate_t_h.p50, 1), f(s.rate_t_h.p84, 1), f(s.null_floor_1sigma_kg_h / 1000, 1), f(s.gamma.value),
      s.sector, f(s.priority.avoidable_tco2e20_per_yr[1], 0), f(s.priority.wrpi_tco2e20_per_lakh_inr[1], 0),
      s.evidence.n_overpasses, s.evidence.first_overpass, s.evidence.last_overpass,
    ].join(",")),
  ];
  return new Response(rows.join("\n") + "\n", {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="vayu-lekha-inventory-${inv.data_span.last}.csv"` },
  });
}
