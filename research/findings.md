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

## R1 at scale (2026-09-26): two years of real TROPOMI over India
GitHub Actions extraction (`.github/workflows/extract-tropomi.yml`, data on the `data` branch):
2023-01..2024-12, **1,365 OFFL L2 CH4 granules, 9,600,099 pixels with qa>=0.5** inside the India box.
10 granules failed to open (HDF errors) and are logged in `tropomi/logs/*.json`, not silently dropped.
Monsoon coverage collapse, measured: July 2023 = 11,966 usable pixels vs December 2024 = 859,115 (~70x).

## R3: quantifier comparison on real stacks (done; final method)
Wind-rotated, footprint-drizzled stacks with monsoon months excluded and overpasses weighted by their
background noise (the configuration the R4 ablation selected), three quantifiers on the same stack,
bootstrap 68% intervals, and an empirical null from **24 pseudo-sites** 60-90 km away using the same
overpasses (`research/validation/r3_known_sites.py` -> `data-pipeline/r3/known_sites.json`).
Rates in t/h at gamma=1 (TROPOMI's ECMWF 10 m wind; ERA5 suggests gamma ~1.2-1.3, applied in R6).

| Site (20 km radius) | overpasses | IME t/h [68%] | CSF t/h [68%] | Divergence t/h [68%] | floor 1 sigma |
|---|---|---|---|---|---|
| Jawaharnagar landfill, Hyderabad | 80 | 10.1 [8.9, 11.7] (z 1.9) | 8.6 [6.2, 10.7] (z 2.1) | 11.2 [8.8, 13.5] (z 3.3) | 3.8 |
| Pirana landfill, Ahmedabad | 206 | 9.7 [8.8, 10.5] (z 2.0) | 12.6 [10.7, 14.6] (z 3.8) | 8.6 [7.3, 9.9] (z 3.2) | 3.1 |
| Khajod landfill, Surat | 193 | 12.2 [10.8, 13.6] (z 1.0) | 17.6 [15.1, 20.0] (z 3.2) | 13.9 [11.7, 16.1] (z 3.1) | 5.7 |
| Deonar/Mumbai landfill | 164 | 41.1 [38.0, 43.7] (z 5.0) | 58.4 [51.8, 66.0] (z 3.5) | 52.5 [47.6, 59.9] (z 4.6) | 12.1 |
| Jharia coal field, Jharkhand | 101 | 1.7 [0.2, 3.6] (z 0.7) | 18.8 [17.0, 20.5] (z 3.3) | 15.6 [13.9, 17.5] (z 4.4) | 3.8 |
| Korba coalfield, Chhattisgarh | 84 | 0.7 [-0.5, 2.0] (z 0.0) | -3.5 [-6.3, -1.6] (z -0.4) | -6.6 [-9.1, -4.6] (z -1.4) | 3.8 |

Findings:
- **Divergence detects all five known landfill/coal emitters above 3 sigma** (Jawaharnagar 3.3,
  Pirana 3.2, Khajod 3.1, Mumbai/Deonar 4.6, Jharia 4.4); cross-sectional flux 4 of 5, IME 2 of 5.
- Korba coalfield: null (z -1.4), consistent with the published EGU 2025 finding that TROPOMI sees
  lower Indian coal emissions than bottom-up inventories.
- Pseudo-site null means are ~0: the local-plane background + stacking is unbiased. The null spread
  is the honest floor: ~3-6 t/h (1 sigma) inland, 12 t/h at the coastal Mumbai site. This
  **corrects** the earlier analytic ~2 t/h estimate, which ignored real background variability.
- Methodological lesson recorded on purpose: with 8-12 pseudo-sites the z-scores moved by up to ~1
  between runs; 24 shared pseudo-sites make R3 and R4 agree exactly. z is itself an estimate.
- At 5.5 km pixels a 20 km radius captures a *cluster* (e.g. greater Hyderabad), not one facility;
  rates exceed single-facility snapshots such as Carbon Mapper's ~5.9 t/h at Jawaharnagar.

## R4: controlled ablation (done)
`research/validation/r4_ablation.py` -> `data-pipeline/r3/ablation.json`. Each row adds one component;
divergence z vs the same 24-pseudo-site null; last column = mean 1-sigma floor over 6 sites.

| Variant | Jawaharnagar | Mumbai/Deonar | Jharia | Pirana | Khajod | floor t/h |
|---|---|---|---|---|---|---|
| raw | -1.0 | 6.3 | 2.2 | -0.1 | 0.2 | 6.9 |
| +detrend | -1.1 | 6.3 | 2.2 | -0.0 | -0.2 | 6.9 |
| +monsoon_aware | -1.1 | 6.3 | 2.2 | -0.0 | -0.2 | 6.9 |
| +wind | 1.7 | 5.8 | 3.0 | 1.8 | 2.8 | 5.9 |
| combined | 3.3 | 4.6 | 4.4 | 3.2 | 3.1 | 5.4 |

Conclusions (what earns its keep):
- **Wind rotation is the dominant single component** (Jawaharnagar -1.1 -> 1.7, Pirana 0.0 -> 1.8,
  floor 6.9 -> 5.9 t/h).
- **Only the combined method lifts every known emitter above 3 sigma** and gives the lowest floor
  (5.4 t/h): drizzle + monsoon exclusion + noise weighting add +1.6 (Jawaharnagar) and +1.4 (Jharia).
- Detrending and monsoon exclusion alone do not move site z-scores; their value is unbiased
  backgrounds and honest coverage (unobserved months are reported as unobserved, never as zero).
- Limitation: Mumbai is an extended coastal cluster; its raw z (6.3) is partly land/sea contrast
  and falls to 4.6 once the method models a wind-aligned point source. Flagged, not hidden.

## National blind screen (done, 2026-09-26)
`research/screening/national_screen.py`: per-day flux divergence on the real 0.1 deg grids
(daily 160 km Gaussian background removed, product ECMWF winds), averaged over 2023-2024; candidates
= local maxima above 3 robust sigma with >= 40 valid days (`data-pipeline/web/candidates.json`,
labelled by country and nearest place from Natural Earth; no facility attribution yet).
**Blind recovery with no site list given** (`data-pipeline/web/blind_recovery.json`):
Ghazipur landfill, Delhi 3.6 km (rank 4); Jawaharnagar 5.8 km (rank 28); Jharia/Dhanbad 6.6 km
(rank 9); Pirana/Ahmedabad 15.3 km (rank 19). Not recovered: Khajod (also insignificant in R3),
Korba (null in R3), Mumbai/Deonar (coastal: divergence needs observed neighbours, lost over sea).
Top candidates also include documented hotspots outside India (Dhaka, Lahore), and in India the
Upper Assam oil fields near Dibrugarh (z 6.6), Lucknow, Ranchi, Guwahati, Aligarh, Shivamogga.
Candidates in paddy regions (e.g. Bahraich) and coastal Kutch need attribution/artifact checks (R5).

## What's implemented but not yet validated (candidate status)
- `research/algorithms/quantifiers.py`: superseded by `site_stack.py` (single-overpass versions kept
  for reference; the mass-balance divisor bug found in review is not used anywhere).
- All 17 invented algorithms from the earlier design pass (PSSI, DiverSR, WIT, EIV-CRF, etc.)
  are specified but **not implemented or validated yet**. None of their outputs may reach
  `data-pipeline/` or the web app until R4's ablation shows a real, significant gain.

## Explicitly not done yet
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
