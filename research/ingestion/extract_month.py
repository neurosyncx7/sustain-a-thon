"""
Month-scale real TROPOMI extraction, designed to run on GitHub Actions runners (full internet,
fast AWS egress) so the multi-year archive never has to pass through a laptop.

For one calendar month it:
  1. lists every real OFFL L2 CH4 granule in s3://meeo-s5p (anonymous, public),
  2. downloads each granule whose UTC start could overlap India, opens it, keeps qa>=0.5 pixels
     inside INDIA_BBOX, then deletes the granule,
  3. writes two compact products:
     a) grids/<YYYY-MM>.npz  daily 0.1-degree grids over India of the quantities the flux-
        divergence operator needs (XCH4, dry-air column, product ECMWF u/v, SWIR albedo, AOT,
        pixel count). Daily, not monthly-mean, because divergence must be computed per
        overpass before averaging (nonlinear in wind).
     b) sites/<YYYY-MM>.parquet  every pixel (with its 4 footprint corners, viewing geometry,
        precision) within SITE_RADIUS_KM of each candidate site, for the site-level
        quantifier comparison (R3) and for sub-pixel super-resolution (corners required).
Nothing is interpolated or filled: an unobserved cell is NaN with count 0.
"""
from __future__ import annotations

import argparse
import calendar
import json
import os
import re
import sys
import tempfile
import time
from datetime import date
from pathlib import Path
from xml.etree import ElementTree as ET

import numpy as np
import pandas as pd
import requests
import xarray as xr

sys.path.insert(0, str(Path(__file__).parent))
from india_bbox import INDIA_BBOX, KNOWN_SITES  # noqa: E402

BUCKET = "https://meeo-s5p.s3.amazonaws.com"
NS = {"s3": "http://s3.amazonaws.com/doc/2006-03-01/"}
GRID_DEG = 0.1
SITE_RADIUS_KM = 150.0
LAT_EDGES = np.round(np.arange(INDIA_BBOX["lat_min"], INDIA_BBOX["lat_max"] + 1e-9, GRID_DEG), 4)
LON_EDGES = np.round(np.arange(INDIA_BBOX["lon_min"], INDIA_BBOX["lon_max"] + 1e-9, GRID_DEG), 4)
NY, NX = len(LAT_EDGES) - 1, len(LON_EDGES) - 1
GRID_VARS = ["xch4", "dry_air", "u", "v", "albedo", "aot"]


def list_day(day: date) -> list[str]:
    keys, token = [], None
    while True:
        params = {"list-type": "2", "prefix": f"OFFL/L2__CH4___/{day:%Y/%m/%d}/", "max-keys": "1000"}
        if token:
            params["continuation-token"] = token
        for attempt in range(4):
            try:
                r = requests.get(BUCKET + "/", params=params, timeout=60)
                r.raise_for_status()
                break
            except requests.RequestException:
                time.sleep(2 ** attempt)
        else:
            raise RuntimeError(f"listing failed for {day}")
        root = ET.fromstring(r.content)
        keys += [c.findtext("s3:Key", namespaces=NS) for c in root.findall("s3:Contents", NS)]
        if root.findtext("s3:IsTruncated", default="false", namespaces=NS) == "true":
            token = root.findtext("s3:NextContinuationToken", namespaces=NS)
        else:
            return [k for k in keys if k.endswith(".nc")]


CDSE = "https://catalogue.dataspace.copernicus.eu/odata/v1/Products"


def catalogue_md5(name: str) -> str | None:
    """MD5 the Copernicus Data Space Ecosystem catalogue publishes for this product (keyless OData)."""
    for attempt in range(3):
        try:
            r = requests.get(CDSE, params={"$filter": f"Name eq '{name}'", "$select": "Name,Checksum"}, timeout=30)
            r.raise_for_status()
            for v in r.json().get("value", []):
                for c in v.get("Checksum") or []:
                    if str(c.get("Algorithm", "")).upper() == "MD5" and c.get("Value"):
                        return c["Value"].lower()
            return None
        except (requests.RequestException, ValueError):
            time.sleep(2 ** attempt)
    return None


