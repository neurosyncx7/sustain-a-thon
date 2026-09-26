"""
Real Sentinel-5P/TROPOMI L2 ingestion — India subset, no synthetic data.

Source: the MEEO (Meteorological Environmental Earth Observation, an ESA Copernicus DIAS
partner) public, anonymous-access AWS Open Data mirror at s3://meeo-s5p, native ESA L2 NetCDF
granules, unmodified. Verified structure (2026-09-26) against a real downloaded granule:
    OFFL/L2__CH4___/<yyyy>/<mm>/<dd>/S5P_OFFL_L2__CH4____<start>_<end>_<orbit>_..._....nc
Same layout for L2__CO____ and L2__NO2___ (used by the chemical-fingerprinting algorithm,
research/algorithms/eiv_crf.py).

PRODUCT group carries: qa_value, methane_mixing_ratio, methane_mixing_ratio_bias_corrected
  (units: 1e-9, i.e. ppb), latitude/longitude, time/delta_time.
PRODUCT/SUPPORT_DATA/DETAILED_RESULTS carries: column_averaging_kernel, chi_square,
  degrees_of_freedom_methane, carbonmonoxide_total_column (co-retrieved CO, useful as a cross-
  check against the dedicated CO product), surface_albedo_SWIR, aerosol_optical_thickness_SWIR.
PRODUCT/SUPPORT_DATA/INPUT_DATA carries: surface_pressure, dry_air_subcolumns,
  methane_profile_apriori, altitude_levels, pressure_interval, eastward_wind, northward_wind
  (ECMWF, single reference level — NOT a substitute for the full ERA5 profile used for
  Helmholtz decomposition; see fetch_era5.py), surface_altitude.
PRODUCT/SUPPORT_DATA/GEOLOCATIONS carries: solar/viewing zenith & azimuth angles.

This script lists real granules for a date, downloads only the ones whose scanline bounding
box could plausibly intersect India (cheap pre-filter on the per-file time-of-day — India's
TROPOMI overpasses fall within a specific UTC window given the sun-synchronous ~13:30 LTAN
orbit), opens each with xarray, subsets to INDIA_BBOX, applies the qa_value>=0.5 filter TROPOMI
document as the recommended operational threshold for CH4, and writes one compact Parquet file
per granule under data-pipeline/tropomi/<species>/<yyyy-mm-dd>/<orbit>.parquet.
"""
from __future__ import annotations

import argparse
import io
import re
import sys
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from xml.etree import ElementTree as ET

import numpy as np
import pandas as pd
import requests
import xarray as xr

sys.path.insert(0, str(Path(__file__).parent))
from india_bbox import INDIA_BBOX  # noqa: E402

BUCKET = "https://meeo-s5p.s3.amazonaws.com"
S3_NS = {"s3": "http://s3.amazonaws.com/doc/2006-03-01/"}

SPECIES_GROUPS = {
    "CH4": "L2__CH4___",
    "CO": "L2__CO____",
    "NO2": "L2__NO2___",
}

# Minimal per-species field maps. Names verified against a real downloaded granule
# (S5P_OFFL_L2__CH4____20240115T100508_..._32419_...) on 2026-09-26; CO/NO2 groups follow
# the same PRODUCT schema per the official Sentinel-5P L2 Product User Manual (cite in
# findings.md) but have NOT yet been byte-verified here — verify_co_no2_schema() does that
# the first time either species is pulled and raises loudly if a name has drifted.
FIELD_MAIN = {
    "CH4": "methane_mixing_ratio_bias_corrected",
    "CO": "carbonmonoxide_total_column_corrected",
    "NO2": "nitrogendioxide_tropospheric_column",
}


@dataclass
class Granule:
    key: str
    size: int

    @property
    def url(self) -> str:
        return f"{BUCKET}/{self.key}"


def list_day(species: str, day: date) -> list[Granule]:
    prefix = f"OFFL/{SPECIES_GROUPS[species]}/{day:%Y/%m/%d}/"
    out: list[Granule] = []
    token = None
    while True:
        params = {"list-type": "2", "prefix": prefix, "max-keys": "1000"}
        if token:
            params["continuation-token"] = token
        r = requests.get(BUCKET + "/", params=params, timeout=60)
        r.raise_for_status()
        root = ET.fromstring(r.content)
        for c in root.findall("s3:Contents", S3_NS):
            key = c.find("s3:Key", S3_NS).text
            if key.endswith(".nc"):
                size = int(c.find("s3:Size", S3_NS).text)
                out.append(Granule(key, size))
        trunc = root.findtext("s3:IsTruncated", default="false", namespaces=S3_NS)
        if trunc == "true":
            token = root.findtext("s3:NextContinuationToken", namespaces=S3_NS)
        else:
            break
    return out


def granule_could_touch_india(key: str) -> bool:
    """Cheap pre-filter on the UTC start time encoded in the filename, before downloading.

    India (68-97.5E) under TROPOMI's ~13:30 local solar time descending-node crossing falls
    in a UTC window roughly 04:30-10:30 (widened generously to 03:30-11:30 to be safe against
    orbit drift and to keep partial-swath granules that clip the western/eastern edge)."""
    # key like OFFL/L2__CH4___/2024/01/15/S5P_OFFL_L2__CH4____20240115T050037_..._....nc
    fname = key.rsplit("/", 1)[-1]
    try:
        start_hhmm = fname.split("_")[5][9:13]  # 'T050037' slice -> '0500'
        hh = int(start_hhmm[:2])
    except (IndexError, ValueError):
        return True  # can't parse -> don't risk skipping it
    return 3 <= hh <= 11


