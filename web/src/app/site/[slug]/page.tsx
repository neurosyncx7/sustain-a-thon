import Link from "next/link";
import { SmoothScroll } from "@/components/SmoothScroll";
import { notFound } from "next/navigation";
import { readJson } from "@/lib/data";
import { StackImage } from "./StackImage";

const t1 = (x: number) => x.toFixed(1);
const tph = (kg: number) => (kg / 1000).toFixed(1);
const big = (x: number) => (x >= 1e6 ? `${(x / 1e6).toFixed(1)} M` : x >= 1e3 ? `${(x / 1e3).toFixed(0)} k` : x.toFixed(0));
const METHOD: Record<string, string> = { IME: "Integrated mass enhancement", CSF: "Cross-sectional flux", DIV: "Flux divergence" };
const MON = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const TIER: Record<string, string> = {
  confirmed: "Confirmed: passes the family-wide false-discovery gate",
  detected: "Detected above 3 sigma against its own null",
  tentative: "Tentative: between 2 and 3 sigma",
  "not detected": "Not detected: an upper limit is reported",
};

export async function generateStaticParams() {
  const inv = await readJson("inventory/inventory.json");
  return inv.sites.map((s: any) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const inv = await readJson("inventory/inventory.json");
  return { title: `${inv.sites.find((s: any) => s.slug === slug)?.name ?? "Site"} · Vāyu Lekha` };
}

export default async function SitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const inv = await readJson("inventory/inventory.json");
  const e = inv.sites.find((s: any) => s.slug === slug);
  if (!e) notFound();
  const r3 = (await readJson("r3/known_sites.json"))[slug];
  const ab = r3 ? await readJson("r3/ablation.json") : null;
  const blind = (await readJson("web/blind_recovery.json"))[slug];
  const ev = e.evidence, pr = e.priority;
  const lit = e.status === "confirmed" || e.status === "detected";

  // overpasses per calendar month, across the whole record (real counts; monsoon months are excluded by design)
  const byMonth = Array(12).fill(0);
  Object.entries(ev.overpasses_per_month as Record<string, number>).forEach(([k, n]) => { byMonth[+k.slice(5, 7) - 1] += n; });
  const maxM = Math.max(1, ...byMonth);

  return (
    <main className="mx-auto min-h-[100dvh] max-w-5xl px-5 pb-24 pt-8 md:px-8">
      <SmoothScroll />
      <nav className="flex items-center justify-between text-[14px]">
        <Link href="/ledger" className="text-paper/70 transition hover:text-paper">← The ledger</Link>
        <Link href="/?at=attribution" className="text-paper/70 transition hover:text-paper">See it in the observatory</Link>
      </nav>
      <p className={`mt-14 text-[13px] ${lit ? "text-flame" : "text-paper/55"}`}>#{e.priority_rank} · {TIER[e.status]}</p>
      <h1 className="mt-2 text-4xl font-medium leading-[1.05] tracking-tight md:text-5xl">{e.name}</h1>
      <p className="mt-4 max-w-[64ch] text-[15px] leading-relaxed text-paper/65">
        {ev.n_overpasses} usable overpasses, {ev.first_overpass} to {ev.last_overpass}, mean 10 m wind {ev.mean_wind10_ms.toFixed(1)} m/s.
        {e.source_reference && <> Reference: {e.source_reference}.</>}
        {e.kind === "screen_candidate" && <> Found by the national screen with no site list (screen rank {e.screen.rank}).</>}
      </p>

      <section className="mt-12 grid gap-10 md:grid-cols-[1.15fr_1fr]">
        <StackImage src={ev.stack.file} xkm={ev.stack.x_km} ykm={ev.stack.y_km} />
        <div>
          <h2 className="text-lg font-medium">Emission rate</h2>
          <p className="num mt-3 text-4xl tracking-tight">
            {e.status === "not detected" ? <>&lt; {t1(e.rate_t_h.p84)}</> : t1(e.rate_t_h.p50)} <span className="text-lg text-paper/55">t CH₄/h</span>
          </p>
          <p className="num mt-1 text-[13px] text-paper/55">68% interval {t1(e.rate_t_h.p16)} to {t1(e.rate_t_h.p84)}</p>
          <dl className="mt-6 divide-y divide-paper/10 text-[13.5px]">
            {[
              ["Divergence at the 10 m wind", `${tph(e.rate_gamma1_kg_h)} t/h`],
              ["Detection floor (1σ of 24 pseudo-sites)", `${tph(e.null_floor_1sigma_kg_h)} t/h`],
              ["Significance", `z ${e.z.toFixed(2)} · p ${e.p.toExponential(1)} · q ${e.q.toFixed(3)}`],
              ["Transport-wind factor", `${e.gamma.value.toFixed(2)} ± ${e.gamma.sd.toFixed(2)} (${e.gamma.source})`],
              ["Injection-recovery slope", e.obc_slope.toFixed(3)],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-4 py-2.5"><dt className="text-paper/65">{k}</dt><dd className="num text-right">{v}</dd></div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mt-16 grid gap-10 md:grid-cols-2">
        <div>
          <h2 className="text-lg font-medium">Priority</h2>
          <dl className="mt-3 divide-y divide-paper/10 text-[13.5px]">
            {[
              ["Sector", e.sector === "oil_gas" ? "Oil & gas" : e.sector.charAt(0).toUpperCase() + e.sector.slice(1)],
              ["Basis", e.sector_basis],
              ["Avoidable, t CO₂e (20-yr) per year", e.status === "not detected" ? "–" : `${big(pr.avoidable_tco2e20_per_yr[1])} [${big(pr.avoidable_tco2e20_per_yr[0])}, ${big(pr.avoidable_tco2e20_per_yr[2])}]`],
              ["Abatement cost per year", e.status === "not detected" ? "–" : `₹${(pr.abatement_cost_inr_per_yr[1] / 1e7).toLocaleString("en-IN", { maximumFractionDigits: 0 })} crore`],
              ["Warming avoided per ₹ 1 lakh", e.status === "not detected" ? "–" : `${big(pr.wrpi_tco2e20_per_lakh_inr[1])} t CO₂e₂₀`],
              ["Chance the source is real (1 − q)", pr.p_real.toFixed(2)],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-4 py-2.5"><dt className="text-paper/65">{k}</dt><dd className="num text-right">{v}</dd></div>
            ))}
          </dl>
          <p className="mt-3 text-[11.5px] leading-relaxed text-paper/45">Costs: US EPA landfill abatement curve and IEA fossil methane abatement costs, GWP20 from IPCC AR6, all sampled in a Monte Carlo; ₹{pr.fx_inr_per_usd.toFixed(2)} per US$.</p>
        </div>
        <div>
          <h2 className="text-lg font-medium">When the satellite could see it</h2>
          <div className="mt-5 flex items-end gap-[6px]" role="img" aria-label="Usable overpasses by calendar month">
            {byMonth.map((n, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="num text-[10px] text-paper/45">{n || ""}</span>
                <div className="w-full rounded-sm" style={{ height: `${Math.max(2, (n / maxM) * 88)}px`, background: n ? "var(--flame)" : "rgb(236 228 216 / 0.14)" }} />
                <span className="text-[10px] text-paper/50">{MON[i]}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11.5px] text-paper/45">June to September are excluded by design (monsoon cloud and paddy background); they are unobserved, not zero.</p>
          <details className="group mt-6">
            <summary className="cursor-pointer text-[13px] text-paper/70 transition hover:text-paper">{ev.orbits.length} orbit numbers used</summary>
            <p className="num mt-2 max-h-40 overflow-y-auto text-[11px] leading-relaxed text-paper/50">{ev.orbits.join(" ")}</p>
          </details>
        </div>
      </section>

      {r3 && (
        <section className="mt-16">
          <h2 className="text-lg font-medium">Three methods, one stack</h2>
          <dl className="mt-3 divide-y divide-paper/10">
            {(["DIV", "CSF", "IME"] as const).map((m) => (
              <div key={m} className="flex items-baseline justify-between py-2.5">
                <dt className="text-[14px] text-paper/75">{METHOD[m]}</dt>
                <dd className="num text-right text-[14px]">
                  {tph(r3.rate_kg_h[m])} t/h <span className="text-paper/50">[{tph(r3.ci68[m][0])}, {tph(r3.ci68[m][1])}]</span>{" "}
                  <span className={(r3.z[m] ?? 0) >= 3 ? "text-flame" : "text-paper/45"}>z {r3.z[m]?.toFixed(1)}</span>
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-10 overflow-x-auto">
            <h3 className="text-[15px] font-medium">What each component contributes</h3>
            <table className="mt-3 w-full min-w-[520px] text-[14px]">
              <thead className="text-left text-[12px] text-paper/50"><tr><th className="pb-2 font-normal">Pipeline variant</th><th className="pb-2 text-right font-normal">Rate t/h</th><th className="pb-2 text-right font-normal">Floor t/h</th><th className="pb-2 text-right font-normal">z</th></tr></thead>
              <tbody className="divide-y divide-paper/10">
                {Object.entries(ab).map(([k, v]: any) => (
                  <tr key={k}>
                    <td className="py-2.5 capitalize text-paper/80">{k.split("_").slice(1).join(" ")}</td>
                    <td className="num py-2.5 text-right">{tph(v[slug].DIV.rate)}</td>
                    <td className="num py-2.5 text-right text-paper/60">{tph(v[slug].DIV.null_sd)}</td>
                    <td className="num py-2.5 text-right">{v[slug].DIV.z?.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {blind && (
        <p className="mt-10 text-[13px] text-paper/65">
          National blind screen: nearest candidate {blind.nearest_candidate_km} km away (rank {blind.candidate_rank}, z {blind.candidate_z}).{" "}
          {blind.recovered ? "Recovered without being told where to look." : "Not recovered by the national screen."}
        </p>
      )}
    </main>
  );
}
