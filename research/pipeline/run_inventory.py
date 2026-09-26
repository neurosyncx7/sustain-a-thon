"""R6: the integrated inventory. Chains ONLY the algorithms that passed R4/R5 (see ALGORITHMS below and
data-pipeline/inventory/algorithms.json), on every real TROPOMI overpass in the archive:

  per site   final stack (wind rotation + footprint drizzle + plane background + monsoon exclusion +
             noise weighting + ABD)  ->  flux-divergence rate (gamma = 1)
             -> 24 pseudo-site empirical null (same overpasses)  ->  z, p (Student-t, 23 dof)
  family     BY-FDR q-values over every tested site (references + unmatched screen candidates)
  rate       Monte Carlo (4000): overpass bootstrap + null-structure noise, x gamma (ERA5 100 m/10 m,
             per site) / OBC recovery slope  ->  calibrated t/h with 16-50-84% bounds
  priority   WRPI Monte Carlo (sector cost + abatable share + GWP20) x P(real) = 1 - q

usage: python run_inventory.py <data_dir> <out_dir> [--gamma gamma.json] [--fx 83.7 --fx-date 2024]
"""
from __future__ import annotations

import argparse, glob, json, os, subprocess, sys, time, zlib
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
for sub in ("algorithms", "ingestion"):
    sys.path.insert(0, str(ROOT / sub))
from site_stack import StackConfig, stack_site, quantify, bootstrap, pseudo_sites  # noqa: E402
from by_fdr import benjamini_yekutieli  # noqa: E402
from wrpi import wrpi_mc  # noqa: E402
from india_bbox import SECTOR  # noqa: E402
from corroborate import corroborate  # noqa: E402
from efa import attribute  # noqa: E402
from eiv_crf import co_ch4_ratio  # noqa: E402
sys.path.insert(0, str(ROOT / "pipeline"))
from protect import encrypt, load_reviews, redact, review_state  # noqa: E402

N_NULL, NULL_SEED, N_BOOT, N_MC = 24, 7, 300, 4000
CFG = StackConfig()   # defaults ARE the validated final method (R4 + R5: ABD, KPW)


def load_windows(data_dir: str, slugs: set[str]) -> pd.DataFrame:
    frames = []
    inv = sorted(glob.glob(f"{data_dir}/tropomi/sites_inv*/*.parquet"))   # sites_inv/, sites_inv-YYYYMMDD/ ...
    for f in inv:
        frames.append(pd.read_parquet(f))
    have = set(pd.concat(frames).site.unique()) if frames else set()
    for f in sorted(glob.glob(f"{data_dir}/tropomi/sites/*.parquet")):     # fallback: reference windows
        d = pd.read_parquet(f)
        frames.append(d[d.site.isin(slugs - have)])
    df = pd.concat(frames, ignore_index=True)
    return df.drop_duplicates(subset=["site", "orbit", "scanline", "ground_pixel"])


def family(sites: dict) -> dict:
    """References + screen candidates that do not coincide with a reference (<= 25 km)."""
    fam = {}
    for slug, s in sites.items():
        if s["kind"] == "reference" or not s.get("known_site_match"):
            fam[slug] = s
    for slug, s in sites.items():
        if s["kind"] == "screen_candidate" and s.get("known_site_match") in fam:
            fam[s["known_site_match"]].setdefault("screen_hits", []).append(
                dict(rank=s["screen_rank"], z=s["screen_z"], lat=s["lat"], lon=s["lon"]))
    return fam


def analyse_site(pix: pd.DataFrame, s: dict) -> dict | None:
    st = stack_site(pix, s["lat"], s["lon"], CFG)
    if st["n_overpasses"] < 10:
        return None
    site_q = quantify(st)
    q = site_q["DIV"]
    null_q = [quantify(stack_site(pix, la, lo, CFG)) for la, lo in pseudo_sites(s["lat"], s["lon"], n=N_NULL, seed=NULL_SEED)]
    nulls = np.array([d["DIV"] for d in null_q])
    nulls = nulls[np.isfinite(nulls)]
    m, sd = float(nulls.mean()), float(nulls.std(ddof=1))
    z = (q - m) / sd
    p = float(stats.t.sf(z / np.sqrt(1 + 1 / len(nulls)), len(nulls) - 1))
    boot = bootstrap(st, n_boot=N_BOOT, samples=True)["DIV"]
    ops = st["overpasses"]
    times = pd.to_datetime([o["time"] for o in ops]).tz_localize(None) if pd.to_datetime([o["time"] for o in ops]).tz is not None else pd.to_datetime([o["time"] for o in ops])
    months = pd.Series(1, index=times.to_period("M").astype(str)).groupby(level=0).sum()
    corr = corroborate(pix, s["lat"], s["lon"], CFG, site_q, null_q, s.get("_screen_km"), N_NULL, NULL_SEED)
    chem = chemistry(pix, s, corr) if z >= 2 else None
    return dict(stack=st, corroboration=corr, chemistry=chem, rate_div_kg_h=float(q), null_mean=m, null_sd=sd, z=float(z), p=p, boot=boot,
                n_overpasses=len(ops), orbits=[str(o["orbit"]) for o in ops],
                first=str(times.min().date()), last=str(times.max().date()),
                overpasses_per_month=months.to_dict(),
                mean_wind10_ms=float(np.mean([o["U10"] for o in ops])))


