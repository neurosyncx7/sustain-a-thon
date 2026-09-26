"""
Three real emission-quantification methods, run against the same pixel data, so R3 can compare
them honestly instead of asserting the divergence method is best.

All three operate on a DataFrame with columns: lat, lon, methane_mixing_ratio_bias_corrected
(ppb), dry_air_column_mol_m2, plus a wind field (eastward_wind_ms, northward_wind_ms) — exactly
what research/ingestion/fetch_tropomi.py produces. No synthetic fallback: if a required column
is missing, these raise, they don't substitute a placeholder.

Status: candidate. Not validated until research/validation/known_sites.py runs all three
against the sites in india_bbox.KNOWN_SITES and research/validation/ablation.py confirms which
wins on the OSSE.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

PPB = 1e-9


def _grid_pixels(df: pd.DataFrame, cell_deg: float) -> tuple[np.ndarray, np.ndarray, dict]:
    """Bin scattered TROPOMI pixels onto a regular lat/lon grid (nearest-cell mean).

    Real L2 data is swath-scattered, not gridded, so every method here needs this step before
    any spatial derivative or integral. cell_deg should not be finer than the pixel's own
    footprint (~0.03-0.05 deg at nadir) or bins become mostly empty."""
    lat_edges = np.arange(df.lat.min() - cell_deg, df.lat.max() + cell_deg, cell_deg)
    lon_edges = np.arange(df.lon.min() - cell_deg, df.lon.max() + cell_deg, cell_deg)
    lat_c = (lat_edges[:-1] + lat_edges[1:]) / 2
    lon_c = (lon_edges[:-1] + lon_edges[1:]) / 2
    li = np.clip(np.digitize(df.lat.values, lat_edges) - 1, 0, len(lat_c) - 1)
    lj = np.clip(np.digitize(df.lon.values, lon_edges) - 1, 0, len(lon_c) - 1)
    return lat_c, lon_c, dict(li=li, lj=lj)


def gridded_enhancement(df: pd.DataFrame, cell_deg: float, field: str,
                         background_pctile: float = 10.0):
    """Grid a field and return (lat_centers, lon_centers, grid, background_scalar)."""
    lat_c, lon_c, idx = _grid_pixels(df, cell_deg)
    grid = np.full((len(lat_c), len(lon_c)), np.nan)
    counts = np.zeros_like(grid)
    for v, i, j in zip(df[field].values, idx["li"], idx["lj"]):
        if np.isnan(grid[i, j]):
            grid[i, j] = 0.0
        grid[i, j] += v
        counts[i, j] += 1
    with np.errstate(invalid="ignore"):
        grid = grid / np.where(counts == 0, np.nan, counts)
    bg = np.nanpercentile(grid, background_pctile)
    return lat_c, lon_c, grid, bg


def ime_method(df: pd.DataFrame, site_lat: float, site_lon: float, radius_km: float,
               cell_deg: float = 0.05, wind_speed_ms: float | None = None) -> dict:
    """Integrated Mass Enhancement: sum the excess column mass in a disk around the site,
    divide by an effective residence time L/U (Frankenberg et al. 2016 formulation).

    Requires wind_speed_ms (use the mean of eastward/northward wind over the disk if not
    given). Returns emission rate in kg/h plus the diagnostic pieces so R3 can show its work."""
    lat_c, lon_c, grid_ppb, bg_ppb = gridded_enhancement(
        df, cell_deg, "methane_mixing_ratio_bias_corrected")
    _, _, grid_dryair, _ = gridded_enhancement(df, cell_deg, "dry_air_column_mol_m2")

    cell_km = cell_deg * 111.0  # good enough at India's latitudes for a first-order estimate
    LI, LJ = np.meshgrid(lat_c, lon_c, indexing="ij")
    dist_km = np.sqrt(((LI - site_lat) * 111.0) ** 2 +
                       ((LJ - site_lon) * 111.0 * np.cos(np.radians(site_lat))) ** 2)
    disk = dist_km <= radius_km

    enhancement_ppb = grid_ppb - bg_ppb
    enhancement_ppb = np.where(disk & ~np.isnan(enhancement_ppb), enhancement_ppb, 0.0)
    mol_m2 = enhancement_ppb * PPB * np.nan_to_num(grid_dryair)  # excess, mol/m^2, zero outside disk
    cell_area_m2 = (cell_km * 1000) ** 2
    total_excess_mol = float(np.nansum(mol_m2) * cell_area_m2)

    if wind_speed_ms is None:
        wind_speed_ms = float(
            np.sqrt(df.eastward_wind_ms.mean() ** 2 + df.northward_wind_ms.mean() ** 2))
    L_m = radius_km * 1000.0
    residence_s = L_m / max(wind_speed_ms, 0.5)  # floor to avoid divide-by-near-zero
    mol_per_s = total_excess_mol / residence_s
    kg_per_h = mol_per_s * 16.04e-3 * 3600.0

    return dict(method="IME", emission_kg_h=kg_per_h, total_excess_mol=total_excess_mol,
                wind_speed_ms=wind_speed_ms, residence_s=residence_s, n_disk_cells=int(disk.sum()))


def cross_sectional_mass_balance(df: pd.DataFrame, site_lat: float, site_lon: float,
                                  transect_half_width_km: float, cell_deg: float = 0.05) -> dict:
    """Classic aircraft-style mass balance adapted to a satellite scene: integrate the
    downwind-normal flux of excess column mass across a transect perpendicular to the mean
    wind, some distance downwind of the site (here: at the edge of the gridded scene in the
    mean-wind direction from the site, since we don't have repeated flight legs)."""
    lat_c, lon_c, grid_ppb, bg_ppb = gridded_enhancement(
        df, cell_deg, "methane_mixing_ratio_bias_corrected")
    _, _, grid_dryair, _ = gridded_enhancement(df, cell_deg, "dry_air_column_mol_m2")

    u = float(df.eastward_wind_ms.mean())
    v = float(df.northward_wind_ms.mean())
    speed = float(np.hypot(u, v))
    if speed < 0.5:
        return dict(method="mass_balance", emission_kg_h=np.nan, note="wind too weak/ambiguous")
    heading = np.degrees(np.arctan2(v, u))  # deg, math convention (0=east)

    cell_km = cell_deg * 111.0
    LI, LJ = np.meshgrid(lat_c, lon_c, indexing="ij")
    dx_km = (LJ - site_lon) * 111.0 * np.cos(np.radians(site_lat))
    dy_km = (LI - site_lat) * 111.0
    # rotate into downwind (s) / crosswind (n) coordinates
    theta = np.radians(heading)
    s = dx_km * np.cos(theta) + dy_km * np.sin(theta)
    n = -dx_km * np.sin(theta) + dy_km * np.cos(theta)

    downwind_band = (s > 5.0) & (s < 5.0 + cell_km * 3) & (np.abs(n) <= transect_half_width_km)
    enhancement_ppb = np.where(downwind_band, grid_ppb - bg_ppb, 0.0)
    mol_m2 = np.nan_to_num(enhancement_ppb) * PPB * np.nan_to_num(grid_dryair)
    flux_mol_s = np.nansum(mol_m2) * (cell_km * 1000) * speed / max((downwind_band.sum(axis=0) > 0).sum(), 1)
    kg_per_h = flux_mol_s * 16.04e-3 * 3600.0

    return dict(method="mass_balance", emission_kg_h=kg_per_h, wind_speed_ms=speed,
                wind_heading_deg=heading, n_transect_cells=int(downwind_band.sum()))
