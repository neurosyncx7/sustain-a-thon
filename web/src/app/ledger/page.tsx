import Link from "next/link";
import { readJson } from "@/lib/data";

export const metadata = { title: "The ledger · Vāyu Lekha" };

const tph = (kg: number) => (kg / 1000).toFixed(1);

export default async function LedgerPage() {
  const c = await readJson("web/candidates.json");
  const r3 = await readJson("r3/known_sites.json");
  const ov = await readJson("web/extraction.json");
  const india = c.candidates.filter((x: any) => x.in_india);
  const known = Object.entries(r3).sort((a: any, b: any) => (b[1].z.DIV ?? -9) - (a[1].z.DIV ?? -9));
  return (
    <main className="mx-auto min-h-[100dvh] max-w-6xl px-5 pb-24 pt-8 md:px-8">
      <nav className="flex items-center justify-between">
        <Link href="/?at=ledger" className="text-[14px] text-paper/70 transition hover:text-paper">← Back to the observatory</Link>
        <div className="flex gap-2">
          <a href="/api/export" className="rounded-full px-3.5 py-1.5 text-[13px] ring-1 ring-paper/20 transition hover:bg-paper/10 active:scale-[0.98]">Download CSV</a>
          <a href="/api/candidates?scope=all" className="rounded-full px-3.5 py-1.5 text-[13px] text-paper/70 ring-1 ring-paper/10 transition hover:bg-paper/10">JSON</a>
        </div>
      </nav>

      <h1 className="mt-14 max-w-3xl text-4xl font-medium leading-[1.05] tracking-tight md:text-6xl">The reading, written down.</h1>
      <p className="mt-5 max-w-[62ch] text-[16px] leading-relaxed text-paper/70">
        Every entry below comes from {ov.granules.toLocaleString("en-IN")} Sentinel-5P orbits and {ov.pixels.toLocaleString("en-IN")} clear
        pixels over India, 2023 to 2024. Rates use the satellite product&apos;s 10 m wind and are not yet calibrated to the transport layer;
        treat them as ranked evidence, not final emissions.
      </p>

      <section className="mt-16">
        <h2 className="text-xl font-medium tracking-tight">Known sites, stacked and tested</h2>
        <p className="mt-2 max-w-[62ch] text-[14px] text-paper/60">Wind-rotated stacks, divergence rate with 68% bootstrap interval, and significance against pseudo-sites that share the same overpasses.</p>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] text-[14px]">
            <thead className="text-left text-[12px] text-paper/50">
              <tr><th className="pb-3 font-normal">Site</th><th className="pb-3 text-right font-normal">Overpasses</th><th className="pb-3 text-right font-normal">Rate t/h</th><th className="pb-3 text-right font-normal">68% interval</th><th className="pb-3 text-right font-normal">z</th></tr>
            </thead>
            <tbody className="divide-y divide-paper/10">
              {known.map(([slug, s]: any) => (
                <tr key={slug} className="group">
                  <td className="py-3"><Link href={`/site/${slug}`} className="underline-offset-4 group-hover:underline">{s.name}</Link></td>
                  <td className="num py-3 text-right text-paper/70">{s.n_overpasses}</td>
                  <td className="num py-3 text-right">{tph(s.rate_kg_h.DIV)}</td>
                  <td className="num py-3 text-right text-paper/60">{tph(s.ci68.DIV[0])} to {tph(s.ci68.DIV[1])}</td>
                  <td className={`num py-3 text-right ${(s.z.DIV ?? 0) >= 3 ? "text-flame" : "text-paper/45"}`}>{s.z.DIV?.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-20">
        <h2 className="text-xl font-medium tracking-tight">National screen: {india.length} candidates inside India</h2>
        <p className="mt-2 max-w-[62ch] text-[14px] text-paper/60">Local maxima of the two-year mean flux divergence above three robust sigma. Located by coordinates and nearest town; facility attribution is the next research step.</p>
        <div className="mt-8 grid gap-px overflow-hidden rounded-2xl bg-paper/10 sm:grid-cols-2 lg:grid-cols-3">
          {india.map((x: any, i: number) => (
            <article key={i} className="bg-ink p-5">
              <div className="flex items-baseline justify-between">
                <span className="num text-[12px] text-paper/45">C{String(i + 1).padStart(2, "0")}</span>
                <span className="num text-[13px] text-flame">z {x.z.toFixed(1)}</span>
              </div>
              <h3 className="mt-3 text-[17px] font-medium tracking-tight">{x.known_site_match ? x.known_site_match.name : x.place_label.charAt(0).toUpperCase() + x.place_label.slice(1)}</h3>
              <p className="num mt-1 text-[12px] text-paper/55">{x.lat.toFixed(2)}°N {x.lon.toFixed(2)}°E · {x.valid_days} valid days</p>
              <p className="mt-3 text-[13px] text-paper/70">
                <span className="num text-paper">{tph(x.rate_kg_h_gamma1)}</span> t/h within 20 km
                {x.known_site_match && <span className="text-paper/55"> · matches a known site ({x.known_site_match.km} km)</span>}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
