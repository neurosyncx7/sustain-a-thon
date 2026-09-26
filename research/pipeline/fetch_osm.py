"""Facilities near every inventory site from OpenStreetMap (Overpass API, keyless). Runs on GitHub
Actions (the research container has no route to Overpass). Output: {slug: [elements]} JSON.
usage: python fetch_osm.py <inventory_sites.json> <out.json>"""
from __future__ import annotations

import json, sys, time
from pathlib import Path

import requests

MIRRORS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter",
           "https://overpass.private.coffee/api/interpreter"]
R = 25000


def query(lat, lon):
    a = f"(around:{R},{lat},{lon})"
    q = f"""[out:json][timeout:90];
(
 nwr{a}["landuse"="landfill"];
 nwr{a}["man_made"="wastewater_plant"];
 nwr{a}["resource"~"coal|lignite"];
 nwr{a}["man_made"="mineshaft"];
 nwr{a}["industrial"="mine"];
 nwr{a}["man_made"~"petroleum_well|oil_well|gas_well"];
 nwr{a}["industrial"~"oil|gas|refinery"];
 nwr{a}["power"="plant"]["plant:source"~"coal|gas"];
 nwr{a}["crop"="rice"];
);
out center tags qt 400;"""
    for attempt in range(3):
        url = MIRRORS[attempt % len(MIRRORS)]
        try:
            r = requests.post(url, data={"data": q}, timeout=75, headers={"User-Agent": "vayu-lekha/1.0 (methane inventory research)"})
            if r.status_code in (429, 504):
                time.sleep(10 * (attempt + 1)); continue
            r.raise_for_status()
            return [dict(type=e["type"], id=e["id"], lat=e.get("lat"), lon=e.get("lon"), center=e.get("center"), tags=e.get("tags", {}))
                    for e in r.json().get("elements", [])]
        except (requests.RequestException, ValueError):
            time.sleep(5 * (attempt + 1))
    return None


def main(sites_path, out_path, budget_s=900):
    """Fetches sites not yet cached, saving after each one, within a time budget; the next run
    continues where this one stopped (facilities change slowly, so each site is fetched once)."""
    sites = json.loads(Path(sites_path).read_text())
    out = json.loads(Path(out_path).read_text()) if Path(out_path).exists() else {}
    t0 = time.time()
    # reference sites first: the EFA validation needs them
    order = sorted(sites, key=lambda k: 0 if sites[k].get("kind") == "reference" else 1)
    for slug in order:
        if out.get(slug) is not None:
            continue
        if time.time() - t0 > budget_s:
            print("time budget reached; remaining sites next run"); break
        s = sites[slug]
        out[slug] = query(s["lat"], s["lon"])
        print(slug, None if out[slug] is None else len(out[slug]), flush=True)
        Path(out_path).write_text(json.dumps(out))
        time.sleep(1)
    Path(out_path).write_text(json.dumps(out))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
