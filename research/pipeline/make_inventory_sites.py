"""Tested family for the inventory: every national-screen candidate + every blind reference site.
Writes research/pipeline/inventory_sites.json, the --sites-file for extract_month.py (sites_inv/)."""
import json, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "ingestion"))
from india_bbox import BLIND_REFERENCES  # noqa: E402

cands = json.loads((ROOT.parent / "data-pipeline/web/candidates.json").read_text())["candidates"]
sites = {k: dict(lat=v["lat"], lon=v["lon"], name=v["name"], kind="reference", source=v["source"])
         for k, v in BLIND_REFERENCES.items()}
for i, c in enumerate(cands, 1):
    slug = f"c{i:02d}"
    sites[slug] = dict(lat=c["lat"], lon=c["lon"], name=c.get("place_label", slug), kind="screen_candidate",
                       screen_rank=i, screen_z=c["z"], in_india=c.get("in_india"),
                       known_site_match=(c.get("known_site_match") or {}).get("slug"))
out = ROOT / "pipeline" / "inventory_sites.json"
out.write_text(json.dumps(sites, indent=1))
print(len(sites), "sites ->", out)