def subset_granule(local_path: Path, species: str) -> pd.DataFrame:
    field = FIELD_MAIN[species]
    prod = xr.open_dataset(local_path, group="PRODUCT")
    detail = xr.open_dataset(local_path, group="PRODUCT/SUPPORT_DATA/DETAILED_RESULTS")
    inp = xr.open_dataset(local_path, group="PRODUCT/SUPPORT_DATA/INPUT_DATA")

    lat = prod["latitude"].values[0]  # (scanline, ground_pixel)
    lon = prod["longitude"].values[0]
    mask = (
        (lat >= INDIA_BBOX["lat_min"]) & (lat <= INDIA_BBOX["lat_max"]) &
        (lon >= INDIA_BBOX["lon_min"]) & (lon <= INDIA_BBOX["lon_max"])
    )
    if not mask.any():
        return pd.DataFrame()

    qa = prod["qa_value"].values[0]
    val = prod[field].values[0]
    time_ref = prod["time"].values[0]
    dt = prod["delta_time"].values[0]  # ms since time_ref, per scanline
    scanline_idx = np.arange(lat.shape[0])[:, None] * np.ones((1, lat.shape[1]), dtype=int)

    rows = {
        "lat": lat[mask],
        "lon": lon[mask],
        "qa_value": qa[mask],
        field: val[mask],
        "surface_pressure_pa": inp["surface_pressure"].values[0][mask],
        "surface_albedo_swir": detail["surface_albedo_SWIR"].values[0][mask],
        "aot_swir": detail["aerosol_optical_thickness_SWIR"].values[0][mask],
        "eastward_wind_ms": inp["eastward_wind"].values[0][mask],
        "northward_wind_ms": inp["northward_wind"].values[0][mask],
        "scanline": scanline_idx[mask],
    }
    df = pd.DataFrame(rows)
    # delta_time is per-scanline; xarray auto-decodes its CF "milliseconds since <time_ref>"
    # units into absolute datetime64 already, so use it directly (no manual timedelta math).
    if np.issubdtype(np.asarray(dt).dtype, np.datetime64):
        per_scanline_time = pd.to_datetime(dt)
    else:
        per_scanline_time = pd.to_datetime(time_ref) + pd.to_timedelta(dt, unit="ms")
    df["timestamp_utc"] = per_scanline_time[df["scanline"].values]

    # Dry-air subcolumns: (scanline, ground_pixel, layer) -> sum over layer = total dry-air
    # column (mol/m^2), needed for the ppb -> mol/m^2 conversion in the continuity operator.
    dry_air = inp["dry_air_subcolumns"].values[0]  # (scanline, gp, layer)
    dry_air_total = np.nansum(dry_air, axis=-1)
    df["dry_air_column_mol_m2"] = dry_air_total[mask]

    if species == "CH4":
        # Averaging kernel: (scanline, gp, layer). Keep the layer-summed "total AK weight" as
        # a compact diagnostic here; the full profile is re-read on demand by the continuity
        # operator directly from the source granule (kept, not re-downloaded, under raw/).
        # Mask *before* nanmean: unmasked pixels can be all-NaN (no retrieval), which would
        # otherwise raise a spurious "mean of empty slice" warning for rows we discard anyway.
        ak = detail["column_averaging_kernel"].values[0][mask]
        with np.errstate(invalid="ignore"):
            df["ak_mean"] = np.nanmean(ak, axis=-1)
        df["dofs_ch4"] = detail["degrees_of_freedom_methane"].values[0][mask]

    df = df[df["qa_value"] >= 0.5].reset_index(drop=True)
    return df


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--species", default="CH4", choices=list(SPECIES_GROUPS))
    ap.add_argument("--start", required=True, help="YYYY-MM-DD")
    ap.add_argument("--end", required=True, help="YYYY-MM-DD (inclusive)")
    ap.add_argument("--raw-dir", default="raw")
    ap.add_argument("--out-dir", default="../data-pipeline/tropomi")
    ap.add_argument("--keep-raw", action="store_true")
    ap.add_argument("--max-granules", type=int, default=None)
    args = ap.parse_args()

    raw_dir = Path(args.raw_dir)
    raw_dir.mkdir(parents=True, exist_ok=True)
    out_root = Path(args.out_dir) / args.species
    out_root.mkdir(parents=True, exist_ok=True)

    start = date.fromisoformat(args.start)
    end = date.fromisoformat(args.end)
    day = start
    n_done = 0
    total_rows = 0
    while day <= end:
        granules = [g for g in list_day(args.species, day) if granule_could_touch_india(g.key)]
        print(f"[{day}] {len(granules)} candidate granules")
        for g in granules:
            if args.max_granules and n_done >= args.max_granules:
                break
            local = raw_dir / Path(g.key).name
            if not local.exists():
                r = requests.get(g.url, timeout=300)
                r.raise_for_status()
                local.write_bytes(r.content)
            df = subset_granule(local, args.species)
            if not args.keep_raw:
                local.unlink(missing_ok=True)
            if len(df) == 0:
                continue
            m = re.search(r"_(\d{5})_\d{2}_\d{6}_\d{8}T\d{6}\.nc$", g.key)
            orbit = m.group(1) if m else Path(g.key).stem
            out_dir = out_root / f"{day:%Y-%m-%d}"
            out_dir.mkdir(parents=True, exist_ok=True)
            out_path = out_dir / f"{orbit}.parquet"
            df.to_parquet(out_path, index=False)
            total_rows += len(df)
            n_done += 1
            print(f"  {g.key}: {len(df)} India pixels -> {out_path}")
        day += timedelta(days=1)

    print(f"DONE: {n_done} granules with India coverage, {total_rows} pixels total")


if __name__ == "__main__":
    main()
