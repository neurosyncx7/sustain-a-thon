"""R5: test the invented algorithms on REAL data, one at a time, against the frozen final method.

Every test has a pre-declared pass criterion (written here before running) and writes its full
numbers to data-pipeline/r5/<test>.json. Only algorithms that pass are allowed into the integrated
inventory (research/pipeline/run_inventory.py). Failures are recorded, not hidden.

usage: python r5_algorithms.py <data_dir> <out_dir> [test ...]
tests: abd obc wit eiv byfdr diversr pwhhp
"""
from __future__ import annotations

import glob, json, sys, time
from dataclasses import replace
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import ndimage, fft as sfft

ROOT = Path(__file__).resolve().parents[1]
for sub in ("algorithms", "ingestion", "screening"):
    sys.path.insert(0, str(ROOT / sub))
from site_stack import StackConfig, stack_site, quantify, pseudo_sites  # noqa: E402
from india_bbox import KNOWN_SITES, BLIND_REFERENCES  # noqa: E402
from obc import make_injector  # noqa: E402
from wit import wind_invariance_test  # noqa: E402
from eiv_crf import co_ch4_ratio  # noqa: E402
from by_fdr import benjamini_yekutieli  # noqa: E402
import national_screen as ns  # noqa: E402

FINAL = StackConfig()
DETECTED = ("jawaharnagar", "pirana", "khajod", "deonar", "jharia")
INLAND = ("jawaharnagar", "pirana", "jharia", "korba")   # windows with land all round (OSSE hosts)
N_NULL, NULL_SEED = 24, 7


def load_sites(data_dir):
    cache = Path("/tmp/claude-0/allsites.parquet")
    if cache.exists():
        return pd.read_parquet(cache)
    return pd.concat([pd.read_parquet(f) for f in sorted(glob.glob(f"{data_dir}/tropomi/sites/*.parquet"))],
                     ignore_index=True)


def null_stats(pix, s, cfg):
    v = []
    for la, lo in pseudo_sites(s["lat"], s["lon"], n=N_NULL, seed=NULL_SEED):
        v.append(quantify(stack_site(pix, la, lo, cfg))["DIV"])
    v = np.array([x for x in v if np.isfinite(x)])
    return float(v.mean()), float(v.std(ddof=1))


def evaluate(pix, s, cfg):
    q = quantify(stack_site(pix, s["lat"], s["lon"], cfg))["DIV"]
    m, sd = null_stats(pix, s, cfg)
    return dict(rate_kg_h=q, null_mean=m, null_sd=sd, z=(q - m) / sd)


# ------------------------------------------------------------------------------------------ ABD
def t_abd(df):
    """PASS iff adding ABD raises the mean z over the 5 detected sites AND does not raise the mean
    1-sigma floor by more than 5%."""
    res = {}
    for name, cfg in (("final", FINAL), ("final+ABD", replace(FINAL, albedo_correct=True))):
        res[name] = {k: evaluate(df[df.site == k], s, cfg) for k, s in KNOWN_SITES.items()}
    mz = {n: float(np.mean([res[n][k]["z"] for k in DETECTED])) for n in res}
    fl = {n: float(np.mean([res[n][k]["null_sd"] for k in KNOWN_SITES])) for n in res}
    ok = mz["final+ABD"] > mz["final"] and fl["final+ABD"] <= 1.05 * fl["final"]
    return dict(criterion="mean z(5 detected) rises and mean floor not >5% worse",
                mean_z=mz, mean_floor_kg_h=fl, sites=res, status="validated" if ok else "failed")


# ------------------------------------------------------------------------------------------ OBC
Q_LIST = (5000.0, 10000.0, 20000.0, 40000.0)