def download_verified(key: str, path: Path) -> dict:
    """Stream a granule from the mirror to `path`, hashing as it arrives, then check it against the
    official Copernicus catalogue checksum. Returns an integrity record:
      verified      MD5 equals the catalogue's  -> trusted
      mismatch      MD5 differs                 -> caller must reject the granule
      unverifiable  catalogue has no checksum or is unreachable -> accepted only if the mirror's own
                    ETag (an MD5 for single-part objects) matches the bytes received, and flagged."""
    import hashlib
    md5, sha = hashlib.md5(), hashlib.sha256()
    for attempt in range(4):
        try:
            md5, sha = hashlib.md5(), hashlib.sha256()
            with requests.get(f"{BUCKET}/{key}", stream=True, timeout=300) as r:
                r.raise_for_status()
                etag = (r.headers.get("ETag") or "").strip('"').lower()
                with open(path, "wb") as f:
                    for chunk in r.iter_content(1 << 22):
                        f.write(chunk); md5.update(chunk); sha.update(chunk)
            break
        except requests.RequestException:
            time.sleep(2 ** attempt)
    else:
        return dict(status="download_failed")
    got = md5.hexdigest()
    ref = catalogue_md5(key.rsplit("/", 1)[-1])
    rec = dict(md5=got, sha256=sha.hexdigest(), catalogue_md5=ref, mirror_etag=etag or None)
    if ref:
        rec["status"] = "verified" if ref == got else "mismatch"
    elif etag and "-" not in etag:
        rec["status"] = "unverifiable" if etag == got else "mismatch"
    else:
        rec["status"] = "unverifiable"
    return rec


def utc_hour(key: str) -> int:
    m = re.search(r"CH4____\d{8}T(\d{2})", key)
    return int(m.group(1)) if m else -1


def orbit_of(key: str) -> str:
    m = re.search(r"_(\d{5})_\d{2}_\d{6}_\d{8}T\d{6}\.nc$", key)
    return m.group(1) if m else "unknown"


def haversine_km(lat1, lon1, lat2, lon2):
    p = np.pi / 180
    a = (np.sin((lat2 - lat1) * p / 2) ** 2
         + np.cos(lat1 * p) * np.cos(lat2 * p) * np.sin((lon2 - lon1) * p / 2) ** 2)
    return 12742.0 * np.arcsin(np.sqrt(a))


def read_granule(path: Path) -> pd.DataFrame | None:
    g = lambda grp: xr.open_dataset(path, group=grp, decode_timedelta=False)  # noqa: E731
    prod = g("PRODUCT")
    lat = prod["latitude"].values[0]
    lon = prod["longitude"].values[0]
    inside = ((lat >= INDIA_BBOX["lat_min"]) & (lat <= INDIA_BBOX["lat_max"]) &
              (lon >= INDIA_BBOX["lon_min"]) & (lon <= INDIA_BBOX["lon_max"]))
    qa = prod["qa_value"].values[0]
    keep = inside & (qa >= 0.5)
    if not keep.any():
        return None
    det = g("PRODUCT/SUPPORT_DATA/DETAILED_RESULTS")
    inp = g("PRODUCT/SUPPORT_DATA/INPUT_DATA")
    geo = g("PRODUCT/SUPPORT_DATA/GEOLOCATIONS")
    scan = np.broadcast_to(np.arange(lat.shape[0])[:, None], lat.shape)
    t = pd.to_datetime(prod["time_utc"].values[0].astype(str)[scan[keep]], utc=True, errors="coerce")
    latb = geo["latitude_bounds"].values[0][keep]
    lonb = geo["longitude_bounds"].values[0][keep]
    df = pd.DataFrame({
        "time": t,
        "lat": lat[keep].astype("float32"), "lon": lon[keep].astype("float32"),
        "xch4": prod["methane_mixing_ratio_bias_corrected"].values[0][keep].astype("float32"),
        "xch4_precision": prod["methane_mixing_ratio_precision"].values[0][keep].astype("float32"),
        "qa": qa[keep].astype("float32"),
        "dry_air": np.nansum(inp["dry_air_subcolumns"].values[0][keep], axis=-1).astype("float32"),
        "psurf": inp["surface_pressure"].values[0][keep].astype("float32"),
        "z_surf": inp["surface_altitude"].values[0][keep].astype("float32"),
        "u": inp["eastward_wind"].values[0][keep].astype("float32"),
        "v": inp["northward_wind"].values[0][keep].astype("float32"),
        "albedo": det["surface_albedo_SWIR"].values[0][keep].astype("float32"),
        "aot": det["aerosol_optical_thickness_SWIR"].values[0][keep].astype("float32"),
        "xco_col": det["carbonmonoxide_total_column"].values[0][keep].astype("float32"),
        "chi2": det["chi_square"].values[0][keep].astype("float32"),
        "sza": geo["solar_zenith_angle"].values[0][keep].astype("float32"),
        "vza": geo["viewing_zenith_angle"].values[0][keep].astype("float32"),
        "scanline": scan[keep].astype("int32"),
        "ground_pixel": np.broadcast_to(np.arange(lat.shape[1])[None, :], lat.shape)[keep].astype("int16"),
    })
    for k in range(4):
        df[f"lat_c{k}"] = latb[:, k].astype("float32")
        df[f"lon_c{k}"] = lonb[:, k].astype("float32")
    for ds in (prod, det, inp, geo):
        ds.close()
    return df


