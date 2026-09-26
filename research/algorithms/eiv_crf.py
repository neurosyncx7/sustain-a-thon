"""
EIV-CRF - Errors-in-Variables Chemical Ratio Fingerprint. Status: set by r5_algorithms.py.

The TROPOMI CH4 retrieval co-retrieves the CO total column (DETAILED_RESULTS/
carbonmonoxide_total_column) in the same pixels, same instant, same footprint. Stacking CO exactly
like CH4 (same overpasses, same winds, same rotation) gives a CO emission rate from the same
divergence operator; the molar ratio CO/CH4 fingerprints the process:
  - combustion (crop-residue/landfill fires, biomass): CO/CH4 molar >> 1 (CH4:CO ~ 0.1 for burning)
  - anaerobic landfill decay, coal-seam gas, gas leaks: CO/CH4 ~ 0
  - mixed urban clusters: in between (traffic CO)
Never compute ratio of two noisy point estimates alone: the ratio's interval comes from resampling
the SAME overpasses for both species (errors in both variables), and a ratio is only reported when
the CH4 rate is itself significant.
"""
from __future__ import annotations

from dataclasses import replace

import numpy as np
import pandas as pd

from site_stack import StackConfig, quantify, stack_site

M_CH4, M_CO = 16.04e-3, 28.01e-3


def co_ch4_ratio(pix: pd.DataFrame, lat0: float, lon0: float, cfg: StackConfig = StackConfig(),
                 n_boot: int = 200, seed: int = 5) -> dict:
    s_ch4 = stack_site(pix, lat0, lon0, cfg)
    s_co = stack_site(pix, lat0, lon0, replace(cfg, field="xco_col"))
    orbits = [o["orbit"] for o in s_ch4["overpasses"]]
    co_by = {o["orbit"]: o for o in s_co["overpasses"]}
    both = [o for o in s_ch4["overpasses"] if o["orbit"] in co_by]
    if len(both) < 10:
        return dict(status="insufficient", n=len(both))

    def rates(sel):
        def mean_phi(ops):
            sp = sum(o["phi"] for o in ops); sw = sum(o["w"] for o in ops)
            with np.errstate(invalid="ignore", divide="ignore"):
                return np.where(sw > 0, sp / sw, np.nan)
        qc = quantify({**s_ch4, "phi": mean_phi([sel_[0] for sel_ in sel]), "n_overpasses": len(sel)})["DIV"]
        qo = quantify({**s_co, "phi": mean_phi([sel_[1] for sel_ in sel]), "n_overpasses": len(sel)})["DIV"]
        return qc / M_CH4, qo / M_CH4   # quantify() converts mol/s with M_CH4 for any field -> undo it

    pairs = [(o, co_by[o["orbit"]]) for o in both]
    ch4, co = rates(pairs)
    rng = np.random.default_rng(seed)
    rs = []
    for _ in range(n_boot):
        idx = rng.integers(0, len(pairs), len(pairs))
        c, o = rates([pairs[i] for i in idx])
        if c > 0:
            rs.append(o / c)
    lo, med, hi = (np.percentile(rs, [16, 50, 84]) if len(rs) > 20 else (np.nan,) * 3)
    return dict(status="ok", n=len(pairs), ch4_mol_h=ch4, co_mol_h=co,
                ratio_co_ch4=float(co / ch4) if ch4 > 0 else None, ratio_ci68=[float(lo), float(hi)],
                ratio_median=float(med), frac_boot_positive_ch4=len(rs) / n_boot)
