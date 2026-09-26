"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { refreshLive, useAgo, useLive } from "./useLive";

const ease = [0.16, 1, 0.3, 1] as const;
const BOX = { lon: [68, 97.5], lat: [6.5, 37.5] } as const;
const WF: Record<string, string> = {
  "live.yml": "Live pass (every 3 h)",
  "inventory.yml": "Inventory refresh (daily)",
  "extract-sites.yml": "Site-window extraction",
  "extract-tropomi.yml": "Archive extraction",
};

function PassMap({ texture, sites, stamp }: { texture: any; sites: any[]; stamp: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"loading" | "ok" | "none">("loading");
  useEffect(() => {
    let cancelled = false;
    const c = ref.current!;
    const W = 590, H = 620; c.width = W; c.height = H;
    const ctx = c.getContext("2d")!;
    const px = (lon: number) => ((lon - BOX.lon[0]) / (BOX.lon[1] - BOX.lon[0])) * W;
    const py = (lat: number) => ((BOX.lat[1] - lat) / (BOX.lat[1] - BOX.lat[0])) * H;
    Promise.all([
      fetch("/data/india-outline.json").then((r) => r.json()),
      new Promise<HTMLImageElement | null>((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = `/api/live/texture?v=${encodeURIComponent(stamp)}`; }),
    ]).then(([outline, img]) => {
      if (cancelled) return;
      ctx.clearRect(0, 0, W, H);
      if (img && texture) {
        const off = document.createElement("canvas"); off.width = img.width; off.height = img.height;
        const o = off.getContext("2d")!; o.drawImage(img, 0, 0);
        const d = o.getImageData(0, 0, off.width, off.height);
        for (let i = 0; i < d.data.length; i += 4) {
          const v = d.data[i];
          if (v === 0) { d.data[i + 3] = 0; continue; }
          const t = Math.min(1, Math.max(0, (v - 1) / 254)) ** 1.2;
          d.data[i] = 18 + t * 217; d.data[i + 1] = 33 + t * 213; d.data[i + 2] = 66 + t * 189; d.data[i + 3] = 235;
        }
        o.putImageData(d, 0, 0);
        const [lo0, lo1] = texture.lon_edges, [la0, la1] = texture.lat_edges;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(off, px(lo0), py(la1), px(lo1) - px(lo0), py(la0) - py(la1));
        setState("ok");
      } else setState("none");
      ctx.lineWidth = 1.2; ctx.strokeStyle = "rgba(236,228,216,0.45)";
      for (const poly of outline.polygons) {
        ctx.beginPath();
        poly.forEach(([lon, lat]: [number, number], i: number) => (i ? ctx.lineTo(px(lon), py(lat)) : ctx.moveTo(px(lon), py(lat))));
        ctx.closePath(); ctx.stroke();
      }
      for (const s of sites) {
        const x = px(s.lon), y = py(s.lat);
        ctx.beginPath(); ctx.arc(x, y, s.status === "confirmed" ? 5 : 3.5, 0, Math.PI * 2);
        ctx.strokeStyle = s.status === "confirmed" ? "#6fb4ff" : "rgba(236,228,216,0.8)"; ctx.lineWidth = 1.6; ctx.stroke();
      }
    });
    return () => { cancelled = true; };
  }, [texture, sites, stamp]);
  return (
    <figure className="relative">
      <canvas ref={ref} className="aspect-[590/620] w-full rounded-xl bg-paper/[0.03] [image-rendering:pixelated]" aria-label="Newest TROPOMI pass over India" />
      {state === "none" && <p className="absolute inset-x-6 bottom-6 rounded-lg bg-ink/80 px-3 py-2 text-center text-[12px] text-paper/60 backdrop-blur">No pass texture published yet; the 3-hourly run writes it.</p>}
      {texture && <figcaption className="num mt-2 text-[11px] text-paper/50">XCH4 {texture.lo.toFixed(0)} to {texture.hi.toFixed(0)} ppb, 0.1° grid, qa ≥ 0.5. Rings: inventory sites (blue = confirmed).</figcaption>}
    </figure>
  );
}

function RunChip({ run }: { run: any }) {
  const ago = useAgo(run.updated_utc);
  const tone = run.status !== "completed" ? "text-flame" : run.conclusion === "success" ? "text-paper/80" : "text-[#e39b82]";
  const word = run.status !== "completed" ? (run.status === "queued" ? "queued" : "running") : run.conclusion;
  return (
    <a href={run.url} target="_blank" rel="noreferrer" className={`num inline-flex items-center gap-1.5 text-[12px] underline-offset-4 hover:underline ${tone}`}>
      {run.status !== "completed" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-flame" />}
      {word} · {ago}
    </a>
  );
}

function RunButton({ enabled }: { enabled: boolean }) {
  const [state, setState] = useState<{ phase: "idle" | "sending" | "sent" | "error"; msg?: string }>({ phase: "idle" });
  if (!enabled) return null;
  const go = async () => {
    setState({ phase: "sending" });
    const r = await fetch("/api/pipeline", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workflow: "live.yml" }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setState({ phase: "sent", msg: "Run started on GitHub Actions. It appears below within a minute." }); setTimeout(refreshLive, 8000); }
    else setState({ phase: "error", msg: j.error ?? `HTTP ${r.status}` });
  };
  return (
    <div className="mt-5">
      <button onClick={go} disabled={state.phase === "sending"}
        className="rounded-full bg-paper px-4 py-2 text-[13px] font-medium text-ink transition hover:bg-white active:scale-[0.98] disabled:opacity-60">
        {state.phase === "sending" ? "Starting…" : "Fetch the newest pass now"}
      </button>
      <AnimatePresence>
        {state.msg && (
          <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4, ease }}
            className={`mt-2 text-[12px] ${state.phase === "error" ? "text-[#e39b82]" : "text-paper/65"}`}>{state.msg}</motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

export function LivePanel({ sites }: { sites: any[] }) {
  const { data, error, at } = useLive();
  const pass = data?.latest_pass?.ok ? data.latest_pass.data : null;
  const passAgo = useAgo(pass?.sensing_end);
  const procAgo = useAgo(pass?.processed_utc);
  const mirror = data?.mirror?.ok ? data.mirror.data : null;
  const mirrorAgo = useAgo(mirror?.newest_over_india?.start_utc);
  const polledAgo = useAgo(at ? new Date(at).toISOString() : null);
  const perSite = pass ? Object.entries(pass.sites ?? {}) : [];
  const names = Object.fromEntries(sites.map((s) => [s.slug, s.name]));
  const winds = data?.winds?.ok ? data.winds.data : [];

  return (
    <section id="live" className="mt-20 scroll-mt-24">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-3 text-xl font-medium tracking-tight">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-flame/60 [animation-duration:2.4s]" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-flame" />
          </span>
          Live from orbit
        </h2>
        <p className="num text-[12px] text-paper/45">{error ? `feed error: ${error}` : polledAgo ? `checked ${polledAgo}` : "connecting"}</p>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_1.1fr]">
        <PassMap texture={pass?.texture ?? null} sites={sites.filter((s) => s.status !== "not detected")} stamp={pass?.processed_utc ?? "none"} />

        <div className="min-w-0">
          {!data && !error && <div className="h-40 animate-pulse rounded-xl bg-paper/[0.05]" />}
          {data && (
            <>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <dt className="text-[11px] text-paper/50">Newest pass processed</dt>
                  <dd className="mt-0.5 text-[15px]">{pass ? <>{pass.day} <span className="text-paper/55">· {passAgo}</span></> : <span className="text-paper/55">{String(data.latest_pass.error).startsWith("404") ? "first 3-hourly run in progress" : `unavailable (${data.latest_pass.error})`}</span>}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-paper/50">Orbits</dt>
                  <dd className="num mt-0.5 text-[15px]">{pass?.orbits?.join(", ") || "none"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-paper/50">Clear pixels over India</dt>
                  <dd className="num mt-0.5 text-[15px]">{pass ? pass.pixels.toLocaleString("en-IN") : "none"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-paper/50">Copernicus mirror, newest India orbit</dt>
                  <dd className="mt-0.5 text-[15px]">{mirror?.newest_over_india ? <><span className="num">{mirror.newest_over_india.start_utc.slice(11, 16)} UTC</span> <span className="text-paper/55">· {mirrorAgo}</span></> : <span className="text-paper/55">{data.mirror.ok ? "none today yet" : data.mirror.error}</span>}</dd>
                </div>
              </dl>
              {pass && <p className="mt-3 text-[12px] text-paper/50">{pass.source}. Processed {procAgo}. {pass.stream === "NRTI" ? "Near-real-time stream, about 3 h after sensing." : "Offline stream (NRTI not mirrored at the time)."}</p>}

              {perSite.length > 0 && (
                <div className="mt-7">
                  <h3 className="text-[13px] font-medium text-paper/80">What this pass saw at inventory sites</h3>
                  <table className="mt-2 w-full text-[12.5px]">
                    <thead className="text-left text-[11px] text-paper/45"><tr><th className="pb-1.5 font-normal">Site</th><th className="pb-1.5 text-right font-normal">Pixels ≤30 km</th><th className="pb-1.5 text-right font-normal">vs 60 to 140 km ring</th><th className="pb-1.5 text-right font-normal">This pass, full method</th><th className="pb-1.5 text-right font-normal">Wind</th></tr></thead>
                    <tbody className="divide-y divide-paper/10">
                      {[...perSite].sort((a: any, b: any) => (b[1].method?.rate_kg_h_gamma1 != null ? 1 : 0) - (a[1].method?.rate_kg_h_gamma1 != null ? 1 : 0)).slice(0, 10).map(([slug, v]: any) => (
                        <tr key={slug}>
                          <td className="py-1.5 pr-3 text-paper/80">{names[slug] ?? v.name}</td>
                          <td className="num py-1.5 text-right text-paper/70">{v.pixels}</td>
                          <td className={`num py-1.5 text-right ${(v.enhancement_ppb ?? 0) > 10 ? "text-flame" : "text-paper/70"}`}>{v.enhancement_ppb == null ? "no ring" : `${v.enhancement_ppb > 0 ? "+" : ""}${v.enhancement_ppb.toFixed(1)} ppb`}</td>
                          <td className="num py-1.5 text-right text-paper/70">
                            {v.method?.rate_kg_h_gamma1 != null
                              ? <>{(v.method.rate_kg_h_gamma1 / 1000).toFixed(1)} t/h{v.method.z_single != null && <span className="text-paper/45"> · {v.method.z_single >= 0 ? "+" : ""}{v.method.z_single.toFixed(1)}σ</span>}</>
                              : <span className="text-paper/40">too few pixels</span>}
                          </td>
                          <td className="num py-1.5 text-right text-paper/60">{v.wind_ms.toFixed(1)} m/s</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {pass.method_steps && (
                    <p className="mt-3 text-[11px] leading-relaxed text-paper/50">
                      Run on this pass: {pass.method_steps.join(" → ")}. σ is the single-pass noise (the site&apos;s stacked floor × √overpasses).
                    </p>
                  )}
                  <p className="mt-2 text-[11px] text-paper/45">One pass is a snapshot, not a detection: the inventory needs the stacked record. Clouds and the monsoon often leave sites unobserved.</p>
                </div>
              )}

              {winds.length > 0 && (
                <div className="mt-7">
                  <h3 className="text-[13px] font-medium text-paper/80">Wind right now at the top sites</h3>
                  <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-[12.5px]">
                    {winds.map((w: any) => (
                      <li key={w.slug} className="flex items-center justify-between gap-2 text-paper/75">
                        <span className="truncate">{names[w.slug] ?? w.slug}</span>
                        <span className="num flex items-center gap-1.5 text-paper/60">
                          <svg width="12" height="12" viewBox="0 0 12 12" style={{ transform: `rotate(${(w.from_deg + 180) % 360}deg)` }} aria-hidden><path d="M6 1 L9 8 L6 6.5 L3 8 Z" fill="currentColor" /></svg>
                          {w.speed_ms?.toFixed(1)} m/s
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1.5 text-[11px] text-paper/45">Open-Meteo forecast API, {winds[0]?.time_utc?.replace("T", " ")} UTC. Arrows point downwind.</p>
                </div>
              )}

              <div className="mt-8">
                <h3 className="text-[13px] font-medium text-paper/80">The pipeline, running</h3>
                <ul className="mt-2 divide-y divide-paper/10 text-[12.5px]">
                  {(data.pipeline ?? []).map((w: any) => (
                    <li key={w.workflow} className="flex items-center justify-between gap-3 py-2">
                      <span className="text-paper/75">{WF[w.workflow] ?? w.workflow}</span>
                      {w.ok ? (w.runs[0] ? <RunChip run={w.runs[0]} /> : <span className="text-paper/45">no runs yet</span>) : <span className="text-[12px] text-paper/45">{w.error}</span>}
                    </li>
                  ))}
                </ul>
                <RunButton enabled={Boolean(data.dispatch_enabled)} />
                {data.fx?.ok && <p className="mt-4 text-[11px] text-paper/45">Exchange rate for the priority index: ₹{data.fx.data.rates.INR.toFixed(2)} per US$ (ECB reference, {data.fx.data.date}).</p>}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
