"""Factual labels for screening candidates: inside/outside India (Natural Earth India-POV boundary)
and the nearest populated place (Natural Earth 10m populated places, public domain). This is
geography, not attribution: facility attribution needs registry/OSM layers (next step, R5)."""
import json, math, sys
from shapely.geometry import shape, Point

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
doc["labels_source"] = "Natural Earth 10m (India POV boundary; populated places), public domain"
json.dump(doc, open(cand_path, "w"), indent=1)
for c in doc["candidates"][:30]:
    print(f"{c['lat']:6.2f} {c['lon']:6.2f} z={c['z']:5.1f} {c['rate_kg_h_gamma1']/1000:5.1f}t/h days={c['valid_days']:3d} "
          f"{'IN ' if c['in_india'] else 'out'} {c['nearest_place']['name']} ({c['nearest_place']['km']} km) / "
          f"{c['nearest_city_300k']['name']}, {c['nearest_city_300k']['state']} ({c['nearest_city_300k']['km']} km)")
