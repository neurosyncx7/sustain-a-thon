"""
BY-FDR gate for the national screen. Status: set by r5_algorithms.py.

Tens of thousands of grid cells are screened; at 3 sigma, chance alone produces spurious peaks.
We (1) take ALL local maxima of the smoothed mean-divergence field (the tested family, before any
threshold), (2) assign each an empirical p-value against the field's own lower tail mirrored about
the median (the null for noise that is symmetric about zero: artefacts should be as likely to look
like sinks as sources), and (3) apply Benjamini-Yekutieli, which controls the false discovery rate
under arbitrary dependence (neighbouring cells are correlated). Candidates with q <= 0.05 pass.
"""
from __future__ import annotations

import numpy as np


def empirical_p(values: np.ndarray, field: np.ndarray) -> np.ndarray:
    f = field[np.isfinite(field)]
    med = np.median(f)
    null = np.sort(2 * med - f[f <= med])          # mirrored lower tail = one-sided null for sources
    null = np.r_[null, 2 * med - f[f <= med]]      # (same values; kept explicit for clarity)
    null = np.sort(null)
    n = len(null)
    # p = P(null >= v): count null values >= v
    idx = np.searchsorted(null, values, side="left")
    return (1 + (n - idx)) / (1 + n)


def benjamini_yekutieli(p: np.ndarray) -> np.ndarray:
    p = np.asarray(p, float)
    m = len(p)
    c_m = np.sum(1.0 / np.arange(1, m + 1))
    order = np.argsort(p)
    ranked = p[order] * m * c_m / np.arange(1, m + 1)
    q = np.minimum.accumulate(ranked[::-1])[::-1]
    out = np.empty(m); out[order] = np.minimum(q, 1.0)
    return out
