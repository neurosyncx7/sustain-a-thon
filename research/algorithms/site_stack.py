"""
R3 engine: wind-rotated, footprint-drizzled multi-overpass stacking around a candidate site,
and three emission quantifiers evaluated on the *same* stack so they can be compared fairly.

Why stack: research/derivations/continuity_equation.md + the detection-floor estimate show a
~5 t/h landfill produces ~17 ppb in one TROPOMI pixel, i.e. at the single-overpass noise
level. Stacking N wind-aligned overpasses lowers noise ~1/sqrt(N) while the plume stays put.

Stacked quantity: Phi = dOmega * U  [mol m^-2 * m s^-1 = mol m^-1 s^-1]. For a steady source
dOmega ~ Q/U, so dOmega*U is linear in Q and is the correct thing to average across overpasses
with different wind speeds (averaging dOmega and U separately is biased).

Quantifiers on the stacked Phi field (rotated frame: wind along +x):
  IME           Q = sum_{disk R}(Phi) dA / L_eff,   L_eff = sqrt(pi R^2)
  CSF (cross-sectional flux)  F(x) = sum_y Phi(x,y) dy ; Q = mean_{x in plateau} F - mean_{upwind} F
  DIV (divergence, Gauss)     Q = sum_{disk R} dPhi/dx dA   (dy-term vanishes: v=0 in rotated frame)
All three share the same background, winds, and overpasses; differences between them are then
method differences, not data differences.

Significance: identical stacks centred on pseudo-sites (points 60-90 km from the site, same
overpasses) give an empirical null distribution for each quantifier -> z-score and p-value.

Wind: TROPOMI L2 carries ECMWF 10 m winds per pixel. Plume transport happens in the mixed
layer, so U_eff = gamma * U10 with gamma>1; every rate is reported with gamma explicit
(estimated per site from real ERA5 100 m / 10 m wind ratios, see research/ingestion/fetch_era5.py)
so the dominant, well-known wind-height uncertainty stays visible rather than buried.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

M_CH4 = 16.04e-3  # kg/mol
PPB = 1e-9
KM = 1000.0


@dataclass
class StackConfig:
    cell_km: float = 2.0
    x_range: tuple[float, float] = (-50.0, 90.0)   # along-wind
    y_range: tuple[float, float] = (-50.0, 50.0)   # cross-wind
    bg_inner_km: float = 60.0
    bg_outer_km: float = 140.0
    wind_radius_km: float = 30.0
    min_pixels_near: int = 6        # pixels within 15 km of site needed to use an overpass
    min_wind_ms: float = 1.0        # below this the rotation is meaningless
    drizzle_sub: int = 4            # sub-samples per pixel edge (footprint oversampling)
    # ablation switches (R4). Defaults = the full method.
    rotate: bool = True             # wind-rotate each overpass before stacking
    background: str = "plane"       # "plane" (local robust plane) | "global" (one scene median)
    drizzle: bool = True            # spread each pixel over its real footprint
    season_mask: tuple = ()         # months (1-12) to exclude, e.g. monsoon (6,7,8,9)
    quality_weight: bool = False    # weight overpasses by 1/sigma^2 of their background residual


def _local_xy(lat, lon, lat0, lon0):
    x = (lon - lon0) * 111.32 * np.cos(np.radians(lat0))
    y = (lat - lat0) * 110.57
    return x, y


def _plane_background(x, y, val, r, inner, outer):
    """Robust plane fit (value = a + b x + c y) on the background annulus; returns a callable."""
    m = (r >= inner) & (r <= outer) & np.isfinite(val)
    if m.sum() < 30:
        return None
    A = np.c_[np.ones(m.sum()), x[m], y[m]]
    v = val[m]
    coef = np.linalg.lstsq(A, v, rcond=None)[0]
    for _ in range(3):  # iterative 2.5-sigma clipping so other plumes don't bias the plane
        res = v - A @ coef
        s = 1.4826 * np.median(np.abs(res - np.median(res)))
        keep = np.abs(res) < 2.5 * max(s, 1e-12)
        if keep.sum() < 20:
            break
        coef = np.linalg.lstsq(A[keep], v[keep], rcond=None)[0]
    return lambda xx, yy: coef[0] + coef[1] * xx + coef[2] * yy


def _drizzle_points(df, lat0, lon0, sub):
    """Bilinear sub-sampling inside each pixel's real footprint polygon (corners c0..c3)."""
    cx, cy = [], []
    for k in range(4):
        xk, yk = _local_xy(df[f"lat_c{k}"].values, df[f"lon_c{k}"].values, lat0, lon0)
        cx.append(xk)
        cy.append(yk)
    t = (np.arange(sub) + 0.5) / sub
    s_, t_ = np.meshgrid(t, t, indexing="ij")
    s_, t_ = s_.ravel(), t_.ravel()
    # corners ordered around the polygon: c0-c1-c2-c3
    w0 = (1 - s_) * (1 - t_); w1 = s_ * (1 - t_); w2 = s_ * t_; w3 = (1 - s_) * t_
    X = (np.outer(cx[0], w0) + np.outer(cx[1], w1) + np.outer(cx[2], w2) + np.outer(cx[3], w3))
    Y = (np.outer(cy[0], w0) + np.outer(cy[1], w1) + np.outer(cy[2], w2) + np.outer(cy[3], w3))
    return X, Y  # shape (npix, sub*sub)


