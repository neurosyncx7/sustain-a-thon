"""Export each site's real wind-rotated stack (R3) as a small 16-bit-free 8-bit PNG + JSON meta for
the web's Digamsha instrument. phi = mean(dOmega * U10) in mol m^-1 s^-1; 0 maps to grey 128."""
import glob, json, sys
from pathlib import Path
import numpy as np
from PIL import Image
src, dst = sys.argv[1], Path(sys.argv[2]); dst.mkdir(parents=True, exist_ok=True)
meta = {}
for f in sorted(glob.glob(f"{src}/known_sites_*_stack.npz")):
    slug = f.split("known_sites_")[1].replace("_stack.npz", "")
    z = np.load(f); phi = z["phi"]
    s = float(np.nanpercentile(np.abs(phi), 99)) or 1.0
    img = np.where(np.isfinite(phi), np.clip(128 + 127 * phi / s, 1, 255), 0).astype(np.uint8)[::-1]
    Image.fromarray(img, "L").save(dst / f"{slug}.png")
    meta[slug] = dict(file=f"/data/stacks/{slug}.png", scale_mol_m_s=s, x_km=[float(z["xc"][0]), float(z["xc"][-1])],
                      y_km=[float(z["yc"][0]), float(z["yc"][-1])], frame="wind-rotated: +x downwind")
(dst / "stacks.json").write_text(json.dumps(meta, indent=1))
print(meta.keys())
