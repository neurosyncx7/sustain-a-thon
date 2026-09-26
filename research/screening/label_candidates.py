"""Factual labels for screening candidates: inside/outside India (Natural Earth India-POV boundary)
and the nearest populated place (Natural Earth 10m populated places, public domain). This is
geography, not attribution: facility attribution needs registry/OSM layers (next step, R5)."""
import json, math, sys
from pathlib import Path
from shapely.geometry import shape, Point
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "ingestion"))
from india_bbox import BLIND_REFERENCES  # noqa: E402

cand_path, ne_dir = sys.argv[1], sys.argv[2]
ind = [f for f in json.load(open(f"{ne_dir}/ne_10m_admin_0_countries_ind.geojson"))["features"]
       if f["properties"].get("ADM0_A3") == "IND"][0]
india = shape(ind["geometry"])
places = [(f["properties"]["name"], f["properties"].get("adm0name"), f["properties"].get("adm1name"),
           f["geometry"]["coordinates"][1], f["geometry"]["coordinates"][0], f["properties"].get("pop_max", 0))
          for f in json.load(open(f"{ne_dir}/ne_10m_populated_places_simple.geojson"))["features"]]

def km(a, b, c, d):
    return 111.0 * math.hypot(a - c, (b - d) * math.cos(math.radians((a + c) / 2)))

doc = json.load(open(cand_path))
for c in doc["candidates"]:
    c["in_india"] = bool(india.contains(Point(c["lon"], c["lat"])))
    near = min(places, key=lambda p: km(c["lat"], c["lon"], p[3], p[4]))
    big = min((p for p in places if (p[5] or 0) >= 300000), key=lambda p: km(c["lat"], c["lon"], p[3], p[4]))
    c["nearest_place"] = dict(name=near[0], state=near[2], country=near[1], km=round(km(c["lat"], c["lon"], near[3], near[4]), 1))
    c["nearest_city_300k"] = dict(name=big[0], state=big[2], country=big[1], km=round(km(c["lat"], c["lon"], big[3], big[4]), 1))
    np_ = c["nearest_place"]
    c["place_label"] = f"near {np_['name']}" if np_["km"] < 25 else f"{round(np_['km'])} km from {np_['name']}"
    ref = min(BLIND_REFERENCES.items(), key=lambda kv: km(c["lat"], c["lon"], kv[1]["lat"], kv[1]["lon"]))
    dref = km(c["lat"], c["lon"], ref[1]["lat"], ref[1]["lon"])
    c["known_site_match"] = dict(slug=ref[0], name=ref[1]["name"], km=round(dref, 1)) if dref <= 25 else None
doc["labels_source"] = "Natural Earth 10m (India POV boundary; populated places), public domain"
json.dump(doc, open(cand_path, "w"), indent=1)
for c in doc["candidates"][:30]:
    print(f"{c['lat']:6.2f} {c['lon']:6.2f} z={c['z']:5.1f} {c['rate_kg_h_gamma1']/1000:5.1f}t/h days={c['valid_days']:3d} "
          f"{'IN ' if c['in_india'] else 'out'} {c['nearest_place']['name']} ({c['nearest_place']['km']} km) / "
          f"{c['nearest_city_300k']['name']}, {c['nearest_city_300k']['state']} ({c['nearest_city_300k']['km']} km)")

# Blind recovery: how close does the screen (given no site list) come to each documented emitter?
rec = {}
for slug, s in BLIND_REFERENCES.items():
    d = [(km(c["lat"], c["lon"], s["lat"], s["lon"]), i) for i, c in enumerate(doc["candidates"])]
    dm, i = min(d)
    rec[slug] = dict(name=s["name"], nearest_candidate_km=round(dm, 1), candidate_rank=i + 1,
                     candidate_z=round(doc["candidates"][i]["z"], 1), recovered=bool(dm <= 25))
Path(cand_path).with_name("blind_recovery.json").write_text(json.dumps(rec, indent=1))