def grid_day(df: pd.DataFrame) -> dict[str, np.ndarray]:
    iy = np.digitize(df.lat.values, LAT_EDGES) - 1
    ix = np.digitize(df.lon.values, LON_EDGES) - 1
    ok = (iy >= 0) & (iy < NY) & (ix >= 0) & (ix < NX)
    flat = iy[ok] * NX + ix[ok]
    count = np.bincount(flat, minlength=NY * NX).astype("float32")
    out = {"count": count.reshape(NY, NX)}
    with np.errstate(invalid="ignore", divide="ignore"):
        for var in GRID_VARS:
            vals = df[var].values[ok].astype("float64")
            good = np.isfinite(vals)
            s = np.bincount(flat[good], weights=vals[good], minlength=NY * NX)
            n = np.bincount(flat[good], minlength=NY * NX)
            out[var] = np.where(n > 0, s / np.maximum(n, 1), np.nan).astype("float32").reshape(NY, NX)
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--month", required=True, help="YYYY-MM")
    ap.add_argument("--out", default="out")
    ap.add_argument("--max-days", type=int, default=None)
    ap.add_argument("--sites-file", default=None,
                    help="JSON {slug: {lat, lon, ...}}: extract windows for these sites instead of KNOWN_SITES")
    ap.add_argument("--tag", default="", help="suffix for the sites folder, e.g. 'inv' -> sites_inv/")
    ap.add_argument("--no-grids", action="store_true", help="skip the national 0.1 deg grids")
    ap.add_argument("--days", default=None, help="explicit comma-separated YYYY-MM-DD list (live mode)")
    ap.add_argument("--name", default=None, help="output file stem (default: --month); must start with YYYY-MM")
    a = ap.parse_args()
    sites = json.loads(Path(a.sites_file).read_text()) if a.sites_file else KNOWN_SITES
    site_dir = f"sites_{a.tag}" if a.tag else "sites"
    stem = a.name or a.month
    y, m = map(int, a.month.split("-"))
    out = Path(a.out)
    (out / "grids").mkdir(parents=True, exist_ok=True)
    (out / site_dir).mkdir(parents=True, exist_ok=True)

    days_out, grids, site_rows, log = [], {v: [] for v in GRID_VARS + ["count"]}, [], []
    ndays = calendar.monthrange(y, m)[1]
    day_list = ([date.fromisoformat(x) for x in a.days.split(",")] if a.days else
                [date(y, m, d) for d in range(1, (a.max_days or ndays) + 1)])
    for day in day_list:
        try:
            keys = [k for k in list_day(day) if 3 <= utc_hour(k) <= 11]
        except RuntimeError as e:
            log.append({"day": str(day), "error": str(e)})
            continue
        frames = []
        for key in keys:
            with tempfile.TemporaryDirectory() as td:
                p = Path(td) / "g.nc"
                integ = download_verified(key, p)
                if integ["status"] == "download_failed":
                    log.append({"key": key, "error": "download failed"})
                    continue
                if integ["status"] == "mismatch":
                    log.append({"key": key, "error": "integrity mismatch: rejected", "integrity": integ})
                    continue
                try:
                    df = read_granule(p)
                except Exception as e:  # corrupt/odd granule: record, never silently fill
                    log.append({"key": key, "error": repr(e)[:300]})
                    continue
            if df is None:
                continue
            df["orbit"] = orbit_of(key)
            frames.append(df)
            log.append({"key": key, "pixels": len(df), "integrity": integ["status"], "md5": integ["md5"]})
        if not frames:
            continue
        day_df = pd.concat(frames, ignore_index=True)
        days_out.append(str(day))
        if not a.no_grids:
            gd = grid_day(day_df)
            for k, arr in gd.items():
                grids[k].append(arr)
        for slug, s in sites.items():
            dist = haversine_km(day_df.lat.values, day_df.lon.values, s["lat"], s["lon"])
            sel = day_df[dist <= SITE_RADIUS_KM].copy()
            if len(sel):
                sel["site"] = slug
                sel["dist_km"] = dist[dist <= SITE_RADIUS_KM].astype("float32")
                site_rows.append(sel)
        print(f"{day}: {len(keys)} granules, {len(day_df)} India pixels", flush=True)

    if days_out and not a.no_grids:
        np.savez_compressed(
            out / "grids" / f"{stem}.npz",
            days=np.array(days_out), lat_edges=LAT_EDGES, lon_edges=LON_EDGES,
            **{k: np.stack(v) for k, v in grids.items()},
        )
    if site_rows:
        pd.concat(site_rows, ignore_index=True).to_parquet(
            out / site_dir / f"{stem}.parquet", index=False, compression="zstd")
    (out / "logs").mkdir(exist_ok=True)
    (out / "logs" / f"{stem}{'_' + a.tag if a.tag else ''}.json").write_text(json.dumps(log, indent=0))
    print(f"DONE {a.month}: {len(days_out)} days with India coverage")


if __name__ == "__main__":
    main()