def stack_site(pix: pd.DataFrame, lat0: float, lon0: float, cfg: StackConfig = StackConfig(),
               seed_label: str = "site") -> dict:
    """pix: pixel rows (extract_month.py site schema) around one centre, many overpasses."""
    nx = int(round((cfg.x_range[1] - cfg.x_range[0]) / cfg.cell_km))
    ny = int(round((cfg.y_range[1] - cfg.y_range[0]) / cfg.cell_km))
    sum_phi = np.zeros((ny, nx)); sum_w = np.zeros((ny, nx))
    per_overpass = []

    for orbit, g in pix.groupby("orbit"):
        if cfg.season_mask and pd.Timestamp(g.time.iloc[0]).month in cfg.season_mask:
            continue
        x, y = _local_xy(g.lat.values, g.lon.values, lat0, lon0)
        r = np.hypot(x, y)
        if (r < 15).sum() < cfg.min_pixels_near:
            continue
        near = r < cfg.wind_radius_km
        u10, v10 = float(np.nanmean(g.u.values[near])), float(np.nanmean(g.v.values[near]))
        U = float(np.hypot(u10, v10))
        if not np.isfinite(U) or U < cfg.min_wind_ms:
            continue
        if cfg.background == "plane":
            bg = _plane_background(x, y, g.xch4.values.astype(float), r, cfg.bg_inner_km, cfg.bg_outer_km)
            if bg is None:
                continue
        else:
            med = float(np.nanmedian(g.xch4.values))
            bg = lambda xx, yy, m=med: np.full_like(xx, m, dtype=float)  # noqa: E731
        dX = g.xch4.values - bg(x, y)                              # ppb
        dOmega = dX * PPB * g.dry_air.values                        # mol/m^2
        phi = dOmega * U                                            # mol m^-1 s^-1

        if cfg.drizzle:
            X, Y = _drizzle_points(g, lat0, lon0, cfg.drizzle_sub)
        else:
            X, Y = x[:, None], y[:, None]
        th = np.arctan2(v10, u10) if cfg.rotate else 0.0
        Xr = X * np.cos(th) + Y * np.sin(th)
        Yr = -X * np.sin(th) + Y * np.cos(th)
        ix = np.floor((Xr - cfg.x_range[0]) / cfg.cell_km).astype(int)
        iy = np.floor((Yr - cfg.y_range[0]) / cfg.cell_km).astype(int)
        ok = (ix >= 0) & (ix < nx) & (iy >= 0) & (iy < ny) & np.isfinite(phi)[:, None]
        w = 1.0 / X.shape[1]
        if cfg.quality_weight:
            ann = (r >= cfg.bg_inner_km) & (r <= cfg.bg_outer_km)
            res = dX[ann]
            sig = 1.4826 * np.nanmedian(np.abs(res - np.nanmedian(res))) if ann.sum() > 10 else np.nan
            if not np.isfinite(sig) or sig <= 0:
                continue
            w = w / (sig * sig) * 100.0
        vals = np.broadcast_to(phi[:, None], X.shape)
        op_phi = np.zeros((ny, nx)); op_w = np.zeros((ny, nx))
        np.add.at(op_phi, (iy[ok], ix[ok]), vals[ok] * w)
        np.add.at(op_w, (iy[ok], ix[ok]), w)
        sum_phi += op_phi; sum_w += op_w
        per_overpass.append(dict(orbit=orbit, time=g.time.iloc[0], U10=U, u10=u10, v10=v10,
                                 n_pix=len(g), phi=op_phi, w=op_w))

    with np.errstate(invalid="ignore", divide="ignore"):
        mean_phi = np.where(sum_w > 0, sum_phi / sum_w, np.nan)
    xc = cfg.x_range[0] + (np.arange(nx) + 0.5) * cfg.cell_km
    yc = cfg.y_range[0] + (np.arange(ny) + 0.5) * cfg.cell_km
    return dict(label=seed_label, phi=mean_phi, weight=sum_w, xc=xc, yc=yc, cfg=cfg,
                overpasses=per_overpass, n_overpasses=len(per_overpass))