def t_obc(df):
    """Injection-recovery on real backgrounds. PASS iff recovered DIV is linear in Q (R^2 > 0.9 on
    the per-Q means) and the slope's site-to-site CV < 0.35. Outputs: calibration factor 1/slope,
    its spread, and detection probability P(z>3) vs Q (the honest detection limit)."""
    rows = []
    for k in INLAND:
        s = KNOWN_SITES[k]; pix = df[df.site == k]
        m, sd = null_stats(pix, s, FINAL)
        for la, lo in pseudo_sites(s["lat"], s["lon"], n=6, ring_km=(55.0, 80.0), seed=11):
            base = quantify(stack_site(pix, la, lo, FINAL))["DIV"]
            for q in Q_LIST:
                got = quantify(stack_site(pix, la, lo, replace(FINAL, inject=make_injector(la, lo, q))))["DIV"]
                rows.append(dict(window=k, lat=la, lon=lo, q_inj=q, base=base, got=got,
                                 recovered=got - base, z_inj=(got - m) / sd))
        print("obc", k, flush=True)
    r = pd.DataFrame(rows)
    per_q = r.groupby("q_inj").recovered.agg(["mean", "std"]).reset_index()
    A = np.c_[per_q.q_inj.values]
    slope = float(np.linalg.lstsq(A, per_q["mean"].values, rcond=None)[0][0])
    pred = slope * per_q.q_inj.values
    r2 = float(1 - np.sum((per_q["mean"] - pred) ** 2) / np.sum((per_q["mean"] - per_q["mean"].mean()) ** 2))
    site_slopes = {}
    for k, g in r.groupby("window"):
        site_slopes[k] = float(np.sum(g.recovered * g.q_inj) / np.sum(g.q_inj ** 2))
    ss = np.array(list(site_slopes.values()))
    cv = float(ss.std(ddof=1) / ss.mean())
    # per-injection factor distribution (for Monte Carlo in R6)
    f = (r.recovered / r.q_inj).values
    pdet = r.assign(det=r.z_inj > 3).groupby("q_inj").det.mean().to_dict()
    ok = r2 > 0.9 and cv < 0.35
    return dict(criterion="R^2>0.9 linear recovery and site-slope CV<0.35",
                slope=slope, r2=r2, site_slopes=site_slopes, site_cv=cv,
                calibration_factor=1 / slope, factor_samples=(1 / np.clip(f, 0.05, None)).tolist(),
                recovery_per_q=per_q.to_dict("records"), p_detect_z3={str(int(k)): float(v) for k, v in pdet.items()},
                rows=r.to_dict("records"), status="validated" if ok else "failed")


# ------------------------------------------------------------------------------------------ WIT
def t_wit(df):
    """Calibration and power on real backgrounds, then application to the detected sites.
    size: centred 20 t/h injections at pseudo-sites -> WIT must PASS (reject rate <= 15%).
    power: 20 t/h injected 22 km east of the pseudo-site (a neighbour at the disk edge) -> WIT
    should FAIL (reject rate >= 50%). PASS iff both."""
    size, power, rows = [], [], []
    for k in INLAND:
        s = KNOWN_SITES[k]; pix = df[df.site == k]
        for la, lo in pseudo_sites(s["lat"], s["lon"], n=6, ring_km=(55.0, 80.0), seed=11):
            c = wind_invariance_test(pix, la, lo, replace(FINAL, inject=make_injector(la, lo, 20000.0)), n_boot=80)
            dlon = 22.0 / (111.32 * np.cos(np.radians(la)))
            o = wind_invariance_test(pix, la, lo, replace(FINAL, inject=make_injector(la, lo + dlon, 20000.0)), n_boot=80)
            if c.get("p") is not None: size.append(c["p"] < 0.01)
            if o.get("p") is not None: power.append(o["p"] < 0.01)
            rows.append(dict(window=k, lat=la, lon=lo, centred_p=c.get("p"), offset_p=o.get("p")))
        print("wit", k, flush=True)
    sites = {k: wind_invariance_test(df[df.site == k], s["lat"], s["lon"], FINAL) for k, s in KNOWN_SITES.items()}
    rej_size = float(np.mean(size)) if size else None
    rej_pow = float(np.mean(power)) if power else None
    ok = rej_size is not None and rej_pow is not None and rej_size <= 0.15 and rej_pow >= 0.5
    return dict(criterion="false-reject(centred) <= 15% and reject(offset neighbour) >= 50%",
                false_reject_rate=rej_size, power=rej_pow, trials=rows, sites=sites,
                status="validated" if ok else "failed")


