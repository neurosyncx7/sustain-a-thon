import Link from "next/link";
import { SmoothScroll } from "@/components/SmoothScroll";
import { readJson } from "@/lib/data";
import { LivePanel } from "@/components/live/LivePanel";

export const metadata = { title: "The ledger · Vāyu Lekha" };

const t1 = (x: number) => x.toFixed(1);
const big = (x: number) => (x >= 1e6 ? `${(x / 1e6).toFixed(1)} M` : x >= 1e3 ? `${(x / 1e3).toFixed(0)} k` : x.toFixed(0));
const REPO = "https://github.com/neurosyncx7/sustain-a-thon/blob/main/";

const TIER: Record<string, string> = {
  confirmed: "bg-flame/15 text-flame ring-flame/40",
  detected: "bg-paper/[0.07] text-paper ring-paper/25",
  tentative: "text-paper/65 ring-paper/15",
  "not detected": "text-paper/40 ring-paper/10",
};
const ALG: Record<string, [string, string]> = {
  validated: ["Validated, in the pipeline", "text-flame"],
  partial: ["Partly built", "text-paper/75"],
  failed: ["Tested on real data, failed", "text-[#e39b82]"],
  not_implemented: ["Designed, not built", "text-paper/40"],
};

function Tier({ s }: { s: string }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] ring-1 ${TIER[s]}`}>{s}</span>;
}

export default async function LedgerPage() {
  const inv = await readJson("inventory/inventory.json");
  const alg = await readJson("inventory/algorithms.json");
  const c = await readJson("web/candidates.json");
  const tested = new Set(inv.sites.map((s: any) => `${s.lat},${s.lon}`));
  const leads = c.candidates.filter((x: any) => x.in_india);
  const sites = inv.sites.map((s: any) => ({ slug: s.slug, name: s.name, lat: s.lat, lon: s.lon, status: s.status }));
  const total = inv.sites.filter((s: any) => s.status !== "not detected").reduce((a: number, s: any) => a + s.priority.avoidable_tco2e20_per_yr[1], 0);

  return (
    <main className="mx-auto min-h-[100dvh] max-w-6xl px-5 pb-28 pt-8 md:px-8">
      <SmoothScroll />
      <nav className="flex items-center justify-between gap-3">
        <Link href="/?at=ledger" className="text-[14px] text-paper/70 transition hover:text-paper">← Back to the observatory</Link>
        <div className="flex gap-2">
          <a href="/api/export" className="rounded-full px-3.5 py-1.5 text-[13px] ring-1 ring-paper/20 transition hover:bg-paper/10 active:scale-[0.98]">Download CSV</a>
          <a href="/api/inventory" className="rounded-full px-3.5 py-1.5 text-[13px] text-paper/70 ring-1 ring-paper/10 transition hover:bg-paper/10">JSON</a>
        </div>
      </nav>

      <h1 className="mt-14 max-w-3xl text-4xl font-medium leading-[1.05] tracking-tight md:text-6xl">The reading, written down.</h1>
      <p className="mt-5 max-w-[64ch] text-[16px] leading-relaxed text-paper/70">
        {inv.n_tested} places tested against their own statistical null on every clear Sentinel-5P overpass from {inv.data_span.first} to {inv.data_span.last}{" "}
        ({inv.n_pixels.toLocaleString("en-IN")} pixels). {inv.n_confirmed} pass the family-wide false-discovery gate, {inv.n_detected} clear three sigma on their own.
        Together the sources above the noise could avoid about <span className="num text-paper">{big(total)}</span> tonnes CO₂e (20-year) a year if abated.
      </p>

      <LivePanel sites={sites} />

      <section className="mt-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-medium tracking-tight">The inventory, ranked by warming avoided per rupee</h2>
            <p className="mt-2 max-w-[66ch] text-[14px] text-paper/60">{inv.fdr.statement} Rates are 20 km cluster totals after the transport-wind factor and the injection-recovery calibration; brackets are 68% Monte Carlo intervals.</p>
          </div>
          <p className="num text-[12px] text-paper/45">refreshed {inv.generated_utc.slice(0, 16).replace("T", " ")} UTC · code {inv.code_version}</p>
        </div>

        <div className="mt-8 hidden overflow-x-auto md:block">
          <table className="w-full min-w-[900px] text-[14px]">
            <thead className="text-left text-[12px] text-paper/50">
              <tr>
                <th className="pb-3 font-normal">#</th><th className="pb-3 font-normal">Site</th><th className="pb-3 font-normal">Tier</th>
                <th className="pb-3 text-right font-normal">t CH₄/h [68%]</th><th className="pb-3 text-right font-normal">z</th><th className="pb-3 text-right font-normal">q</th>
                <th className="pb-3 pl-6 font-normal">Sector</th><th className="pb-3 text-right font-normal">t CO₂e₂₀/yr avoidable</th><th className="pb-3 text-right font-normal">t CO₂e₂₀ per ₹ lakh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-paper/10">
              {inv.sites.map((s: any) => (
                <tr key={s.slug} className="group transition-colors hover:bg-paper/[0.03]">
                  <td className="num py-3 pr-3 text-paper/45">{String(s.priority_rank).padStart(2, "0")}</td>
                  <td className="py-3 pr-4">
                    <Link href={`/site/${s.slug}`} className="underline-offset-4 group-hover:underline">{s.name}</Link>
                    <span className="num block text-[11px] text-paper/45">{s.lat.toFixed(2)}°N {s.lon.toFixed(2)}°E · {s.evidence.n_overpasses} overpasses</span>
                  </td>
                  <td className="py-3"><Tier s={s.status} /></td>
                  <td className="num py-3 text-right">
                    {s.status === "not detected" ? <span className="text-paper/50">&lt; {t1(s.rate_t_h.p84)}</span> : <>{t1(s.rate_t_h.p50)} <span className="text-paper/45">[{t1(s.rate_t_h.p16)}, {t1(s.rate_t_h.p84)}]</span></>}
                  </td>
                  <td className="num py-3 text-right text-paper/75">{s.z.toFixed(1)}</td>
                  <td className="num py-3 text-right text-paper/60">{s.q < 0.001 ? "<0.001" : s.q.toFixed(3)}</td>
                  <td className="py-3 pl-6 text-[13px] capitalize text-paper/70">{s.sector.replace("_", " & ")}</td>
                  <td className="num py-3 text-right">{s.status === "not detected" ? "–" : big(s.priority.avoidable_tco2e20_per_yr[1])}</td>
                  <td className="num py-3 text-right text-flame">{s.status === "not detected" ? "–" : big(s.priority.wrpi_tco2e20_per_lakh_inr[1])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="mt-8 grid gap-px overflow-hidden rounded-2xl bg-paper/10 md:hidden">
          {inv.sites.map((s: any) => (
            <li key={s.slug} className="bg-ink p-4">
              <Link href={`/site/${s.slug}`} className="flex items-start justify-between gap-3">
                <span><span className="num mr-2 text-[12px] text-paper/45">{String(s.priority_rank).padStart(2, "0")}</span>{s.name}</span>
                <Tier s={s.status} />
              </Link>
              <p className="num mt-2 text-[12.5px] text-paper/65">
                {s.status === "not detected" ? `< ${t1(s.rate_t_h.p84)} t/h` : `${t1(s.rate_t_h.p50)} t/h [${t1(s.rate_t_h.p16)}, ${t1(s.rate_t_h.p84)}]`} · z {s.z.toFixed(1)}
              </p>
            </li>
          ))}
        </ul>

        <dl className="mt-6 grid gap-x-8 gap-y-2 text-[12px] text-paper/55 sm:grid-cols-2">
          {Object.entries(inv.tiers).map(([k, v]: any) => (
            <div key={k} className="flex items-baseline gap-3"><dt><Tier s={k} /></dt><dd>{v}</dd></div>
          ))}
        </dl>
      </section>

      <section className="mt-24">
        <h2 className="text-xl font-medium tracking-tight">{alg.algorithms.length} algorithms designed. {alg.counts.validated} earned their place.</h2>
        <p className="mt-2 max-w-[66ch] text-[14px] text-paper/60">
          Each was tested on the real record against a pass mark written down before the run. Failures stay on the page; the inventory above uses only what passed.
        </p>
        <div className="mt-8 grid gap-px overflow-hidden rounded-2xl bg-paper/10 sm:grid-cols-2 lg:grid-cols-3">
          {alg.algorithms.map((a: any) => (
            <article key={a.code} className="flex flex-col bg-ink p-5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="num text-[12px] text-paper/45">{a.code} · {a.stage}</span>
                <span className={`text-[11px] ${ALG[a.status][1]}`}>{ALG[a.status][0]}</span>
              </div>
              <h3 className="mt-3 text-[16px] font-medium leading-snug tracking-tight">{a.name}</h3>
              <p className="mt-2 flex-1 text-[12.5px] leading-relaxed text-paper/60">{a.result}</p>
              {a.evidence && <a href={REPO + a.evidence} target="_blank" rel="noreferrer" className="mt-3 text-[12px] text-paper/50 underline-offset-4 transition hover:text-paper hover:underline">Evidence: {a.evidence.split("/").pop()}</a>}
            </article>
          ))}
        </div>
      </section>

      <section className="mt-24">
        <h2 className="text-xl font-medium tracking-tight">National screen: {leads.length} leads inside India</h2>
        <p className="mt-2 max-w-[64ch] text-[14px] text-paper/60">Local maxima of the mean flux divergence above three robust sigma, found with no site list. A lead becomes an inventory entry only after its own stack and null test.</p>
        <div className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-paper/10 bg-paper/10 sm:grid-cols-2 lg:grid-cols-3 [&>*:last-child]:lg:col-span-1">
          {leads.map((x: any, i: number) => (
            <article key={i} className="bg-ink p-5">
              <div className="flex items-baseline justify-between">
                <span className="num text-[12px] text-paper/45">L{String(i + 1).padStart(2, "0")}</span>
                <span className="num text-[13px] text-paper/70">screen z {x.z.toFixed(1)}</span>
              </div>
              <h3 className="mt-3 text-[16px] font-medium tracking-tight">{x.known_site_match ? x.known_site_match.name : x.place_label.charAt(0).toUpperCase() + x.place_label.slice(1)}</h3>
              <p className="num mt-1 text-[12px] text-paper/55">{x.lat.toFixed(2)}°N {x.lon.toFixed(2)}°E · {x.valid_days} valid days</p>
              <p className="mt-3 text-[12px] text-paper/55">{x.known_site_match ? `Found blind, ${x.known_site_match.km} km from the documented site` : tested.has(`${x.lat},${x.lon}`) ? "Stacked and tested in the inventory" : "Awaiting its site stack"}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
