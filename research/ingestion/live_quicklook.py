"""Live pass: the newest real TROPOMI CH4 overpasses of India, a few hours after sensing.

Lists the Near-Real-Time product (NRTI/L2__CH4___, ~3 h latency) on the public MEEO mirror for the
last 3 UTC days; falls back to OFFL when NRTI is not mirrored. Takes every granule of the most recent
day that touches India (03-11 UTC), applies the same reader and qa>=0.5 filter as the archive, and
writes (no science beyond the archive's; this is a quicklook, not an inventory update):
  live/latest.json   sensing time, orbits, pixel count, mean XCH4, per-site "today" numbers
                     (pixels within 30 km, local enhancement vs the 60-140 km annulus, ECMWF wind)
  live/latest.png    0.1 deg XCH4 grid, same encoding as the archive textures (0 = no data)
  live/history.json  one summary line per processed day (appended, newest last, capped at 120)
usage: python live_quicklook.py <out_dir> <inventory_sites.json>
"""
from __future__ import annotations

import json, sys, tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
import extract_month as em  # noqa: E402


def list_prefix(prefix):
    keys, token = [], None
    while True:
        params = {"list-type": "2", "prefix": prefix, "max-keys": "1000"}
        if token:
            params["continuation-token"] = token
        r = requests.get(em.BUCKET + "/", params=params, timeout=60)
        r.raise_for_status()
        root = em.ET.fromstring(r.content)
        keys += [c.findtext("s3:Key", namespaces=em.NS) for c in root.findall("s3:Contents", em.NS)]
        if root.findtext("s3:IsTruncated", default="false", namespaces=em.NS) != "true":
            return [k for k in keys if k.endswith(".nc")]
        token = root.findtext("s3:NextContinuationToken", namespaces=em.NS)


def newest_india_granules():
    now = datetime.now(timezone.utc)
    for stream in ("NRTI", "OFFL"):
        for back in range(0, 3 if stream == "NRTI" else 12):
            d = (now - timedelta(days=back)).date()
            keys = [k for k in list_prefix(f"{stream}/L2__CH4___/{d:%Y/%m/%d}/") if 3 <= em.utc_hour(k) <= 11]
            if keys:
                return stream, d, sorted(keys)
    return None, None, []


def main(out_dir, sites_path):
    out = Path(out_dir) / "live"; out.mkdir(parents=True, exist_ok=True)
    sites = json.loads(Path(sites_path).read_text())
    stream, day, keys = newest_india_granules()
    if not keys:
        print("no granules found"); return
    frames, orbits, log = [], [], []
    for key in keys:
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "g.nc"
            with requests.get(f"{em.BUCKET}/{key}", stream=True, timeout=300) as r:
                r.raise_for_status()
                with open(p, "wb") as f:
                    for chunk in r.iter_content(1 << 22):
                        f.write(chunk)
            try:
                df = em.read_granule(p)
            except Exception as e:
                log.append(dict(key=key, error=repr(e)[:200])); continue
        if df is None:
            log.append(dict(key=key, pixels=0)); continue
        df["orbit"] = em.orbit_of(key)
        orbits.append(em.orbit_of(key)); frames.append(df); log.append(dict(key=key, pixels=len(df)))
    if not frames:
        summary = dict(stream=stream, day=str(day), granules=len(keys), pixels=0, orbits=[], note="no qa>=0.5 pixels over India (cloud/monsoon)", log=log)
    else:
        import pandas as pd
        from PIL import Image
        d = pd.concat(frames, ignore_index=True)
        g = em.grid_day(d)
        x = g["xch4"]
        lo, hi = [float(v) for v in np.nanpercentile(x, [1, 99])] if np.isfinite(x).any() else (1850.0, 2000.0)
        img = np.where(np.isfinite(x), np.clip((x - lo) / (hi - lo), 0, 1) * 254 + 1, 0).astype(np.uint8)[::-1]
        Image.fromarray(img, "L").save(out / "latest.png")
        per_site = {}
        for slug, s in sites.items():
            dist = em.haversine_km(d.lat.values, d.lon.values, s["lat"], s["lon"])
            near, ann = dist <= 30, (dist >= 60) & (dist <= 140)
            if near.sum() == 0:
                continue
            bg = float(np.nanmedian(d.xch4.values[ann])) if ann.sum() >= 20 else None
            per_site[slug] = dict(name=s["name"], pixels=int(near.sum()),
                                  xch4_ppb=float(np.nanmean(d.xch4.values[near])),
                                  enhancement_ppb=(float(np.nanmean(d.xch4.values[near])) - bg) if bg else None,
                                  wind_ms=float(np.hypot(np.nanmean(d.u.values[near]), np.nanmean(d.v.values[near]))),
                                  wind_to_deg=float(np.degrees(np.arctan2(np.nanmean(d.u.values[near]), np.nanmean(d.v.values[near]))) % 360),
                                  time_utc=str(d.time.values[near][0])[:19])
        summary = dict(stream=stream, day=str(day), granules=len(keys), orbits=sorted(set(orbits)), pixels=int(len(d)),
                       sensing_start=str(d.time.min())[:19], sensing_end=str(d.time.max())[:19],
                       mean_xch4_ppb=float(np.nanmean(d.xch4.values)), observed_cells=int(np.isfinite(x).sum()),
                       texture=dict(file="latest.png", lo=lo, hi=hi, nodata=0,
                                    lat_edges=[float(em.LAT_EDGES[0]), float(em.LAT_EDGES[-1])],
                                    lon_edges=[float(em.LON_EDGES[0]), float(em.LON_EDGES[-1])]),
                       sites=per_site, log=log)
    summary["processed_utc"] = datetime.now(timezone.utc).isoformat()[:19]
    summary["source"] = f"Copernicus Sentinel-5P TROPOMI {stream} L2 CH4, s3://meeo-s5p (public mirror)"
    (out / "latest.json").write_text(json.dumps(summary, indent=1))
    hp = out / "history.json"
    hist = json.loads(hp.read_text()) if hp.exists() else []
    hist = [h for h in hist if not (h["day"] == summary["day"] and h["stream"] == summary["stream"])]
    hist.append({k: summary.get(k) for k in ("day", "stream", "orbits", "pixels", "mean_xch4_ppb", "observed_cells", "processed_utc")})
    hp.write_text(json.dumps(hist[-120:], indent=0))
    print(json.dumps({k: summary.get(k) for k in ("stream", "day", "orbits", "pixels", "mean_xch4_ppb")}))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
