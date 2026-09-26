"""
OBC - OSSE Bias Calibration by injection-recovery on REAL backgrounds.
Status: set by research/validation/r5_algorithms.py.

A synthetic Gaussian plume of known rate Q is added to the real TROPOMI pixels of real overpasses
(real noise, real background, real winds, real footprints), centred on a pseudo-site; the full
pipeline is run with and without the injection. recovered = Q_run(with) - Q_run(without).
This measures the method's multiplicative bias (recovery factor) and its detection probability vs Q,
i.e. the detection limit, without any claim that the synthetic plume is data. Injected values
never leave this module; they only produce calibration numbers.

Plume model (vertically integrated column enhancement, steady state):
    dOmega(s, n) = Q / (U * sqrt(2 pi) * sigma_y(s)) * exp(-n^2 / (2 sigma_y^2)),  s > 0 (downwind)
    sigma_y(s) = 0.11 s (1 + 0.0001 s)^-0.5   (Briggs rural, neutral class C/D; s, sigma in m)
averaged over each pixel's real footprint (5x5 bilinear sub-samples), converted to ppb with the
pixel's own dry-air column. U = the overpass's 10 m ECMWF wind (gamma=1), so the recovery factor
isolates method bias; transport-wind gamma is applied separately with its own uncertainty.
"""
from __future__ import annotations

from dataclasses import replace

import numpy as np
import pandas as pd

from site_stack import StackConfig, quantify, stack_site, pseudo_sites

M_CH4 = 16.04e-3


def _corners_local(g, lat0, lon0):
    cx, cy = [], []
    for k in range(4):
        cx.append((g[f"lon_c{k}"].values - lon0) * 111.32 * np.cos(np.radians(lat0)))
        cy.append((g[f"lat_c{k}"].values - lat0) * 110.57)
    return cx, cy


def make_injector(lat0: float, lon0: float, q_kg_h: float, sub: int = 5):
    Q = q_kg_h / 3600.0 / M_CH4  # mol/s

    def inject(g, x, y, u10, v10):
        U = max(float(np.hypot(u10, v10)), 0.5)
        th = np.arctan2(v10, u10)
        cx, cy = _corners_local(g, lat0, lon0)
        t = (np.arange(sub) + 0.5) / sub
        s_, t_ = [a.ravel() for a in np.meshgrid(t, t, indexing="ij")]
        w0 = (1 - s_) * (1 - t_); w1 = s_ * (1 - t_); w2 = s_ * t_; w3 = (1 - s_) * t_
        X = np.outer(cx[0], w0) + np.outer(cx[1], w1) + np.outer(cx[2], w2) + np.outer(cx[3], w3)
        Y = np.outer(cy[0], w0) + np.outer(cy[1], w1) + np.outer(cy[2], w2) + np.outer(cy[3], w3)
        s = (X * np.cos(th) + Y * np.sin(th)) * 1000.0
        n = (-X * np.sin(th) + Y * np.cos(th)) * 1000.0
        sp = np.maximum(s, 1.0)
        sig = 0.11 * sp * (1 + 0.0001 * sp) ** -0.5
        dO = np.where(s > 0, Q / (U * np.sqrt(2 * np.pi) * sig) * np.exp(-n ** 2 / (2 * sig ** 2)), 0.0)
        dO = dO.mean(axis=1)                                   # footprint average, mol/m^2
        return dO / g.dry_air.values * 1e9                    # -> ppb
    return inject


def injection_recovery(pix: pd.DataFrame, lat0: float, lon0: float, q_list=(5000, 10000, 20000, 40000),
                       n_sites: int = 6, cfg: StackConfig = StackConfig(), seed: int = 11) -> list[dict]:
    out = []
    for (la, lo) in pseudo_sites(lat0, lon0, n=n_sites, ring_km=(55.0, 80.0), seed=seed):
        base = quantify(stack_site(pix, la, lo, cfg))
        for q in q_list:
            c2 = replace(cfg, inject=make_injector(la, lo, q))
            got = quantify(stack_site(pix, la, lo, c2))
            out.append(dict(lat=la, lon=lo, q_inj=q, base=base, got=got,
                            rec={m: (got[m] - base[m]) / q for m in got}))
    return out
