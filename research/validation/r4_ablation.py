"""R4: controlled ablation on real TROPOMI data (2023-2024), requested stages:
raw -> +background detrending -> +monsoon-aware filtering -> +wind correction -> combined.
Metric per variant and site: detection z-score vs the pseudo-site null (same overpasses), and the
null spread (1-sigma detection floor, t/h). Divergence quantifier; IME/CSF also logged.
Each step adds exactly one component, so the table attributes gain to that component."""
from __future__ import annotations
import glob, json, sys
from dataclasses import replace
from pathlib import Path
import numpy as np, pandas as pd
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "algorithms"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "ingestion"))
from site_stack import StackConfig, stack_site, quantify, pseudo_sites  # noqa
from india_bbox import KNOWN_SITES  # noqa

MONSOON = (6, 7, 8, 9)
BASE = StackConfig(rotate=False, background="global", drizzle=False)
VARIANTS = {
    "1_raw":            BASE,
    "2_+detrend":       replace(BASE, background="plane"),
    "3_+monsoon_aware": replace(BASE, background="plane", season_mask=MONSOON, quality_weight=True),
    "4_+wind":          replace(BASE, background="plane", season_mask=MONSOON, quality_weight=True, rotate=True),
    "5_combined":       replace(BASE, background="plane", season_mask=MONSOON, quality_weight=True, rotate=True, drizzle=True),
}

def evaluate(pix, s, cfg, n_null=12):
    st = stack_site(pix, s["lat"], s["lon"], cfg); q = quantify(st)
    nulls = {k: [] for k in q}
    for la, lo in pseudo_sites(s["lat"], s["lon"], n=n_null, seed=3):
        qq = quantify(stack_site(pix, la, lo, cfg))
        for k in q: nulls[k].append(qq[k])
    out = {"n": st["n_overpasses"]}
    for k in q:
        v = np.array([x for x in nulls[k] if np.isfinite(x)])
        sd = float(v.std(ddof=1)) if len(v) > 2 else np.nan
        out[k] = dict(rate=q[k], null_sd=sd, z=float((q[k] - v.mean()) / sd) if sd and sd > 0 else None)
    return out

def main(data_dir, out):
    df = pd.concat([pd.read_parquet(f) for f in sorted(glob.glob(f"{data_dir}/tropomi/sites/*.parquet"))], ignore_index=True)
    res = {}
    for name, cfg in VARIANTS.items():
        res[name] = {}
        for slug, s in KNOWN_SITES.items():
            res[name][slug] = evaluate(df[df.site == slug], s, cfg)
        zs = [res[name][k]["DIV"]["z"] for k in ("jawaharnagar", "deonar", "jharia", "pirana")]
        fl = [res[name][k]["DIV"]["null_sd"] for k in KNOWN_SITES]
        print(f"{name:18s} DIV z(detected sites) = {[None if z is None else round(z,1) for z in zs]}  "
              f"mean floor 1sd = {np.nanmean(fl)/1000:.1f} t/h", flush=True)
    Path(out).write_text(json.dumps(res, indent=1, default=float))

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
