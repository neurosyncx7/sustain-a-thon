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

## R3: quantifier comparison on real stacks (done)
Wind-rotated, footprint-drizzled stacks (`research/algorithms/site_stack.py`), three quantifiers on the
same stack, bootstrap 68% intervals, and an empirical null from pseudo-sites 60-90 km away using the
same overpasses (`research/validation/r3_known_sites.py`, output `data-pipeline/r3/known_sites.json`).
Rates in t/h at gamma=1 (TROPOMI's ECMWF 10 m wind; the transport-wind factor gamma>1 is applied in R6).

| Site (20 km radius) | overpasses | IME t/h [68%] | CSF t/h [68%] | Divergence t/h [68%] |
|---|---|---|---|---|
| Jawaharnagar landfill, Hyderabad | 80 | 10.7 [9.6, 12.3] (z 1.7) | 9.7 [6.8, 12.2] (z 1.9) | 12.0 [9.5, 14.4] (z 3.1) |
| Pirana landfill, Ahmedabad | 212 | 9.1 [8.0, 9.9] (z 1.7) | 13.4 [11.6, 15.1] (z 2.3) | 10.1 [8.9, 11.6] (z 1.8) |
| Khajod landfill, Surat | 195 | 13.5 [11.9, 15.0] (z 1.1) | 16.3 [13.7, 19.0] (z 0.9) | 14.7 [11.6, 17.6] (z 1.3) |
| Deonar/Mumbai landfill | 165 | 40.6 [38.1, 43.7] (z 5.2) | 55.0 [48.9, 61.7] (z 6.7) | 51.3 [45.7, 59.3] (z 6.0) |
| Jharia coal field, Jharkhand | 103 | 3.0 [1.2, 4.7] (z 1.3) | 18.7 [16.6, 20.3] (z 3.3) | 15.9 [13.8, 17.5] (z 4.3) |
| Korba coalfield, Chhattisgarh | 85 | 0.7 [-0.6, 1.9] (z 0.3) | -1.7 [-4.6, 1.2] (z 0.1) | -7.3 [-9.8, -4.8] (z -1.0) |

Findings:
- Pseudo-site null means are ~0 for all methods: the local-plane background + stacking is unbiased.
- The null spread is the honest detection floor: ~4-7 t/h (1 sigma) per site over two years, i.e. a
  3-sigma floor of roughly 11-20 t/h for a 20 km cluster. This **corrects** the earlier analytic
  estimate (~2 t/h), which ignored real background variability.
- Divergence has the tightest null at most sites and the highest z at Jawaharnagar and Jharia.
- At 5.5 km pixels a 20 km radius captures a *cluster* (e.g. greater Hyderabad), not one facility;
  rates are therefore cluster rates and are expected to exceed single-facility snapshots such as
  Carbon Mapper's ~5.9 t/h for the Jawaharnagar landfill.
- Korba coalfield: no detection (all methods within the null). Consistent with the published
  EGU 2025 finding that TROPOMI sees lower Indian coal emissions than bottom-up inventories.

## R4: controlled ablation (done)
`research/validation/r4_ablation.py`, output `data-pipeline/r3/ablation.json`. Each row adds one
component. Divergence z-score vs pseudo-site null; last column = mean 1-sigma floor over 6 sites.

| Variant | Jawaharnagar | Mumbai/Deonar | Jharia | Pirana | floor t/h |
|---|---|---|---|---|---|
| raw | -0.5 | 7.5 | 2.9 | 0.4 | 7.1 |
| +detrend | -0.6 | 6.8 | 3.0 | 0.4 | 6.7 |
| +monsoon_aware | -1.0 | 7.0 | 2.7 | -0.0 | 7.1 |
| +wind | 2.5 | 6.2 | 3.1 | 2.7 | 5.4 |
| combined | 3.9 | 3.8 | 5.3 | 3.2 | 6.6 |

Conclusions (what earns its keep):
- **Wind rotation is the dominant component** (Jawaharnagar -1.0 -> 2.5, Pirana 0.0 -> 2.7; lowest floor).
- **Only the combined method puts all four known emitters above 3 sigma.** Footprint drizzle adds
  +1.4 sigma at Jawaharnagar and +2.2 at Jharia.
- Monsoon-aware filtering does not raise site z-scores by itself; its job is honest coverage (months
  with no observation are reported as unobserved, never as zero), which matters for the inventory.
- Limitation: the extended coastal Mumbai cluster loses significance under drizzle+rotation
  (7.5 raw -> 3.8), likely land/sea retrieval contrast and a non-point source. Flagged, not hidden.

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
- `research/algorithms/quantifiers.py`: IME and cross-sectional mass-balance methods, real
  code, not yet run against a known site to compare against the divergence method (R3 — next).
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
