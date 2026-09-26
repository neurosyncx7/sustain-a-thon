"use client";

import Link from "next/link";
import { useApi } from "@/lib/useData";
import { useAgo, useLive } from "@/components/live/useLive";
import type { Stage } from "@/content/stages";

const int = (n: number) => n.toLocaleString("en-IN");
const tph = (kg: number) => (kg / 1000).toFixed(1);
const mega = (x: number) => (x >= 1e6 ? `${(x / 1e6).toFixed(1)} M` : int(Math.round(x)));
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
  const inv = useApi("/api/inventory");

  switch (slug) {
    case "prologue": {
      if (ov.error) return <Failure error={ov.error} />;
      if (!ov.data) return <Skeleton />;
      const d = ov.data, v = d.inventory;
      return (
        <>
          <Figures items={[
            ["Confirmed in India", `${v.n_confirmed_india} of ${v.n_tested_india} tested`],
            ["Clear pixels read", mega(v.n_pixels)],
            ["Record", `${v.data_span.first.slice(0, 4)} to today`],
          ]} />
          <LiveLine />
          {expanded && <Note>Real Sentinel-5P TROPOMI data from {v.data_span.first} to {v.data_span.last} (monsoon months excluded), refreshed daily; another {v.n_confirmed - v.n_confirmed_india} confirmed sources lie across the border in Pakistan and Bangladesh. {d.algorithms.running.length} of our algorithms run on it, each validated against a pass mark set before the test.</Note>}
        </>
      );
    }
    case "ingest":
      return <IngestEvidence expanded={expanded} />;
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
          <p className="mt-2 text-[12px] text-paper/55">Mean column methane, {mega(ov.data.inventory.n_pixels)} clear pixels, 0.1° grid</p>
          {ov.data.ablation_floor_t_h && (() => {
            const f = ov.data.ablation_floor_t_h as Record<string, number>;
            const k = Object.keys(f);
            return <Figures items={[["Detection floor, raw", `${f[k[0]].toFixed(1)} t/h`], ["After ABD", `${f["6_+ABD"]?.toFixed(1) ?? "–"} t/h`], ["Full method", `${f[k[k.length - 1]].toFixed(1)} t/h`]]} />;
          })()}
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
          <p className="mt-2 text-[12px] text-paper/65">Found with no list given: {Object.values(cands.data.blind_recovery).filter((b: any) => b.recovered).map((b: any) => `${b.name.split(",")[0]} (${b.nearest_candidate_km} km)`).join(", ")}</p>
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
      const s = site.data.r3, e = site.data.inventory;
      const ab = site.data.ablation as Record<string, any>;
      const keys = Object.keys(ab);
      return (
        <>
          <Figures items={[["Overpasses stacked", String(e?.evidence.n_overpasses ?? s.n_overpasses)], ["Calibrated rate", e ? `${e.rate_t_h.p50.toFixed(1)} t/h` : `${tph(s.rate_kg_h.DIV)} t/h`], ["Significance", `z ${(e?.z ?? s.z.DIV).toFixed(1)}`]]} />
          <table className="mt-3 text-[12px]">
            <tbody>
              {keys.map((k) => (
                <tr key={k} className="text-paper/70">
                  <td className="pr-6 capitalize">{k.split("_").slice(1).join(" ").replace("+", "+ ")}</td>
                  <td className={`num text-right ${k === keys.at(-1) ? "text-flame" : ""}`}>z {ab[k].DIV.z?.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {e?.chemistry?.ratio != null && (
            <p className="mt-2 text-[12px] text-paper/60">CO/CH₄ ratio <span className="num text-paper/85">{e.chemistry.ratio.toFixed(2)}</span>{e.chemistry.process ? `: ${e.chemistry.process.split(":")[0]}` : " (inconclusive)"} · {e.corroboration.n_passed} of 4 independent checks passed</p>
          )}
          {expanded && e && <Note>Jawaharnagar area, 20 km cluster. {e.rate_t_h.p16.toFixed(1)} to {e.rate_t_h.p84.toFixed(1)} t/h (68%) after the transport-wind factor ({e.gamma.value.toFixed(2)}, ERA5) and the injection-recovery slope ({e.obc_slope.toFixed(3)}). Ablation: z against a pseudo-site null, one component added per row.</Note>}
        </>
      );
    }
    case "ledger": {
      if (inv.error) return <Failure error={inv.error} />;
      if (!inv.data) return <Skeleton />;
      const rows = inv.data.sites.filter((r: any) => r.status !== "not detected").slice(0, 7);
      return (
        <>
          <table className="w-full text-[12.5px]">
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.slug} className="group">
                  <td className="num py-1 pr-3 text-paper/45">{String(r.priority_rank).padStart(2, "0")}</td>
                  <td className="py-1 pr-4">
                    <Link href={`/site/${r.slug}`} className="text-paper/85 underline-offset-4 transition group-hover:text-paper group-hover:underline">{r.name}</Link>
                  </td>
                  <td className="num py-1 pr-4 text-right text-paper/80">{r.rate_t_h.p50.toFixed(1)} t/h</td>
                  <td className={`py-1 text-right text-[11px] ${r.status === "confirmed" ? "text-flame" : "text-paper/55"}`}>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {expanded && <Note>Ranked by warming avoided per rupee, weighted by the chance the source is real. {inv.data.fdr.statement} TROPOMI {inv.data.data_span.first} to {inv.data.data_span.last}.</Note>}
        </>
      );
    }
  }
}

function LiveLine() {
  const { data } = useLive();
  const pass = data?.latest_pass?.ok ? data.latest_pass.data : null;
  const ago = useAgo(pass?.sensing_end ?? null);
  if (!pass) return null;
  return (
    <p className="mt-3 flex items-center gap-2 text-[12px] text-paper/65">
      <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-flame/60" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-flame" /></span>
      Newest pass processed: orbit{pass.orbits.length > 1 ? "s" : ""} {pass.orbits.join(", ")}, sensed {ago}
    </p>
  );
}

function IngestEvidence({ expanded }: { expanded: boolean }) {
  const { data, error } = useLive();
  const pass = data?.latest_pass?.ok ? data.latest_pass.data : null;
  const ago = useAgo(pass?.sensing_end ?? null);
  if (error && !data) return <Failure error={error} />;
  if (!data) return <Skeleton />;
  if (!pass) return <p className="text-[12px] text-paper/60">The 3-hourly live pass has not published yet.</p>;
  const i = pass.integrity ?? {};
  return (
    <>
      <Figures items={[
        ["Newest pass", `${pass.day} · ${ago}`],
        ["Files checked vs Copernicus", i.verified != null ? `${i.verified} verified` : "–"],
        ["Clear pixels", int(pass.pixels)],
      ]} />
      {expanded && <Note>{pass.source}. Orbits {pass.orbits.join(", ")}. The sundial&apos;s shadow is computed, not painted: a solar ephemeris drives the scene&apos;s sun, and the gnomon is inclined at Jaipur&apos;s latitude, so its edge reads true solar time.</Note>}
    </>
  );
}
