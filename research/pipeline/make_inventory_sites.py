"""Tested family for the inventory: every reference site + every national-screen lead, with stable ids.

Ids never change once issued (human review decisions are keyed on them): existing entries are kept
even if a later screen no longer lists them (they stay tested), and a new lead gets the next free id
unless it lies within 10 km of a site already in the family.

usage: python make_inventory_sites.py [--new-out path]   writes research/pipeline/inventory_sites.json;
with --new-out, also writes only the newly added sites there (for a targeted window extraction) and
prints how many were added."""
import json, math, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "ingestion"))
from india_bbox import BLIND_REFERENCES  # noqa: E402

path = ROOT / "pipeline" / "inventory_sites.json"
sites = json.loads(path.read_text()) if path.exists() else {}
for k, v in BLIND_REFERENCES.items():
    sites.setdefault(k, dict(lat=v["lat"], lon=v["lon"], name=v["name"], kind="reference", source=v["source"]))

km = lambda a, b: 111.0 * math.hypot(a["lat"] - b["lat"], (a["lon"] - b["lon"]) * math.cos(math.radians(a["lat"])))  # noqa: E731
nums = [int(k[1:]) for k in sites if k.startswith("c") and k[1:].isdigit()]
nxt = max(nums, default=0) + 1
cands = json.loads((ROOT.parent / "data-pipeline/web/candidates.json").read_text())["candidates"]
added = {}
for i, c in enumerate(cands, 1):
    if any(km(c, s) <= 10 for s in sites.values()):
        continue
    slug = f"c{nxt:02d}"; nxt += 1
    sites[slug] = added[slug] = dict(lat=c["lat"], lon=c["lon"], name=c.get("place_label", slug), kind="screen_candidate",
                                     screen_rank=i, screen_z=c["z"], in_india=c.get("in_india"),
                                     known_site_match=(c.get("known_site_match") or {}).get("slug"))
path.write_text(json.dumps(sites, indent=1))
if "--new-out" in sys.argv:
    out = Path(sys.argv[sys.argv.index("--new-out") + 1]); out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(added, indent=1))
print(len(added))
