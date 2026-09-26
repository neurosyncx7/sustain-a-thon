import { readJson } from "@/lib/data";

// Citable CSV of the current screening inventory (in-India candidates) and known-site stacks.
export async function GET() {
  const c = await readJson("web/candidates.json");
  const r3 = await readJson("r3/known_sites.json");
  const rows = [
    "kind,id,name_or_nearest,lat,lon,z,rate_t_h_gamma1,ci68_low,ci68_high,valid_days_or_overpasses,known_site_match_km,status",
    ...c.candidates.filter((x: any) => x.in_india).map((x: any, i: number) =>
      ["screen", `C${String(i + 1).padStart(2, "0")}`, `"${x.place_label}"`, x.lat, x.lon, x.z.toFixed(2),
        (x.rate_kg_h_gamma1 / 1000).toFixed(2), "", "", x.valid_days, x.known_site_match?.km ?? "", "candidate"].join(",")),
    ...Object.entries(r3).map(([slug, s]: any) =>
      ["known_site_stack", slug, `"${s.name}"`, "", "", s.z.DIV?.toFixed(2), (s.rate_kg_h.DIV / 1000).toFixed(2),
        (s.ci68.DIV[0] / 1000).toFixed(2), (s.ci68.DIV[1] / 1000).toFixed(2), s.n_overpasses, "", (s.z.DIV ?? 0) >= 3 ? "detected" : "not significant"].join(",")),
  ];
  return new Response(rows.join("\n") + "\n", {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="vayu-lekha-inventory-2023-2024.csv"' },
  });
}
