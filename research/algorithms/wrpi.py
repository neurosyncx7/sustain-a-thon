"""
WRPI - Warming-per-Rupee Priority Index. Status: validated as an accounting method (it is a
transparent formula over cited constants, not a statistical estimator; there is nothing to beat in an
ablation). Every constant below carries its source; every uncertain one is sampled in the Monte Carlo.

    avoided warming (t CO2e20 / yr) = Q [t/h] * 8766 h * f_abate * GWP20
    cost (INR / yr)                 = Q * 8766 * f_abate * c_sector [USD / t CH4 abated] * FX [INR/USD]
    WRPI (t CO2e20 per INR 1 lakh)  = P(real) * GWP20 / (c_sector * FX) * 1e5

P(real) = 1 - q (BY-FDR q-value of the site's detection): a rupee spent on a source that may not exist
buys nothing, so detection confidence is part of the priority, not a footnote.

Constants
- GWP20: IPCC AR6 WG1 Ch.7, Table 7.SM.7 (Forster et al. 2021): fossil CH4 82.5, non-fossil 79.7,
  +/- 25.8 (5-95%, treated as +/- 1.645 sigma).
- Landfill gas collection + flaring: US EPA (2013) Global Mitigation of Non-CO2 GHGs, Section III
  Waste, Table 1-2: capital 1.7 M USD(2010), O&M 0.3 M USD(2010)/yr, 85% reduction, 15 yr; model
  landfill (Table 1-5) 100,000 t/yr acceptance, L0 = 100 m3 CH4/t (3,204 ft3/ton), 10% discount rate.
  Steady-state generation = 1e5 t * 100 m3/t * 0.668 kg/m3 = 6,680 t CH4/yr; abated 5,678 t/yr.
  Annualised cost = 1.7M * CRF(10%,15y)=0.1315 -> 0.2235M + 0.3M = 0.5235M USD(2010)/yr
  -> 92.2 USD(2010)/t CH4 abated -> x1.4386 (US CPI-U 2024/2010 = 313.689/218.056) = 132.6 USD(2024).
  Sampled x U[0.5, 1.5] (US engineering parameters applied to Indian open dumps: flagged).
  f_abate ~ U[0.5, 0.85]: 85% is EPA's engineered-cell efficiency; unlined open dumps capture less.
- Coal mine methane, oil & gas: IEA Global Methane Tracker 2024 (key findings): "nearly all fossil
  fuel methane abatement measures" pay off at ~20 USD/t CO2e with IEA's GWP100 = 30 -> <= 600 USD/t
  CH4; 15% of coal and 50% of oil & gas abatement at no net cost. Sampled: cost = 0 with probability
  0.15 (coal) / 0.50 (oil & gas), else U[0, 600]. f_abate ~ U[0.5, 0.7] (IEA: ~80 of 120 Mt fossil
  CH4 avoidable with existing technology = 67%).
- Unattributed candidates: sector unknown -> each draw picks landfill / coal / oil & gas with equal
  probability and the matching cost, f_abate and GWP (non-fossil for landfill).
- FX: INR per USD; the pipeline records the rate it used and its date (ECB reference via the live
  API when available, else RBI 2024 average 83.7 as a stated fallback).
"""
from __future__ import annotations

import numpy as np

HOURS_PER_YEAR = 8766.0
GWP20 = dict(fossil=82.5, nonfossil=79.7, sd=25.8 / 1.645)
LANDFILL_USD_PER_T = 132.6
FOSSIL_MAX_USD_PER_T = 600.0
NO_COST_SHARE = dict(coal=0.15, oil_gas=0.50)
SECTORS = ("landfill", "coal", "oil_gas")


def sample_sector_params(sector: str, n: int, rng: np.random.Generator):
    if sector == "unattributed":
        pick = rng.integers(0, 3, n)
        out = [sample_sector_params(s, n, rng) for s in SECTORS]
        return tuple(np.choose(pick, [o[i] for o in out]) for i in range(3))
    if sector == "landfill":
        cost = LANDFILL_USD_PER_T * rng.uniform(0.5, 1.5, n)
        f = rng.uniform(0.5, 0.85, n)
        gwp = rng.normal(GWP20["nonfossil"], GWP20["sd"], n)
    elif sector in ("coal", "oil_gas"):
        cost = np.where(rng.random(n) < NO_COST_SHARE[sector], 0.0, rng.uniform(0, FOSSIL_MAX_USD_PER_T, n))
        f = rng.uniform(0.5, 0.7, n)
        gwp = rng.normal(GWP20["fossil"], GWP20["sd"], n)
    else:
        raise ValueError(sector)
    return cost, f, np.clip(gwp, 1.0, None)


def wrpi_mc(q_t_h: np.ndarray, sector: str, p_real: float, fx_inr_usd: float, seed: int = 0) -> dict:
    """q_t_h: Monte Carlo samples of the calibrated emission rate (t/h). Returns summaries."""
    rng = np.random.default_rng(seed)
    n = len(q_t_h)
    cost, f, gwp = sample_sector_params(sector, n, rng)
    q = np.clip(q_t_h, 0, None)
    abated_t = q * HOURS_PER_YEAR * f
    warm = abated_t * gwp                                   # t CO2e20 / yr
    cost_inr = abated_t * cost * fx_inr_usd                 # INR / yr
    # warming per lakh rupees; zero-cost draws are capped at 1 INR/t (a "free" fix is still ranked first,
    # but stays finite so percentiles are meaningful)
    per_lakh = p_real * gwp / (np.maximum(cost, 1.0 / fx_inr_usd) * fx_inr_usd) * 1e5
    pc = lambda a: [float(np.percentile(a, 16)), float(np.percentile(a, 50)), float(np.percentile(a, 84))]  # noqa: E731
    return dict(avoidable_tco2e20_per_yr=pc(warm), abatement_cost_inr_per_yr=pc(cost_inr),
                wrpi_tco2e20_per_lakh_inr=pc(per_lakh), p_real=p_real, sector=sector,
                fx_inr_per_usd=fx_inr_usd)
