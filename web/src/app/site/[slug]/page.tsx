import Link from "next/link";
import { notFound } from "next/navigation";
import { readJson } from "@/lib/data";
import { StackImage } from "./StackImage";

const tph = (kg: number) => (kg / 1000).toFixed(1);
const METHOD: Record<string, string> = { IME: "Integrated mass enhancement", CSF: "Cross-sectional flux", DIV: "Flux divergence" };

export async function generateStaticParams() {
  const r3 = await readJson("r3/known_sites.json");
  return Object.keys(r3).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r3 = await readJson("r3/known_sites.json");
  return { title: `${r3[slug]?.name ?? "Site"} · Vāyu Lekha` };
}

export default async function SitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r3 = await readJson("r3/known_sites.json");
  const s = r3[slug];
  if (!s) notFound();
  const ab = await readJson("r3/ablation.json");
  const stacks = await readJson("web/stacks.json");
  const era = (await readJson("web/era5_gamma.json"))[slug];
  const blind = (await readJson("web/blind_recovery.json"))[slug];
  const detected = (s.z.DIV ?? 0) >= 3;
  return (
    <main className="mx-auto min-h-[100dvh] max-w-5xl px-5 pb-24 pt-8 md:px-8">
      <nav className="flex items-center justify-between text-[14px]">
        <Link href="/ledger" className="text-paper/70 transition hover:text-paper">← The ledger</Link>
        <Link href="/?at=attribution" className="text-paper/70 transition hover:text-paper">See it in the observatory</Link>
      </nav>
      <p className={`mt-14 text-[13px] ${detected ? "text-flame" : "text-paper/55"}`}>{detected ? "Detected above 3 sigma" : "Not significant against the local null"}</p>
      <h1 className="mt-2 text-4xl font-medium leading-[1.05] tracking-tight md:text-5xl">{s.name}</h1>
      <p className="mt-4 max-w-[62ch] text-[15px] leading-relaxed text-paper/65">
        {s.n_overpasses} usable overpasses and {s.n_pixels.toLocaleString("en-IN")} pixels within 150 km, 2023 to 2024. Reference: {s.reference}.
      </p>

      <section className="mt-12 grid gap-10 md:grid-cols-[1.15fr_1fr]">
        {stacks[slug] && <StackImage src={stacks[slug].file} xkm={stacks[slug].x_km} ykm={stacks[slug].y_km} />}
        <div>
          <h2 className="text-lg font-medium">Three methods, one stack</h2>
          <dl className="mt-4 divide-y divide-paper/10">
            {(["DIV", "CSF", "IME"] as const).map((m) => (
              <div key={m} className="flex items-baseline justify-between py-3">
                <dt className="text-[14px] text-paper/75">{METHOD[m]}</dt>
                <dd className="num text-right text-[14px]">
                  {tph(s.rate_kg_h[m])} t/h <span className="text-paper/50">[{tph(s.ci68[m][0])}, {tph(s.ci68[m][1])}]</span>{" "}
                  <span className={(s.z[m] ?? 0) >= 3 ? "text-flame" : "text-paper/45"}>z {s.z[m]?.toFixed(1)}</span>
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-[12px] leading-relaxed text-paper/55">
            Pseudo-site null for divergence: mean {tph(s.null_mean.DIV)} t/h, spread {tph(s.null_std.DIV)} t/h (this spread is the site&apos;s detection floor).
            {era && <> ERA5 at overpass hours gives a 100 m to 10 m wind ratio of {era.gamma_100_over_10}; calibrated rates scale by this factor (pending full R6).</>}
          </p>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-lg font-medium">What each component contributes</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-[14px]">
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
        {blind && (
          <p className="mt-6 text-[13px] text-paper/65">
            National blind screen: nearest candidate {blind.nearest_candidate_km} km away (rank {blind.candidate_rank}, z {blind.candidate_z}).{" "}
            {blind.recovered ? "Recovered without being told where to look." : "Not recovered by the national screen."}
          </p>
        )}
      </section>
    </main>
  );
}
