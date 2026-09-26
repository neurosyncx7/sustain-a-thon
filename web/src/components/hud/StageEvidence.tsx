"use client";

import Link from "next/link";
import { useApi } from "@/lib/useData";
import type { Stage } from "@/content/stages";

const int = (n: number) => n.toLocaleString("en-IN");
const tph = (kg: number) => (kg / 1000).toFixed(1);
const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

function Figures({ items }: { items: [string, string][] }) {
  return (
    <dl className="grid grid-cols-3 gap-x-6 gap-y-2">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt className="text-[11px] text-paper/50">{k}</dt>
          <dd className="num mt-0.5 text-[17px] text-paper">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 max-w-[60ch] border-l border-flame/40 pl-3 text-[12px] leading-relaxed text-paper/60">{children}</p>;
}

function Skeleton() {
  return <div className="h-12 w-72 animate-pulse rounded-md bg-paper/[0.06]" aria-label="Loading evidence" />;
}

function Failure({ error }: { error: string }) {
  return <p className="text-[12px] text-[#ffb4a0]">Evidence unavailable ({error}). The scene still reflects the last loaded data.</p>;
}

export function StageEvidence({ slug, expanded }: { slug: Stage["slug"]; expanded: boolean }) {
  const ov = useApi("/api/overview");
  const months = useApi("/api/months");
  const maps = useApi("/api/maps");
  const cands = useApi("/api/candidates");
  const site = useApi("/api/sites/jawaharnagar");
  const sites = useApi("/api/sites");

  switch (slug) {
    case "prologue": {
      if (ov.error) return <Failure error={ov.error} />;
      if (!ov.data) return <Skeleton />;
      const d = ov.data;
      return (
        <>
          <Figures items={[["Record", "2023-24"], ["Orbits read", int(d.granules)], ["Clear pixels", int(d.pixels)]]} />
          {expanded && <Note>{d.product}. Source: {d.provenance.tropomi}. {d.failed_granules} granules failed to open and are logged, not dropped silently.</Note>}
        </>
      );
    }
    case "ingest":
      return (
        <>
          <Figures items={[["Sample orbit", "32417"], ["Date", "15 Jan 2024"], ["Sun at 13:30", "37.2°"]]} />
          {expanded && <Note>The shadow is computed, not painted: a solar ephemeris for 2024-01-15 (declination −21.19°) drives the scene's sun, and the gnomon is inclined at Jaipur's latitude, so its edge reads true solar time on the dial.</Note>}
        </>
      );
    case "observe": {
      if (maps.error) return <Failure error={maps.error} />;
      if (!maps.data || !ov.data) return <Skeleton />;
      const m = maps.data.xch4_mean;
      return (
        <>
          <div className="flex items-center gap-3">
            <span className="num text-[12px] text-paper/60">{m.lo.toFixed(0)} ppb</span>
            <span className="h-2 w-48 rounded-full" style={{ background: "linear-gradient(90deg,#122142,#2e70d1,#70b5ff,#ebf6ff)" }} />
            <span className="num text-[12px] text-paper/60">{m.hi.toFixed(0)} ppb</span>
          </div>
          <p className="mt-2 text-[12px] text-paper/55">Mean column methane, {int(ov.data.pixels)} pixels, 0.1° grid</p>
          {expanded && <Note>Bias-corrected XCH4 (qa ≥ 0.5). Bright Indo-Gangetic plain and Bangladesh, low Himalaya: real features of the record, not styling. Colour stretch spans the 1st to 99th percentile.</Note>}
        </>
      );
    }
    case "seasons": {
      if (months.error) return <Failure error={months.error} />;
      if (!months.data) return <Skeleton />;
      const ms = months.data.months as any[];
      const jul = ms[6], dec = ms[11];
      return (
        <>
          <div className="flex items-end gap-[5px]" role="img" aria-label="Relative observed pixels by calendar month">
            {ms.map((m, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <div className="w-[14px] rounded-sm" style={{ height: `${Math.max(3, m.coverage_relative * 56)}px`, background: i >= 5 && i <= 8 ? "rgb(236 228 216 / 0.25)" : "var(--flame)" }} />
                <span className="text-[10px] text-paper/50">{MONTHS[i]}</span>
              </div>
            ))}
            <div className="ml-4 pb-5 text-[12px] leading-snug text-paper/65">
              July: <span className="num text-paper">{int(jul.pixels)}</span> pixels<br />
              December: <span className="num text-paper">{int(dec.pixels)}</span>
            </div>
          </div>
          {expanded && <Note>Summed over 2023 and 2024. Unobserved months are reported as unobserved, never as zero emission. The seasonal background is removed per day (a 160 km smooth of that day's field) before any source is sought.</Note>}
        </>
      );
    }
    case "anomalies": {
      if (cands.error) return <Failure error={cands.error} />;
      if (!cands.data) return <Skeleton />;
      const top = cands.data.candidates.slice(0, 4);
      const rec = Object.values(cands.data.blind_recovery).filter((b: any) => b.recovered).length;
      return (
        <>
          <Figures items={[["Candidates in India", String(cands.data.count)], ["Known sites found blind", `${rec} of ${Object.keys(cands.data.blind_recovery).length}`], ["Threshold", "3σ robust"]]} />
          <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-[12px]">
            {top.map((c: any, i: number) => (
              <li key={i} className="flex justify-between gap-3 text-paper/75">
                <span>{c.known_site_match?.name ?? c.place_label}</span>
                <span className="num text-flame">z {c.z.toFixed(1)}</span>
              </li>
            ))}
          </ul>
          {expanded && <Note>{cands.data.method}. {cands.data.caveat}</Note>}
        </>
      );
    }
    case "attribution": {
      if (site.error) return <Failure error={site.error} />;
      if (!site.data) return <Skeleton />;
      const s = site.data;
      const g = s.era5?.gamma_100_over_10;
      const ab = s.ablation as Record<string, any>;
      return (
        <>
          <Figures items={[["Overpasses stacked", String(s.n_overpasses)], ["Divergence rate", `${tph(s.rate_kg_h.DIV)} t/h`], ["Significance", `z ${s.z.DIV.toFixed(1)}`]]} />
          <table className="mt-3 text-[12px]">
            <tbody>
              {Object.entries(ab).map(([k, v]) => (
                <tr key={k} className="text-paper/70">
                  <td className="pr-6 capitalize">{k.split("_").slice(1).join(" ").replace("+", "+ ")}</td>
                  <td className={`num text-right ${k.startsWith("5") ? "text-flame" : ""}`}>z {v.DIV.z?.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {expanded && <Note>Jawaharnagar area, 20 km cluster. 68% interval {tph(s.ci68.DIV[0])} to {tph(s.ci68.DIV[1])} t/h at the 10 m wind; ERA5 suggests transport winds about {g}x stronger, so the calibrated rate is higher (R6 pending). Ablation: z against a pseudo-site null, one component added per row.</Note>}
        </>
      );
    }
    case "ledger": {
      if (sites.error) return <Failure error={sites.error} />;
      if (!sites.data) return <Skeleton />;
      const rows = [...sites.data.sites].sort((a: any, b: any) => (b.z.DIV ?? -9) - (a.z.DIV ?? -9));
      return (
        <>
          <table className="w-full text-[12.5px]">
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.slug} className="group">
                  <td className="py-1 pr-4">
                    <Link href={`/site/${r.slug}`} className="text-paper/85 underline-offset-4 transition group-hover:text-paper group-hover:underline">{r.name}</Link>
                  </td>
                  <td className="num py-1 pr-4 text-right text-paper/80">{tph(r.rate_kg_h.DIV)} t/h</td>
                  <td className={`num py-1 text-right ${(r.z.DIV ?? 0) >= 3 ? "text-flame" : "text-paper/45"}`}>z {r.z.DIV?.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {expanded && <Note>Known-site stacks (R3). Rates at the 10 m wind, before calibration. Full national candidate list and downloads are in the inventory.</Note>}
        </>
      );
    }
  }
}
