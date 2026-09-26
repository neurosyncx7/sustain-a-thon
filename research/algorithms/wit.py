"""
WIT - Wind-Invariance Test. Status: set by research/validation/r5_algorithms.py (validated/failed).

Principle: a real, persistent point source has one emission rate whatever direction the wind blows;
signals that come from a neighbouring source drifting into the analysis disk, or from transport
artefacts, change with wind direction. We split a site's overpasses into K wind-direction groups
(terciles of the observed wind-to azimuth, so every group has data), re-stack each group with the
final method, and test whether the K divergence rates agree:

    chi2 = sum_k (Q_k - Q_bar)^2 / sigma_k^2 ,  Q_bar = inverse-variance mean,  dof = K - 1

sigma_k from bootstrap over that group's overpasses. p > 0.01 = consistent (pass).
"""
from __future__ import annotations

from dataclasses import replace

import numpy as np
import pandas as pd
from scipy import stats

from site_stack import StackConfig, bootstrap, quantify, stack_site


def overpass_winds(pix: pd.DataFrame, lat0: float, lon0: float, radius_km: float = 30.0) -> pd.Series:
    """Wind-to azimuth (deg, from north, clockwise) per orbit, from the product winds near the site."""
    out = {}
    for orbit, g in pix.groupby("orbit"):
        x = (g.lon.values - lon0) * 111.32 * np.cos(np.radians(lat0))
        y = (g.lat.values - lat0) * 110.57
        near = np.hypot(x, y) < radius_km
        if near.sum() < 3:
            continue
        u, v = float(np.nanmean(g.u.values[near])), float(np.nanmean(g.v.values[near]))
        out[orbit] = np.degrees(np.arctan2(u, v)) % 360
    return pd.Series(out)


def wind_invariance_test(pix: pd.DataFrame, lat0: float, lon0: float, cfg: StackConfig = StackConfig(),
                         k: int = 3, n_boot: int = 120) -> dict:
    az = overpass_winds(pix, lat0, lon0)
    if len(az) < 3 * k:
        return dict(status="insufficient", n=len(az))
    # circular terciles: rotate so the largest gap in azimuth is the cut point
    srt = np.sort(az.values)
    gaps = np.diff(np.r_[srt, srt[0] + 360])
    cut = srt[(np.argmax(gaps) + 1) % len(srt)]
    rel = (az - cut) % 360
    edges = np.quantile(rel, np.linspace(0, 1, k + 1))
    groups = np.clip(np.searchsorted(edges, rel.values, side="right") - 1, 0, k - 1)
    res = []
    for gi in range(k):
        orbits = set(az.index[groups == gi])
        sub = pix[pix.orbit.isin(orbits)]
        st = stack_site(sub, lat0, lon0, cfg)
        q = quantify(st)["DIV"]
        ci = bootstrap(st, n_boot=n_boot).get("DIV")
        sd = (ci[1] - ci[0]) / 2 if ci else np.nan
        res.append(dict(group=gi, n=st["n_overpasses"], rate_kg_h=q, sd_kg_h=sd,
                        az_mean=float(stats.circmean(np.radians(az[groups == gi].values)) * 180 / np.pi % 360)))
    Q = np.array([r["rate_kg_h"] for r in res]); S = np.array([r["sd_kg_h"] for r in res])
    ok = np.isfinite(Q) & np.isfinite(S) & (S > 0)
    if ok.sum() < 2:
        return dict(status="insufficient", groups=res)
    w = 1 / S[ok] ** 2
    qbar = float(np.sum(w * Q[ok]) / np.sum(w))
    chi2 = float(np.sum((Q[ok] - qbar) ** 2 * w))
    p = float(stats.chi2.sf(chi2, ok.sum() - 1))
    return dict(status="pass" if p > 0.01 else "fail", chi2=chi2, dof=int(ok.sum() - 1), p=p,
                combined_kg_h=qbar, groups=res)