# ------------------------------------------------------------------------------------------ EIV
def t_eiv(df):
    """CO/CH4 molar emission ratio from the co-retrieved CO column, same overpasses.
    Sector boundary: CO/CH4 = 1 (crop/biomass burning ~10; landfill decay/coal/gas << 1).
    PASS iff the 68% interval lies entirely on one side of 1 for >= 3 of the 5 detected sites."""
    out = {}
    for k in DETECTED:
        s = KNOWN_SITES[k]
        out[k] = co_ch4_ratio(df[df.site == k], s["lat"], s["lon"], FINAL)
        print("eiv", k, out[k].get("ratio_ci68"), flush=True)
    inf = [k for k, v in out.items() if v.get("status") == "ok" and np.all(np.isfinite(v["ratio_ci68"]))
           and (v["ratio_ci68"][1] < 1 or v["ratio_ci68"][0] > 1)]
    return dict(criterion="68% CI of CO/CH4 excludes 1 at >= 3 of 5 detected sites",
                informative_sites=inf, sites=out, status="validated" if len(inf) >= 3 else "failed")


# ------------------------------------------------------------------------------------------ national-field tests
def _fields(data_dir, wind_fn=None, tag="base"):
    p = Path(f"/tmp/claude-0/r5_fields_{tag}.npz")
    if p.exists():
        z = np.load(p, allow_pickle=True)
        return {k: z[k] for k in z.files}
    F = ns.compute_fields(sorted(glob.glob(f"{data_dir}/tropomi/grids/*.npz")), wind_fn=wind_fn, log=False)
    F.pop("months")
    np.savez_compressed(p, **F)
    return F


def _extrema(sm, nD, sign=+1, size=9):
    a = np.nan_to_num(sign * sm, nan=-1e30)
    mx = ndimage.maximum_filter(a, size=size)
    return np.argwhere((a == mx) & np.isfinite(sm) & (nD >= 40))


def _km(la1, lo1, la2, lo2):
    return 111.0 * np.hypot(la1 - la2, (lo1 - lo2) * np.cos(np.radians((la1 + la2) / 2)))


def _recovery(cands, refs=("ghazipur", "jawaharnagar", "jharia", "pirana"), key=("lat", "lon")):
    out = {}
    for r in refs:
        s = BLIND_REFERENCES[r]
        d = [(_km(c[key[0]], c[key[1]], s["lat"], s["lon"]), i) for i, c in enumerate(cands)]
        dm, i = min(d) if d else (np.inf, -1)
        out[r] = dict(km=float(dm), rank=i + 1, recovered=bool(dm <= 25))
    return out


def fdr_gate(F, q_max=0.05):
    """BY-FDR on the family of all local maxima (>= 40 valid days); null = local-minimum depths,
    mirrored about the median (same selection effect as the maxima, opposite sign)."""
    sm = ns.nan_gauss(F["meanD"], 1.0)
    med = np.nanmedian(sm)
    mx, mn = _extrema(sm, F["nD"], +1), _extrema(sm, F["nD"], -1)
    t_val = sm[mx[:, 0], mx[:, 1]] - med
    n_val = np.sort(med - sm[mn[:, 0], mn[:, 1]])
    p = (1 + len(n_val) - np.searchsorted(n_val, t_val, side="left")) / (1 + len(n_val))
    q = benjamini_yekutieli(p)
    return sm, med, mx, t_val, n_val, p, q


