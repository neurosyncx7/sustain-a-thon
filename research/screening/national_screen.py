"""
National screen on real data: per-day flux divergence on the 0.1-degree India grids, averaged over
2023-2024, plus monthly coverage statistics. Produces the small web products under
data-pipeline/web/ and web/public/data/ (textures). Inputs: the `data` branch grids (daily XCH4,
dry-air column, ECMWF u/v, pixel count) written by research/ingestion/extract_month.py.

Per day d:
  bg_d    = NaN-aware Gaussian smooth of XCH4 (sigma = 1.5 deg ~ 160 km): the regional background
            (seasonal/agricultural field + large-scale gradients), recomputed every day.
  dO_d    = (XCH4 - bg_d) * 1e-9 * N_air                      [mol m^-2]
  D_d     = d(dO_d u)/dx + d(dO_d v)/dy (central differences)  [mol m^-2 s^-1]
Mean over days where the cell and its 4 neighbours are observed. Positive D = persistent source.
Winds are TROPOMI's ECMWF 10 m winds (gamma=1); same convention as R3.
Candidates: local maxima of the 3x3-smoothed mean D above 3 robust sigma with >= 40 valid days,
each reported with its integrated rate within 20 km and its day count. Candidates are screening
leads (status "candidate"), not attributed facilities.
"""
from __future__ import annotations
import glob, json, sys
from pathlib import Path
import numpy as np
from scipy import ndimage

M = 16.04e-3
R_EARTH = 6.371e6


def nan_gauss(a, sigma):
    v = np.isfinite(a)
    num = ndimage.gaussian_filter(np.where(v, a, 0.0), sigma, mode="nearest")
    den = ndimage.gaussian_filter(v.astype(float), sigma, mode="nearest")
    with np.errstate(invalid="ignore", divide="ignore"):
        return np.where(den > 0.15, num / den, np.nan)


def compute_fields(files, wind_fn=None, log=True):
    """Mean daily flux divergence over all grid files. wind_fn(u, v, lat_c, dx, dy) -> (u, v) lets R5
    test wind pre-processing (e.g. PW-HHP Helmholtz projection) with everything else identical."""
    first = np.load(files[0])
    lat_e, lon_e = first["lat_edges"], first["lon_edges"]
    lat_c = (lat_e[:-1] + lat_e[1:]) / 2; lon_c = (lon_e[:-1] + lon_e[1:]) / 2
    NY, NX = len(lat_c), len(lon_c)
    dy = np.deg2rad(0.1) * R_EARTH
    dx = (np.deg2rad(0.1) * R_EARTH * np.cos(np.deg2rad(lat_c)))[:, None]

    sumD = np.zeros((NY, NX)); nD = np.zeros((NY, NX))
    sumX = np.zeros((NY, NX)); nX = np.zeros((NY, NX))
    sumR = np.zeros((NY, NX))
    months = []
    for f in files:
        z = np.load(f)
        X, A, U, V, C = z["xch4"], z["dry_air"], z["u"], z["v"], z["count"]
        obs_cells = []
        for d in range(X.shape[0]):
            x = X[d].astype(float)
            ok = np.isfinite(x)
            obs_cells.append(int(ok.sum()))
            if ok.sum() < 500:
                continue
            u, v = U[d].astype(float), V[d].astype(float)
            if wind_fn is not None:
                u, v = wind_fn(u, v, lat_c, dx, dy)
            bg = nan_gauss(x, 15)
            res = x - bg
            dO = res * 1e-9 * A[d]
            Fx, Fy = dO * u, dO * v
            D = np.full((NY, NX), np.nan)
            D[1:-1, 1:-1] = ((Fx[1:-1, 2:] - Fx[1:-1, :-2]) / (2 * dx[1:-1]) +
                             (Fy[2:, 1:-1] - Fy[:-2, 1:-1]) / (2 * dy))
            g = np.isfinite(D)
            sumD[g] += D[g]; nD[g] += 1
            r = np.isfinite(res)
            sumR[r] += res[r]; sumX[ok] += x[ok]; nX[ok] += 1
        month = Path(f).stem[:7]          # month files (YYYY-MM) and live day files (YYYY-MM-DD)
        rec = dict(month=month, days=int(X.shape[0]), pixels=int(C.sum()),
                   obs_sum=float(np.sum(obs_cells)), x_sum=float(np.nansum(X)), x_n=int(np.isfinite(X).sum()))
        if months and months[-1]["month"] == month:
            for k in ("days", "pixels", "obs_sum", "x_sum", "x_n"):
                months[-1][k] += rec[k]
        else:
            months.append(rec)
        if log:
            print(Path(f).stem, rec["pixels"], flush=True)
    for m in months:
        m["mean_observed_cells"] = m.pop("obs_sum") / m["days"] if m["days"] else 0.0
        xs, xn = m.pop("x_sum"), m.pop("x_n")
        m["mean_xch4"] = xs / xn if xn else None

    with np.errstate(invalid="ignore", divide="ignore"):
        meanD = np.where(nD >= 20, sumD / nD, np.nan)
        meanX = np.where(nX >= 20, sumX / nX, np.nan)
        meanR = np.where(nX >= 20, sumR / nX, np.nan)
    return dict(meanD=meanD, meanX=meanX, meanR=meanR, nD=nD, lat_c=lat_c, lon_c=lon_c,
                lat_e=lat_e, lon_e=lon_e, dx=dx, dy=dy, months=months)


