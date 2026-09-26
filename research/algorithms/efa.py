"""
EFA - Evidence-Fusion Attribution (land-use / facility-registry leg). Status: set by r5 (efa test).

For each inventory site, OpenStreetMap facilities within 25 km (fetched by research/pipeline/fetch_osm.py)
vote for a source sector with a distance kernel exp(-d / 8 km):

  landfill   landuse=landfill, man_made=wastewater_plant
  coal       coal mines / quarries (resource=coal|lignite), mineshafts, industrial=mine, coal power plants
  oil_gas    oil/gas wells, refineries, oil & gas industrial sites, gas power plants
  agriculture  rice paddies, farmyards (diffuse; reported, never assigned as a point-source sector)

posterior(sector) = (score + 0.2) / sum(score + 0.2) over the three point-source sectors. A site is
attributed only when the top posterior >= 0.6; otherwise it stays "unattributed". The facilities that
voted are listed, so an analyst can check the attribution in seconds. OSM is incomplete in India, so
absence of a facility is weak evidence; that is why the threshold is conservative.
"""
from __future__ import annotations

import math

SECTORS = ("landfill", "coal", "oil_gas")
KERNEL_KM = 8.0
PRIOR = 0.2
MIN_POSTERIOR = 0.6


def classify(tags: dict) -> str | None:
    t = {k: str(v).lower() for k, v in tags.items()}
    res = t.get("resource", "")
    if t.get("landuse") == "landfill" or t.get("man_made") == "wastewater_plant":
        return "landfill"
    if ("coal" in res or "lignite" in res) or t.get("man_made") == "mineshaft" or t.get("industrial") == "mine" \
            or (t.get("power") == "plant" and "coal" in t.get("plant:source", "")):
        return "coal"
    if t.get("man_made") in ("petroleum_well", "oil_well", "gas_well") or any(x in t.get("industrial", "") for x in ("oil", "gas", "refinery")) \
            or (t.get("power") == "plant" and "gas" in t.get("plant:source", "")):
        return "oil_gas"
    if t.get("crop") == "rice" or t.get("landuse") == "farmyard":
        return "agriculture"
    return None


def km(a, b, c, d):
    return 111.0 * math.hypot(a - c, (b - d) * math.cos(math.radians((a + c) / 2)))


def attribute(lat: float, lon: float, elements: list[dict]) -> dict:
    score = {s: 0.0 for s in SECTORS}; agri = 0.0
    voters = []
    for e in elements:
        sec = classify(e.get("tags", {}))
        if not sec:
            continue
        la = e.get("lat", e.get("center", {}).get("lat")); lo = e.get("lon", e.get("center", {}).get("lon"))
        if la is None or lo is None:
            continue
        d = km(lat, lon, la, lo)
        w = math.exp(-d / KERNEL_KM)
        if sec == "agriculture":
            agri += w; continue
        score[sec] += w
        voters.append(dict(sector=sec, name=e.get("tags", {}).get("name"), osm=f"{e['type']}/{e['id']}", km=round(d, 1),
                           lat=round(la, 4), lon=round(lo, 4), weight=round(w, 3)))
    tot = sum(v + PRIOR for v in score.values())
    post = {s: (score[s] + PRIOR) / tot for s in SECTORS}
    top = max(post, key=post.get)
    voters.sort(key=lambda v: -v["weight"])
    return dict(posterior=post, top=top, attributed=top if post[top] >= MIN_POSTERIOR else None,
                agriculture_signal=round(agri, 3), voters=voters[:8], n_facilities=len(voters))
