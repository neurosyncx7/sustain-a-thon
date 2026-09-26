# PS-13-S3 research status (source of truth for /web copy)

Last updated: 2026-09-26. This file is the only place the web app's content layer should pull
numbers/claims from — never hardcode a figure in a component that isn't traceable to here.

## What's real and verified (R1, R2 — done)
- **Ingestion** (`research/ingestion/fetch_tropomi.py`, `fetch_era5.py`): pulls real Sentinel-5P
  L2 CH4 granules from the public anonymous MEEO AWS mirror and real ERA5 (boundary_layer_height,
  surface pressure, 10m/100m wind) from Open-Meteo's keyless archive API. **Run end-to-end
  against live data on 2026-09-26**, not mocked:
  - 2024-01-15, India: 3 real TROPOMI orbits (32416-32418) intersect the bbox; 19,619 pixels
    survive the qa_value≥0.5 filter. Mean XCH4 = 1931.8 ppb (matches real global background for
    Jan 2024), dry-air column ≈ 344.6k mol/m² (consistent with the p_s/(g·M_air) sanity check
    in the derivation doc). Data committed at `data-pipeline/tropomi/CH4/2024-01-15/`.
  - Real ERA5 pulled for all 6 known candidate sites, 2024-01-10..20, at
    `data-pipeline/era5/<site>.parquet`.
- **Continuity-equation derivation** (`research/derivations/continuity_equation.md`): full
  chain from 3D mass conservation to the operational column-divergence formula, including the
  ppb→mol/m² conversion using the product's own `dry_air_subcolumns`, the averaging-kernel
  attenuation mechanism (using real `column_averaging_kernel`/`degrees_of_freedom_methane`),
  and why the background-subtraction step belongs *after* the divergence (in flux space), not
  before it (in concentration space) — the key correction to the original proposal.

## What's implemented but not yet validated (candidate status)
- `research/algorithms/quantifiers.py`: IME and cross-sectional mass-balance methods, real
  code, not yet run against a known site to compare against the divergence method (R3 — next).
- All 17 invented algorithms from the earlier design pass (PSSI, DiverSR, WIT, EIV-CRF, etc.)
  are specified but **not implemented or validated yet**. None of their outputs may reach
  `data-pipeline/` or the web app until R4's ablation shows a real, significant gain.

## Explicitly not done yet
- R3 (compare divergence vs IME vs mass-balance on real known sites)
- R4 (ablation across raw/detrend/monsoon-aware/wind/combined + candidate algorithms)
- R5 (validation against Carbon Mapper / UNEP-IMEO MARS / independent plume catalogues)
- R6 (Monte Carlo uncertainty, calibration of the proxy into a physical emission rate)
- The full averaging-kernel-corrected divergence operator itself is derived but not yet coded
  and run on a real multi-week stack.

## Honest scope note
This is a multi-week research program (the original problem statement's own scope, and the
review document's validation plan, both say so explicitly). What exists now is a real,
verified foundation: live data reaching the pipeline, a checked derivation, and two of three
quantification methods implemented. The inventory of prioritized sites with calibrated
emission rates and uncertainty bounds — the deliverable — is not ready, and nothing in
`data-pipeline/` should be presented as if it were the final ranked inventory until R3-R6 land.
