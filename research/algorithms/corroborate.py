"""
Independent corroboration of a detection. Status: validated per run (each check measures its own
false-pass rate on the site's 24 pseudo-sites, the same way it scores the site, every time it runs).

Why: a statistically significant flux divergence is one line of evidence. Before an entry can be
labelled "confirmed" it must also pass at least one check that could have failed independently.

Checks
  temporal     the site is re-detected in disjoint data: early (before 2025-01-01) and late (from
               2025-01-01) overpasses stacked separately, each against its own null; pass = z > 2 in
               both. Independent data, same method.
  second_method  cross-sectional flux (CSF) on the same stack against its own null; pass = z > 2.
               Same data, different estimator (a mass-balance transect instead of a divergence).
  co           co-retrieved CO column stacked identically; pass = CO z > 2. Co-emission evidence only;
               the CO/CH4 *ratio* is not used for sector attribution (EIV-CRF failed R5).
  blind_screen the national screen, given no site list, placed a candidate within 25 km.

Not used, and said so in the output: wind-direction invariance (WIT, failed R5: 21% false rejects,
8% power) and the CO/CH4 sector fingerprint (EIV-CRF, failed R5: 2 of 5 sites informative).

False-pass rate of a check: apply it to each of the 24 pseudo-sites, scoring each against the other
23 (leave-one-out), exactly as the site is scored against all 24.
"""
from __future__ import annotations

from dataclasses import replace

import numpy as np
import pandas as pd

from site_stack import StackConfig, quantify, stack_site, pseudo_sites

SPLIT = pd.Timestamp("2025-01-01", tz="UTC")
Z_PASS = 2.0
NOT_USED = {
    "wind_invariance": "not used: the wind-direction test failed validation on real data (R5: 21% false rejects, 8% power)",
    "chemical_fingerprint": "not used for attribution: the CO/CH4 ratio separated only 2 of 5 known emitters (R5)",
}


def _z(value, null):
    null = np.asarray([x for x in null if np.isfinite(x)])
    if len(null) < 5 or not np.isfinite(value):
        return None
    sd = null.std(ddof=1)
    return float((value - null.mean()) / sd) if sd > 0 else None


def _loo_rate(null, cond=lambda z: z > Z_PASS):
    """Fraction of pseudo-sites that pass when scored against the other pseudo-sites."""
    null = np.asarray(null, float)
    hits, n = 0, 0
    for j in range(len(null)):
        z = _z(null[j], np.delete(null, j))
        if z is None:
            continue
        n += 1; hits += bool(cond(z))
    return (hits / n) if n else None


def _scores(pix, lat, lon, cfg, n_null, seed):
    site = quantify(stack_site(pix, lat, lon, cfg))
    nulls = [quantify(stack_site(pix, la, lo, cfg)) for la, lo in pseudo_sites(lat, lon, n=n_null, seed=seed)]
    return site, nulls


def corroborate(pix: pd.DataFrame, lat: float, lon: float, cfg: StackConfig, site_q: dict, null_q: list[dict],
                screen_km: float | None, n_null: int = 24, seed: int = 7) -> dict:
    out: dict = {}
    # second method (same stack, same pseudo-sites: already computed by the caller)
    csf_null = [d["CSF"] for d in null_q]
    zc = _z(site_q["CSF"], csf_null)
    out["second_method"] = dict(check="cross-sectional flux agrees (z > 2)", z=zc, passed=bool(zc is not None and zc > Z_PASS),
                                false_pass_rate=_loo_rate(csf_null), independence="same data, different estimator")
    # temporal replication
    t = pd.to_datetime(pix.time, utc=True)
    halves = {"early": pix[t < SPLIT], "late": pix[t >= SPLIT]}
    zs, loo = {}, {}
    for k, h in halves.items():
        if h.orbit.nunique() < 20:
            zs[k] = None; continue
        s, n = _scores(h, lat, lon, cfg, n_null, seed)
        zs[k] = _z(s["DIV"], [d["DIV"] for d in n])
        loo[k] = [d["DIV"] for d in n]
    if zs.get("early") is None or zs.get("late") is None:
        out["temporal"] = dict(check="re-detected in disjoint years (z > 2 before and after 2025-01-01)", z_early=zs.get("early"),
                               z_late=zs.get("late"), passed=False, status="insufficient data in one period",
                               false_pass_rate=None, independence="independent data")
    else:
        a, b = np.asarray(loo["early"], float), np.asarray(loo["late"], float)
        both = [(_z(a[j], np.delete(a, j)) or -9) > Z_PASS and (_z(b[j], np.delete(b, j)) or -9) > Z_PASS for j in range(min(len(a), len(b)))]
        out["temporal"] = dict(check="re-detected in disjoint years (z > 2 before and after 2025-01-01)", z_early=zs["early"],
                               z_late=zs["late"], passed=bool(zs["early"] > Z_PASS and zs["late"] > Z_PASS),
                               status="evaluated", false_pass_rate=float(np.mean(both)), independence="independent data")
    # CO co-emission
    co_cfg = replace(cfg, field="xco_col")
    s, n = _scores(pix, lat, lon, co_cfg, n_null, seed)
    co_null = [d["DIV"] for d in n]
    zco = _z(s["DIV"], co_null)
    out["co"] = dict(check="co-emitted CO detected (z > 2)", z=zco, passed=bool(zco is not None and zco > Z_PASS),
                     false_pass_rate=_loo_rate(co_null), independence="independent species, same overpasses")
    out["blind_screen"] = dict(check="found by the national screen with no site list (<= 25 km)", km=screen_km,
                               passed=bool(screen_km is not None and screen_km <= 25), false_pass_rate=None,
                               independence="independent algorithm, daily grids")
    out["not_used"] = NOT_USED
    out["n_passed"] = sum(1 for k in ("second_method", "temporal", "co", "blind_screen") if out[k]["passed"])
    out["confirming"] = bool(out["temporal"]["passed"] or out["second_method"]["passed"])
    return out
