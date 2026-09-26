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


def main(data_dir: str, out_dir: str, tex_dir: str):
    files = sorted(glob.glob(f"{data_dir}/tropomi/grids/*.npz"))
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
            bg = nan_gauss(x, 15)
            res = x - bg
            dO = res * 1e-9 * A[d]
            Fx, Fy = dO * U[d], dO * V[d]
            D = np.full((NY, NX), np.nan)
            D[1:-1, 1:-1] = ((Fx[1:-1, 2:] - Fx[1:-1, :-2]) / (2 * dx[1:-1]) +
                             (Fy[2:, 1:-1] - Fy[:-2, 1:-1]) / (2 * dy))
            g = np.isfinite(D)
            sumD[g] += D[g]; nD[g] += 1
            r = np.isfinite(res)
            sumR[r] += res[r]; sumX[ok] += x[ok]; nX[ok] += 1
        month = Path(f).stem
        months.append(dict(month=month, days=int(X.shape[0]), pixels=int(C.sum()),
                           mean_observed_cells=float(np.mean(obs_cells)) if obs_cells else 0.0,
                           mean_xch4=float(np.nanmean(X)) if np.isfinite(X).any() else None))
        print(month, months[-1], flush=True)

    with np.errstate(invalid="ignore", divide="ignore"):
        meanD = np.where(nD >= 20, sumD / nD, np.nan)
        meanX = np.where(nX >= 20, sumX / nX, np.nan)
        meanR = np.where(nX >= 20, sumR / nX, np.nan)

    # candidates
    sm = nan_gauss(meanD, 1.0)
    med = np.nanmedian(sm); mad = 1.4826 * np.nanmedian(np.abs(sm - med))
    thresh = med + 3 * mad
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
                          rate_kg_h_gamma1=rate, valid_days=int(nD[iy, ix]), status="candidate"))
    cands.sort(key=lambda c: -c["z"])

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
