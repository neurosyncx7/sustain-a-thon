"""Transport-wind factor gamma per inventory site from ERA5 (Open-Meteo archive API, keyless).

gamma = mean(ws100) / mean(ws10) at the TROPOMI overpass hours over India (07-09 UTC), non-monsoon
months, 2023-01-01 .. (today - 10 days, ERA5T latency). Its spread is the std of the monthly ratios.
Runs on GitHub Actions (the research container has no route to open-meteo). Output: gamma.json.
usage: python fetch_gamma.py <inventory_sites.json> <out.json>
"""
from __future__ import annotations

import json, sys, time
from datetime import date, timedelta

import numpy as np
import pandas as pd
import requests

API = "https://archive-api.open-meteo.com/v1/archive"


def fetch(lat, lon, start, end):
    for attempt in range(5):
        try:
            r = requests.get(API, params=dict(latitude=lat, longitude=lon, start_date=start, end_date=end,
                                              hourly="wind_speed_10m,wind_speed_100m,boundary_layer_height",
                                              wind_speed_unit="ms", timezone="UTC"), timeout=120)
            if r.status_code == 429:
                time.sleep(30 * (attempt + 1)); continue
            r.raise_for_status()
            h = r.json()["hourly"]
            return pd.DataFrame(h).assign(time=lambda d: pd.to_datetime(d.time))
        except requests.RequestException:
            time.sleep(5 * (attempt + 1))
    raise RuntimeError("open-meteo unreachable")


def main(sites_path, out_path):
    sites = json.load(open(sites_path))
    end = (date.today() - timedelta(days=10)).isoformat()
    out = {}
    for slug, s in sites.items():
        df = fetch(s["lat"], s["lon"], "2023-01-01", end)
        df = df[df.time.dt.hour.between(7, 9) & ~df.time.dt.month.isin([6, 7, 8, 9])].dropna(subset=["wind_speed_10m", "wind_speed_100m"])
        g = df.groupby(df.time.dt.to_period("M"))
        monthly = (g.wind_speed_100m.mean() / g.wind_speed_10m.mean()).values
        blh = df.boundary_layer_height.dropna()
        out[slug] = dict(gamma=float(df.wind_speed_100m.mean() / df.wind_speed_10m.mean()),
                         gamma_sd=float(np.std(monthly, ddof=1)) if len(monthly) > 2 else None,
                         hours=int(len(df)), mean_ws10=float(df.wind_speed_10m.mean()),
                         mean_blh_m=float(blh.mean()) if len(blh) else None,
                         period=f"2023-01-01..{end}", hours_utc="07-09", months_excluded=[6, 7, 8, 9],
                         source="ERA5 via Open-Meteo archive API")
        print(slug, out[slug]["gamma"], out[slug]["gamma_sd"], flush=True)
        time.sleep(1.0)
    json.dump(out, open(out_path, "w"), indent=1)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