def t_byfdr(data_dir):
    """PASS iff (a) the sign-flipped control (minima tested against maxima) yields <= 5% as many
    discoveries as the real test, and (b) >= 3 of the 4 blind-recovered references keep q <= 0.05."""
    F = _fields(data_dir)
    sm, med, mx, t_val, n_val, p, q = fdr_gate(F)
    lat_c, lon_c = F["lat_c"], F["lon_c"]
    disc = [dict(lat=float(lat_c[iy]), lon=float(lon_c[ix]), q=float(qq), p=float(pp))
            for (iy, ix), qq, pp in zip(mx, q, p) if qq <= 0.05]
    # control: test minima against maxima-null
    mn = _extrema(sm, F["nD"], -1)
    c_val = med - sm[mn[:, 0], mn[:, 1]]
    c_null = np.sort(t_val)
    cp = (1 + len(c_null) - np.searchsorted(c_null, c_val, side="left")) / (1 + len(c_null))
    cq = benjamini_yekutieli(cp)
    n_ctrl = int((cq <= 0.05).sum())
    rec = _recovery(disc)
    n_ref = sum(v["recovered"] for v in rec.values())
    ok = n_ctrl <= 0.05 * max(len(disc), 1) and n_ref >= 3
    # q for every published candidate (nearest local max)
    cand = json.loads((ROOT.parent / "data-pipeline/web/candidates.json").read_text())["candidates"]
    cq_map = []
    for c in cand:
        i = int(np.argmin([_km(c["lat"], c["lon"], lat_c[iy], lon_c[ix]) for iy, ix in mx]))
        cq_map.append(dict(lat=c["lat"], lon=c["lon"], q=float(q[i]), p=float(p[i])))
    return dict(criterion="sign-flip control discoveries <= 5% of real; >= 3/4 references survive q<=0.05",
                n_family=int(len(mx)), n_null=int(len(n_val)), n_discoveries=len(disc), n_control_discoveries=n_ctrl,
                references=rec, discoveries=disc, candidate_q=cq_map, status="validated" if ok else "failed")


def t_diversr(data_dir):
    """Off-grid localisation (DiverSR-lite): refine each candidate peak with a least-squares 2-D
    quadratic on the 5x5 neighbourhood of the smoothed mean divergence. PASS iff the mean blind
    distance to the recovered references falls and none gets worse by > 2 km."""
    F = _fields(data_dir)
    cands, sm, *_ = ns.find_candidates(F["meanD"], F["nD"], F["lat_c"], F["lon_c"], F["dx"], F["dy"])
    lat_c, lon_c = F["lat_c"], F["lon_c"]
    yy, xx = np.mgrid[-2:3, -2:3]
    A = np.c_[np.ones(25), xx.ravel(), yy.ravel(), xx.ravel() ** 2, yy.ravel() ** 2, (xx * yy).ravel()]
    for c in cands:
        iy, ix = c["_iy"], c["_ix"]
        w = sm[iy - 2:iy + 3, ix - 2:ix + 3]
        c["lat_r"], c["lon_r"] = c["lat"], c["lon"]
        if w.shape != (5, 5) or not np.isfinite(w).all():
            continue
        a = np.linalg.lstsq(A, w.ravel(), rcond=None)[0]
        H = np.array([[2 * a[3], a[5]], [a[5], 2 * a[4]]])
        if np.all(np.linalg.eigvalsh(H) < 0):
            dxy = -np.linalg.solve(H, a[1:3])
            if np.all(np.abs(dxy) <= 1.5):
                c["lat_r"] = float(lat_c[iy] + dxy[1] * 0.1)
                c["lon_r"] = float(lon_c[ix] + dxy[0] * 0.1)
    before = _recovery(cands); after = _recovery(cands, key=("lat_r", "lon_r"))
    got = [k for k in before if before[k]["recovered"]]
    mb = float(np.mean([before[k]["km"] for k in got])); ma = float(np.mean([after[k]["km"] for k in got]))
    worst = max(after[k]["km"] - before[k]["km"] for k in got)
    ok = ma < mb and worst <= 2.0
    return dict(criterion="mean blind distance falls; no reference worse by > 2 km",
                before=before, after=after, mean_km_before=mb, mean_km_after=ma,
                refined=[dict(lat=c["lat"], lon=c["lon"], lat_r=c["lat_r"], lon_r=c["lon_r"]) for c in cands],
                status="validated" if ok else "failed")


