"""Export N real single overpasses around a site, each in its *unrotated* north-up frame and with
its real ECMWF wind vector, plus the rotated stack scale, for the Digamsha visual. Picks the
overpasses with the most pixels near the site (best-observed days)."""
import glob, json, sys
from dataclasses import replace
from pathlib import Path
import numpy as np, pandas as pd
from PIL import Image
sys.path.insert(0, "research/algorithms"); sys.path.insert(0, "research/ingestion")
from site_stack import StackConfig, stack_site  # noqa
from india_bbox import KNOWN_SITES  # noqa

data, slug, out, n = sys.argv[1], sys.argv[2], Path(sys.argv[3]), int(sys.argv[4])
df = pd.concat([pd.read_parquet(f) for f in sorted(glob.glob(f"{data}/tropomi/sites/*.parquet"))])
s = KNOWN_SITES[slug]; pix = df[df.site == slug]
cfg = StackConfig(season_mask=(6, 7, 8, 9), quality_weight=True, rotate=False,
                  x_range=(-50.0, 50.0), y_range=(-50.0, 50.0))   # north-up frame, centred
st = stack_site(pix, s["lat"], s["lon"], cfg)
ops = sorted(st["overpasses"], key=lambda o: -o["n_pix"])[:n]
scale = float(np.nanpercentile(np.abs(np.concatenate([np.where(o["w"] > 0, o["phi"] / np.maximum(o["w"], 1e-9), np.nan).ravel() for o in ops])), 97))
tiles, meta = [], []
for o in ops:
    ph = np.where(o["w"] > 0, o["phi"] / np.maximum(o["w"], 1e-9), np.nan)
    tiles.append(np.where(np.isfinite(ph), np.clip(128 + 127 * ph / scale, 1, 255), 0).astype(np.uint8)[::-1])
    meta.append(dict(orbit=str(o["orbit"]), time=str(o["time"])[:16], u10=round(o["u10"], 2), v10=round(o["v10"], 2),
                     wind_to_deg=round(float(np.degrees(np.arctan2(o["u10"], o["v10"])) % 360), 1)))
out.mkdir(parents=True, exist_ok=True)
Image.fromarray(np.concatenate(tiles, axis=1), "L").save(out / f"{slug}_overpasses.png")
(out / f"{slug}_overpasses.json").write_text(json.dumps(dict(site=slug, tiles=len(tiles), tile_px=tiles[0].shape[::-1],
    extent_km=50, scale_mol_m_s=scale, frame="north-up (unrotated); wind_to_deg = direction the wind blows toward, from north",
    overpasses=meta), indent=1))
print(meta)