def chemistry(pix, s, corr):
    """EIV-CRF (validated R5 with the final method): CO/CH4 molar emission ratio from the same overpasses.
    Reported as process evidence only when its 68% interval clears the combustion boundary (ratio 1)."""
    r = co_ch4_ratio(pix, s["lat"], s["lon"], CFG, n_boot=150)
    if r.get("status") != "ok" or not np.all(np.isfinite(r["ratio_ci68"])):
        return dict(status="inconclusive", reason="too few paired overpasses or unstable ratio")
    lo, hi = r["ratio_ci68"]
    co_ok = corr["co"]["passed"]
    if hi < 1:
        cls = "non-combustion: anaerobic decay, coal seam or gas release (CO/CH4 < 1)"
    elif lo > 1 and co_ok:
        cls = "combustion-influenced: fires or burning alongside the methane (CO/CH4 > 1)"
    else:
        cls = None
    return dict(status="classified" if cls else "inconclusive", ratio=r["ratio_median"], ci68=[lo, hi], process=cls,
                n_overpasses=r["n"])


def export_stack(st: dict) -> dict:
    """Plume stack as an embedded 8-bit PNG (128 = zero flux). Partner tier only: it travels inside
    the encrypted inventory, never as a public file."""
    import base64, io
    from PIL import Image
    phi = st["phi"]
    sc = float(np.nanpercentile(np.abs(phi), 99)) or 1.0
    img = np.where(np.isfinite(phi), np.clip(128 + 127 * phi / sc, 1, 255), 0).astype(np.uint8)[::-1]
    buf = io.BytesIO(); Image.fromarray(img, "L").save(buf, format="PNG", optimize=True)
    return dict(png_b64=base64.b64encode(buf.getvalue()).decode(), scale_mol_m_s=sc, x_km=[float(st["xc"][0]), float(st["xc"][-1])],
                y_km=[float(st["yc"][0]), float(st["yc"][-1])], frame="wind-rotated: +x downwind")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("data_dir"); ap.add_argument("out_dir")
    ap.add_argument("--gamma", default=None)
    ap.add_argument("--fx", type=float, default=83.7)
    ap.add_argument("--fx-source", default="RBI reference rate, 2024 annual average (fallback)")
    ap.add_argument("--plain-out", default=None, help="also write the unencrypted full inventory here (never inside the repo)")
    a = ap.parse_args()
    t0 = time.time()
    out = Path(a.out_dir); out.mkdir(parents=True, exist_ok=True)
    reviews = load_reviews(REPO / "data-pipeline/review/decisions.json")

    sites = json.loads((ROOT / "pipeline/inventory_sites.json").read_text())
    fam = family(sites)
    cands = json.loads((REPO / "data-pipeline/web/candidates.json").read_text())["candidates"]
    kmf = lambda a, b, c, d: 111.0 * np.hypot(a - c, (b - d) * np.cos(np.radians((a + c) / 2)))  # noqa: E731
    for slug, s in fam.items():
        s["_screen_km"] = 0.0 if s["kind"] == "screen_candidate" else float(min(kmf(s["lat"], s["lon"], c["lat"], c["lon"]) for c in cands))
    df = load_windows(a.data_dir, set(fam))
    gam = json.loads(Path(a.gamma).read_text()) if a.gamma and Path(a.gamma).exists() else {}
    g_all = [v["gamma"] for v in gam.values() if v.get("gamma")]
    g_default = (float(np.mean(g_all)), float(np.std(g_all) + 0.1)) if g_all else (1.25, 0.15)
    obc = json.loads((REPO / "data-pipeline/r5/obc.json").read_text())
    slope = float(obc["slope"])

    osm_p = REPO / "data-pipeline/inventory/osm.json"
    osm = json.loads(osm_p.read_text()) if osm_p.exists() else {}
    efa_p = REPO / "data-pipeline/r5/efa.json"
    efa_ok = efa_p.exists() and json.loads(efa_p.read_text()).get("status") == "validated"

    # sites are independent: analyse them in parallel (GitHub runners have 4 cores); results are
    # collected in the family's order so the output is identical to a serial run.
    from concurrent.futures import ProcessPoolExecutor
    jobs = [(slug, s, df[df.site == slug]) for slug, s in fam.items()]
    rows = []
    with ProcessPoolExecutor(max_workers=max(1, min(4, os.cpu_count() or 1))) as ex:
        futs = [(slug, s, ex.submit(analyse_site, pix, s)) if not pix.empty else (slug, s, None) for slug, s, pix in jobs]
        for slug, s, f in futs:
            if f is None:
                print("no data", slug); continue
            r = f.result()
            if r is None:
                print("too few overpasses", slug); continue
            r["slug"] = slug; r["meta"] = s
            rows.append(r)
            print(f"{slug:14s} n={r['n_overpasses']:3d} DIV={r['rate_div_kg_h']/1e3:6.1f} t/h z={r['z']:5.2f} p={r['p']:.2g}", flush=True)

    q = benjamini_yekutieli(np.array([r["p"] for r in rows]))
    rng = np.random.default_rng(42)
    inv = []
    for r, qq in zip(rows, q):
        slug, s = r["slug"], r["meta"]
        g = gam.get(slug, {})
        g_mu = g.get("gamma") or g_default[0]
        g_sd = max(g.get("gamma_sd") or 0.0, 0.1) if g.get("gamma") else g_default[1]
        boot = r["boot"][np.isfinite(r["boot"])]
        b = rng.choice(boot, N_MC) + rng.normal(0, r["null_sd"], N_MC) - r["null_mean"]
        rate_t_h = b / 1000.0 * rng.normal(g_mu, g_sd, N_MC) / slope
        pct = [float(np.percentile(rate_t_h, k)) for k in (16, 50, 84)]
        corr = r["corroboration"]
        status = ("confirmed" if qq <= 0.05 and corr["confirming"] else "detected" if (qq <= 0.05 or r["z"] >= 3) else
                  "tentative" if r["z"] >= 2 else "not detected")
        try:
            efa = attribute(s["lat"], s["lon"], osm[slug]) if osm.get(slug) is not None else None
        except Exception as ex:                     # facility data must never sink the inventory
            print("EFA skipped for", slug, repr(ex)[:120]); efa = None
        if slug in SECTOR:
            sector, basis = SECTOR[slug], "cited facility (reference site)"
        elif efa_ok and efa and efa["attributed"]:
            sector, basis = efa["attributed"], f"EFA: OpenStreetMap facilities within 25 km (posterior {efa['posterior'][efa['attributed']]:.2f})"
        elif efa_ok:
            sector, basis = "unattributed", ("EFA: no sector reaches posterior 0.6 from mapped facilities" if efa else "no facility data yet")
        else:
            sector, basis = "unattributed", "not attributed: land-use attribution (EFA) has not passed its validation test yet"
        if not efa_ok:
            efa = None                               # an unvalidated method's output is not shown
        p_real = float(max(0.0, 1.0 - qq)) if status != "not detected" else 0.0
        w = wrpi_mc(rate_t_h, sector, p_real, a.fx, seed=zlib.crc32(slug.encode()))
        inv.append(dict(
            slug=slug, name=s["name"], lat=s["lat"], lon=s["lon"], kind=s["kind"],
            source_reference=s.get("source"), in_india=s.get("in_india", True),
            screen=dict(rank=s.get("screen_rank"), z=s.get("screen_z"), hits=s.get("screen_hits", []), nearest_km=s["_screen_km"]),
            corroboration=corr, review=review_state(slug, reviews),
            status=status, z=r["z"], p=r["p"], q=float(qq),
            rate_gamma1_kg_h=r["rate_div_kg_h"], null_floor_1sigma_kg_h=r["null_sd"],
            rate_t_h=dict(p16=pct[0], p50=pct[1], p84=pct[2], upper_limit_p84=pct[2] if status == "not detected" else None),
            gamma=dict(value=g_mu, sd=g_sd, source="site ERA5" if g.get("gamma") else "mean of sites / prior"),
            obc_slope=slope, sector=sector, sector_basis=basis, attribution=efa, chemistry=r["chemistry"], priority=w,
            evidence=dict(n_overpasses=r["n_overpasses"], first_overpass=r["first"], last_overpass=r["last"],
                          orbits=r["orbits"], overpasses_per_month=r["overpasses_per_month"],
                          mean_wind10_ms=r["mean_wind10_ms"], stack=export_stack(r["stack"]))))

    # VOIT (validated R5 backtest): where would one high-resolution overpass (Carbon Mapper / EMIT /
    # GHGSat) settle the most? VOI = p(1 - p) x rate, p = P(real) from z; only unconfirmed sites.
    from scipy.stats import norm
    for d in inv:
        p_ = float(norm.cdf(d["z"] - 1.5))
        d["tasking"] = dict(voi=(p_ * (1 - p_) * max(d["rate_t_h"]["p50"], 0.0)) if d["status"] != "confirmed" else 0.0, p_real_ramp=p_)
    ranked = sorted([d for d in inv if d["tasking"]["voi"] > 0], key=lambda d: -d["tasking"]["voi"])
    for i, d in enumerate(ranked, 1):
        d["tasking"]["rank"] = i; d["tasking"]["recommend"] = i <= 5

    # rank: detected first, then by median WRPI, then by median avoidable warming
    order = {"confirmed": 0, "detected": 1, "tentative": 2, "not detected": 3}
    inv.sort(key=lambda d: (order[d["status"]], -d["priority"]["wrpi_tco2e20_per_lakh_inr"][1],
                            -d["priority"]["avoidable_tco2e20_per_yr"][1]))
    for i, d in enumerate(inv, 1):
        d["priority_rank"] = i

    try:
        sha = subprocess.check_output(["git", "-C", str(REPO), "rev-parse", "--short", "HEAD"], text=True).strip()
    except Exception:
        sha = None
    spans = [(d["evidence"]["first_overpass"], d["evidence"]["last_overpass"]) for d in inv]
    doc = dict(
        generated_utc=pd.Timestamp.now("UTC").isoformat(), code_version=sha, runtime_s=round(time.time() - t0, 1),
        data_span=dict(first=min(x[0] for x in spans), last=max(x[1] for x in spans)),
        n_pixels=int(len(df)), n_tested=len(inv),
        n_confirmed=sum(d["status"] == "confirmed" for d in inv),
        n_detected=sum(d["status"] in ("confirmed", "detected") for d in inv),
        tiers=dict(confirmed="BY-FDR q <= 0.05 across the whole tested family AND an independent corroboration "
                             "(re-detected in disjoint years, or a second estimator agrees)",
                   detected="BY-FDR q <= 0.05 without corroboration yet, or z >= 3 against the site's own 24 pseudo-site null",
                   tentative="2 <= z < 3", **{"not detected": "z < 2; an 84th-percentile upper limit is reported"}),
        fdr=dict(method="Benjamini-Yekutieli", level=0.05,
                 statement="Among confirmed sites, the expected share of false entries is <= 5% (Benjamini-Yekutieli, valid under arbitrary dependence)."),
        oversight=dict(statement="Entries are machine candidates for human review, not accusations. An analyst or a "
                                 "regulatory partner records every decision (data-pipeline/review/decisions.json).",
                       n_reviewed=sum(d["review"]["state"] != "machine_candidate" for d in inv)),
        fx=dict(inr_per_usd=a.fx, source=a.fx_source),
        method=dict(stack="wind-rotated, footprint-drizzled, plane background, monsoon (Jun-Sep) excluded, "
                          "noise-weighted, albedo/AOT bias removed (ABD)",
                    quantifier="flux divergence within 20 km", null=f"{N_NULL} pseudo-sites 60-90 km, same overpasses",
                    calibration=f"x gamma (ERA5 100 m / 10 m wind) / OBC slope {slope:.3f}",
                    uncertainty=f"Monte Carlo {N_MC}: overpass bootstrap + null structure + gamma"),
        sites=inv)
    key = os.environ.get("INVENTORY_KEY")
    doc["access"] = dict(tier="partner")
    pub = redact(doc)
    pub["access"]["full_package_available"] = bool(key)
    (out / "inventory_public.json").write_text(json.dumps(pub, indent=1, default=float))
    if key:
        (out / "inventory.enc.json").write_text(json.dumps(encrypt(doc, key)))
        (out / "inventory_full.json").unlink(missing_ok=True)
    else:
        # demo mode (no key configured): the full package is kept as a server-side file that the web
        # app releases only after partner sign-in; it is never served to public visitors.
        (out / "inventory.enc.json").unlink(missing_ok=True)
        (out / "inventory_full.json").write_text(json.dumps(doc, indent=1, default=float))
        print("INVENTORY_KEY not set: full package written unencrypted for the sign-in gated partner view")
    if a.plain_out:
        Path(a.plain_out).write_text(json.dumps(doc, indent=1, default=float))
    stale = out / "inventory.json"
    if stale.exists():
        stale.unlink()        # the unredacted file must never sit in the public repository
    print(f"inventory: {len(inv)} sites, {doc['n_confirmed']} confirmed, {doc['n_detected']} detected, {doc['runtime_s']} s")


if __name__ == "__main__":
    main()