def find_candidates(meanD, nD, lat_c, lon_c, dx, dy, z_min=3.0):
    NX = len(lon_c)
    sm = nan_gauss(meanD, 1.0)
    med = np.nanmedian(sm); mad = 1.4826 * np.nanmedian(np.abs(sm - med))
    thresh = med + z_min * mad
    mx = ndimage.maximum_filter(np.nan_to_num(sm, nan=-1e9), size=9)
    peaks = np.argwhere((sm == mx) & (sm > thresh) & (nD >= 40))
    cands = []
    for iy, ix in peaks:
        la, lo = float(lat_c[iy]), float(lon_c[ix])
        yy, xx = np.meshgrid(lat_c, lon_c, indexing="ij")
        dist = np.hypot((yy - la) * 111.0, (xx - lo) * 111.0 * np.cos(np.deg2rad(la)))
        disk = (dist <= 20) & np.isfinite(meanD)
        area = (dx * dy * np.ones((1, NX)))[disk]
        rate = float(np.sum(meanD[disk] * area) * M * 3600)
        cands.append(dict(lat=round(la, 2), lon=round(lo, 2), z=float((sm[iy, ix] - med) / mad),
                          rate_kg_h_gamma1=rate, valid_days=int(nD[iy, ix]), status="candidate",
                          _iy=int(iy), _ix=int(ix)))
    cands.sort(key=lambda c: -c["z"])
    return cands, sm, float(med), float(mad), float(thresh)


def main(data_dir: str, out_dir: str, tex_dir: str):
    files = sorted(glob.glob(f"{data_dir}/tropomi/grids/*.npz"))
    F = compute_fields(files)
    meanD, meanX, meanR, nD = F["meanD"], F["meanX"], F["meanR"], F["nD"]
    lat_c, lon_c, lat_e, lon_e, dx, dy, months = (F[k] for k in ("lat_c", "lon_c", "lat_e", "lon_e", "dx", "dy", "months"))

    # fields kept for the R5 BY-FDR gate (research-only; not read by the web)
    fdir = Path(out_dir).parent / "screen"; fdir.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(fdir / "fields.npz", meanD=meanD, nD=nD, lat_c=lat_c, lon_c=lon_c)

    cands, sm, med, mad, thresh = find_candidates(meanD, nD, lat_c, lon_c, dx, dy)
    for c in cands:
        c.pop("_iy"); c.pop("_ix")

    out = Path(out_dir); out.mkdir(parents=True, exist_ok=True)
    (out / "months.json").write_text(json.dumps(months, indent=1))
    (out / "candidates.json").write_text(json.dumps(dict(
        method="mean daily flux divergence, 0.1 deg, 2023-2024, 3 robust-sigma local maxima",
        threshold_mol_m2_s=float(thresh), candidates=cands[:60]), indent=1))
    print("candidates", len(cands))

    # textures: 8-bit PNGs with scale metadata (north up, west left)
    from PIL import Image
    tex = Path(tex_dir); tex.mkdir(parents=True, exist_ok=True)
    def save(a, name, lo, hi):
        v = np.clip((a - lo) / (hi - lo), 0, 1)
        img = np.where(np.isfinite(a), (v * 254 + 1), 0).astype(np.uint8)[::-1]  # 0 = no data
        Image.fromarray(img, "L").save(tex / f"{name}.png")
        return dict(file=f"/data/{name}.png", lo=lo, hi=hi, nodata=0)
    meta = dict(lat_edges=[float(lat_e[0]), float(lat_e[-1])], lon_edges=[float(lon_e[0]), float(lon_e[-1])])
    dlo, dhi = [float(x) for x in np.nanpercentile(meanD, [2, 99.5])]
    meta["xch4_mean"] = save(meanX, "xch4_mean", *[float(x) for x in np.nanpercentile(meanX, [1, 99])])
    meta["residual_mean"] = save(meanR, "residual_mean", *[float(x) for x in np.nanpercentile(meanR, [1, 99])])
    meta["divergence_mean"] = save(meanD, "divergence_mean", dlo, dhi)
    meta["units"] = dict(xch4_mean="ppb", residual_mean="ppb", divergence_mean="mol m-2 s-1 (gamma=1)")
    (out / "maps.json").write_text(json.dumps(meta, indent=1))


if __name__ == "__main__":
    main(*sys.argv[1:4])