def _fill(a):
    return np.where(np.isfinite(a), a, 0.0)


def quantify(stack: dict, R_km: float = 20.0) -> dict:
    """Three quantifiers on one stack; rates in kg/h at gamma=1 (multiply by gamma)."""
    phi, xc, yc, c = stack["phi"], stack["xc"], stack["yc"], stack["cfg"].cell_km
    if stack["n_overpasses"] == 0 or not np.isfinite(phi).any():
        return dict(IME=np.nan, CSF=np.nan, DIV=np.nan)
    XX, YY = np.meshgrid(xc, yc)
    dA = (c * KM) ** 2
    disk = np.hypot(XX, YY) <= R_km
    ime_mol_s = np.nansum(np.where(disk, phi, np.nan)) * dA / (np.sqrt(np.pi) * R_km * KM)

    band = np.abs(yc) <= 30.0
    F = np.nansum(_fill(phi[band, :]), axis=0) * c * KM              # mol/s at each x
    plateau = (xc >= 5) & (xc <= 40)
    upwind = (xc >= -40) & (xc <= -15)
    csf_mol_s = np.nanmean(F[plateau]) - np.nanmean(F[upwind])

    dphidx = np.gradient(_fill(phi), c * KM, axis=1)                  # mol m^-2 s^-1
    div_mol_s = np.nansum(np.where(disk, dphidx, 0.0)) * dA

    k = M_CH4 * 3600.0
    return dict(IME=ime_mol_s * k, CSF=csf_mol_s * k, DIV=div_mol_s * k)


def pseudo_sites(lat0, lon0, n=8, ring_km=(60.0, 90.0), seed=0):
    rng = np.random.default_rng(seed)
    ang = np.linspace(0, 2 * np.pi, n, endpoint=False) + rng.uniform(0, 2 * np.pi / n)
    rad = rng.uniform(*ring_km, size=n)
    dlat = rad * np.sin(ang) / 110.57
    dlon = rad * np.cos(ang) / (111.32 * np.cos(np.radians(lat0)))
    return list(zip(lat0 + dlat, lon0 + dlon))


def bootstrap(stack: dict, n_boot: int = 300, R_km: float = 20.0, seed: int = 1) -> dict:
    """Resample overpasses with replacement -> sampling uncertainty of each quantifier."""
    ops = stack["overpasses"]
    if len(ops) < 3:
        return {}
    rng = np.random.default_rng(seed)
    out = {"IME": [], "CSF": [], "DIV": []}
    for _ in range(n_boot):
        idx = rng.integers(0, len(ops), len(ops))
        sp = sum(ops[i]["phi"] for i in idx); sw = sum(ops[i]["w"] for i in idx)
        with np.errstate(invalid="ignore", divide="ignore"):
            ph = np.where(sw > 0, sp / sw, np.nan)
        q = quantify({**stack, "phi": ph}, R_km)
        for k in out:
            out[k].append(q[k])
    return {k: (float(np.nanpercentile(v, 16)), float(np.nanpercentile(v, 84))) for k, v in out.items()}