def hhp_nondivergent(u, v, lat_c, dx, dy):
    """PW-HHP (unweighted variant; the gridded product has no column mass per wind): remove the
    divergent (irrotational) part of the 10 m wind. Gaps filled by NaN-aware smoothing, Poisson
    solve with Neumann boundaries via DCT, v_nd = v - grad(phi)."""
    m = np.isfinite(u) & np.isfinite(v)
    if m.sum() < 500:
        return u, v
    uf = np.where(m, u, ns.nan_gauss(u, 5)); vf = np.where(m, v, ns.nan_gauss(v, 5))
    uf = np.nan_to_num(uf, nan=np.nanmean(u)); vf = np.nan_to_num(vf, nan=np.nanmean(v))
    dxm = float(np.mean(dx))
    div = np.gradient(uf, dxm, axis=1) + np.gradient(vf, dy, axis=0)
    ny, nx = div.shape
    D = sfft.dctn(div, norm="ortho")
    ky = 2 * (np.cos(np.pi * np.arange(ny) / ny) - 1) / dy ** 2
    kx = 2 * (np.cos(np.pi * np.arange(nx) / nx) - 1) / dxm ** 2
    den = ky[:, None] + kx[None, :]
    den[0, 0] = 1.0
    P = D / den; P[0, 0] = 0.0
    phi = sfft.idctn(P, norm="ortho")
    gu, gv = np.gradient(phi, dxm, axis=1), np.gradient(phi, dy, axis=0)
    return np.where(m, u - gu, np.nan), np.where(m, v - gv, np.nan)


def t_pwhhp(data_dir):
    """PASS iff the national divergence field's robust noise (MAD of the smoothed field) falls by
    >= 5% AND blind recovery does not get worse (same or more references within 25 km)."""
    base = _fields(data_dir)
    hhp = _fields(data_dir, wind_fn=hhp_nondivergent, tag="hhp")
    res = {}
    for name, F in (("final", base), ("final+PW-HHP", hhp)):
        cands, sm, med, mad, thr = ns.find_candidates(F["meanD"], F["nD"], F["lat_c"], F["lon_c"], F["dx"], F["dy"])
        rec = _recovery(cands)
        res[name] = dict(robust_sigma=mad, n_candidates=len(cands), references=rec,
                         n_recovered=sum(v["recovered"] for v in rec.values()))
    ok = (res["final+PW-HHP"]["robust_sigma"] <= 0.95 * res["final"]["robust_sigma"]
          and res["final+PW-HHP"]["n_recovered"] >= res["final"]["n_recovered"])
    return dict(criterion="robust sigma falls >= 5% and blind recovery not worse", variants=res,
                status="validated" if ok else "failed")


TESTS = dict(abd=t_abd, obc=t_obc, wit=t_wit, eiv=t_eiv)
FIELD_TESTS = dict(byfdr=t_byfdr, diversr=t_diversr, pwhhp=t_pwhhp)


def main(data_dir, out_dir, which):
    out = Path(out_dir); out.mkdir(parents=True, exist_ok=True)
    df = None
    for t in which:
        t0 = time.time()
        if t in TESTS:
            if df is None:
                df = load_sites(data_dir)
            r = TESTS[t](df)
        else:
            r = FIELD_TESTS[t](data_dir)
        r["runtime_s"] = round(time.time() - t0, 1)
        r["run_utc"] = pd.Timestamp.now("UTC").isoformat()
        (out / f"{t}.json").write_text(json.dumps(r, indent=1, default=lambda o: o.item() if hasattr(o, "item") else str(o)))
        print(f"== {t}: {r['status']}  ({r['runtime_s']} s)", {k: v for k, v in r.items()
              if k in ("mean_z", "mean_floor_kg_h", "slope", "r2", "site_cv", "p_detect_z3", "false_reject_rate",
                       "power", "informative_sites", "n_discoveries", "n_control_discoveries",
                       "mean_km_before", "mean_km_after")}, flush=True)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3:] or list(TESTS) + list(FIELD_TESTS))
