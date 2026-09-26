"""R3: compare IME / cross-sectional flux / divergence on real stacked TROPOMI data at known sites.

Inputs: data branch `tropomi/sites/*.parquet` (real OFFL L2 CH4 pixels within 150 km of each site,
2023-2024). For each site: wind-rotated drizzled stack of every usable overpass, three quantifiers,
bootstrap 68% intervals, and an empirical null from 8 pseudo-sites 60-90 km away (same overpasses).
Rates are at gamma=1 (TROPOMI's ECMWF 10 m wind); see gamma_from_era5() for the transport-wind factor.
"""
from __future__ import annotations
import glob, json, sys
from pathlib import Path
import numpy as np, pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "algorithms"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "ingestion"))
from site_stack import StackConfig, stack_site, quantify, bootstrap, pseudo_sites  # noqa
from india_bbox import KNOWN_SITES  # noqa

def load(data_dir: str) -> pd.DataFrame:
    fs = sorted(glob.glob(f"{data_dir}/tropomi/sites/*.parquet"))
    return pd.concat([pd.read_parquet(f) for f in fs], ignore_index=True)

def main(data_dir: str, out: str, only: str | None = None):
    df = load(data_dir)
    cfg = StackConfig()
    results = {}
    for slug, s in KNOWN_SITES.items():
        if only and slug != only: continue
        pix = df[df.site == slug]
        st = stack_site(pix, s["lat"], s["lon"], cfg)
        q = quantify(st)
        ci = bootstrap(st, n_boot=200)
        nulls = {"IME": [], "CSF": [], "DIV": []}
        for (la, lo) in pseudo_sites(s["lat"], s["lon"], n=8):
            # pseudo-site pixels: same window rows, re-centred (windows are 150 km around the site)
            sp = stack_site(pix, la, lo, cfg, seed_label="null")
            qq = quantify(sp)
            for k in nulls: nulls[k].append(qq[k])
        z = {}
        for k in nulls:
            v = np.array([x for x in nulls[k] if np.isfinite(x)])
            z[k] = float((q[k] - v.mean()) / v.std(ddof=1)) if len(v) > 2 and v.std() > 0 else None
        results[slug] = dict(name=s["name"], n_overpasses=st["n_overpasses"], n_pixels=int(len(pix)),
                             rate_kg_h=q, ci68=ci, null_mean={k: float(np.nanmean(v)) for k, v in nulls.items()},
                             null_std={k: float(np.nanstd(v, ddof=1)) for k, v in nulls.items()}, z=z,
                             reference=s["source"])
        np.savez_compressed(Path(out).with_suffix("") .as_posix() + f"_{slug}_stack.npz",
                            phi=st["phi"], weight=st["weight"], xc=st["xc"], yc=st["yc"])
        print(slug, json.dumps(results[slug]["rate_kg_h"]), "z", z, "n", st["n_overpasses"], flush=True)
    Path(out).write_text(json.dumps(results, indent=1, default=float))

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
