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
Monsoon coverage collapse, measured: July 2023 = 11,966 usable pixels vs December 2024 = 859,115. Per-day average over 2023-2026: July 600 vs December 26,554 (~44x).

## R3: quantifier comparison on real stacks (done; final method)
Wind-rotated, footprint-drizzled stacks with monsoon months excluded, overpasses weighted by their
background noise and the albedo/aerosol bias removed (ABD) - the configuration R4 + R5 selected - three quantifiers on the same stack,
bootstrap 68% intervals, and an empirical null from **24 pseudo-sites** 60-90 km away using the same
overpasses (`research/validation/r3_known_sites.py` -> `data-pipeline/r3/known_sites.json`).
Rates in t/h at gamma=1 (TROPOMI's ECMWF 10 m wind; ERA5 suggests gamma ~1.2-1.3, applied in R6).

| Site (20 km radius) | overpasses | IME t/h [68%] | CSF t/h [68%] | Divergence t/h [68%] | floor 1 sigma |
|---|---|---|---|---|---|
| Jawaharnagar landfill, Hyderabad | 80 | 8.6 [7.3, 10.3] (z 2.0) | 9.6 [6.7, 12.1] (z 1.9) | 12.2 [9.9, 14.4] (z 3.6) | 3.7 |
| Pirana landfill, Ahmedabad | 206 | 7.6 [6.6, 8.4] (z 1.3) | 13.9 [11.9, 15.6] (z 4.3) | 9.6 [8.4, 11.1] (z 4.1) | 2.7 |
| Khajod landfill, Surat | 193 | 11.6 [10.3, 12.9] (z 1.6) | 18.2 [15.6, 20.5] (z 3.0) | 14.4 [12.0, 16.7] (z 3.9) | 4.6 |
| Deonar/Mumbai landfill | 164 | 43.3 [39.8, 46.5] (z 5.3) | 60.1 [52.9, 67.8] (z 3.7) | 53.2 [47.9, 60.7] (z 5.2) | 11.0 |
| Jharia coal field, Jharkhand | 101 | 4.2 [2.9, 5.6] (z 1.2) | 20.4 [18.4, 22.5] (z 3.5) | 17.1 [15.5, 19.1] (z 5.2) | 3.5 |
| Korba coalfield, Chhattisgarh | 84 | 2.0 [1.2, 2.9] (z 0.6) | -1.8 [-3.9, -0.3] (z -0.4) | -2.8 [-4.7, -1.1] (z -0.8) | 3.0 |

Findings:
- **Divergence detects all five known landfill/coal emitters above 3 sigma** (Jawaharnagar 3.2,
  Pirana 3.6, Khajod 3.3, Mumbai/Deonar 5.0, Jharia 5.3); cross-sectional flux 4 of 5, IME 1 of 5.
- Korba coalfield: null (z -0.8), consistent with the published EGU 2025 finding that TROPOMI sees
  lower Indian coal emissions than bottom-up inventories.
- Pseudo-site null means are ~0: the local-plane background + stacking is unbiased. The null spread
  is the honest floor: ~3-5 t/h (1 sigma) inland, 11 t/h at the coastal Mumbai site. This
  **corrects** the earlier analytic ~2 t/h estimate, which ignored real background variability.
- Methodological lesson recorded on purpose: with 8-12 pseudo-sites the z-scores moved by up to ~1
  between runs; 24 shared pseudo-sites make R3 and R4 agree exactly. z is itself an estimate.
- At 5.5 km pixels a 20 km radius captures a *cluster* (e.g. greater Hyderabad), not one facility;
  rates exceed single-facility snapshots such as Carbon Mapper's ~5.9 t/h at Jawaharnagar.

## R4: controlled ablation (done)
`research/validation/r4_ablation.py` -> `data-pipeline/r3/ablation.json`. Each row adds one component;
divergence z vs the same 24-pseudo-site null; last column = mean 1-sigma floor over 6 sites.
**Correction (2026-09-26):** the first R4 run built its "raw" baseline from `StackConfig()` defaults that
had already become the final method, so rows 1-2 silently included monsoon exclusion and noise
weighting. The baseline now switches every component off explicitly; the table below is the rerun.

| Variant | Jawaharnagar | Mumbai/Deonar | Jharia | Pirana | Khajod | floor t/h |
|---|---|---|---|---|---|---|
| raw | -0.5 | 6.1 | 2.2 | 0.2 | 0.2 | 7.3 |
| +detrend | -0.7 | 6.2 | 2.1 | 0.2 | 0.0 | 7.1 |
| +monsoon_aware | -1.1 | 6.3 | 2.2 | -0.0 | -0.2 | 6.9 |
| +wind | 1.7 | 5.8 | 3.0 | 1.8 | 2.8 | 5.9 |
| combined | 3.3 | 4.6 | 4.4 | 3.2 | 3.1 | 5.4 |
| +ABD | 3.2 | 5.0 | 5.3 | 3.6 | 3.3 | 5.0 |
| +KPW | 3.6 | 5.2 | 5.2 | 4.1 | 3.9 | 4.8 |

Conclusions (what earns its keep):
- The floor falls at every step: 7.3 (raw) -> 7.1 (plane background) -> 6.9 (monsoon exclusion +
  noise weighting) -> 5.9 (wind rotation) -> 5.4 (footprint drizzle) -> 5.0 t/h (ABD, from R5).
- **Wind rotation is the dominant single component** (Jawaharnagar -1.1 -> 1.7, Pirana 0.0 -> 1.8).
- **Only the combined method lifts every known emitter above 3 sigma**; drizzle adds +1.6
  (Jawaharnagar) and +1.4 (Jharia); ABD adds a further +0.9 at Jharia and +0.4 at Pirana.
- Detrending and monsoon exclusion alone barely move site z-scores; their value is unbiased
  backgrounds and honest coverage (unobserved months are reported as unobserved, never as zero).
- Limitation: Mumbai is an extended coastal cluster; its raw z (6.1) is partly land/sea contrast
  and falls to 4.6-5.0 once the method models a wind-aligned point source. Flagged, not hidden.

## National blind screen (done, 2026-09-26)
`research/screening/national_screen.py`: per-day flux divergence on the real 0.1 deg grids
(daily 160 km Gaussian background removed, product ECMWF winds), averaged over 2023-2024; candidates
= local maxima above 3 robust sigma with >= 40 valid days (`data-pipeline/web/candidates.json`,
labelled by country and nearest place from Natural Earth; no facility attribution yet).
**Blind recovery with no site list given** (`data-pipeline/web/blind_recovery.json`):
Ghazipur landfill, Delhi 3.8 km (rank 4); Jawaharnagar 5.8 km (rank 28); Jharia/Dhanbad 6.6 km
(rank 9); Pirana/Ahmedabad 15.3 km (rank 19). Not recovered: Khajod (also insignificant in R3),
Korba (null in R3), Mumbai/Deonar (coastal: divergence needs observed neighbours, lost over sea).
Top candidates also include documented hotspots outside India (Dhaka, Lahore), and in India the
Upper Assam oil fields near Dibrugarh (z 6.6), Lucknow, Ranchi, Guwahati, Aligarh, Shivamogga.
Candidates in paddy regions (e.g. Bahraich) and coastal Kutch need attribution/artifact checks (R5).

## R5: the invented algorithms, tested one by one on real data (updated 2026-09-27)
`research/validation/r5_algorithms.py` -> `data-pipeline/r5/*.json`. Each test's pass mark is in the code
before the run; status of every design is generated into `data-pipeline/inventory/algorithms.json`
(10 validated and running, 1 partial, 4 failed, 4 not built).

| Algorithm | Test on real TROPOMI | Result | Status |
|---|---|---|---|
| ABD albedo/aerosol bias decorrelation | final vs final+ABD, 6 sites, 24-site null | mean z 3.74 -> 4.06; floor 5.4 -> 5.0 t/h | **validated, running** |
| KPW phase-weighted stacking | final vs final+KPW | mean z 4.06 -> 4.37; floor 4.96 -> 4.76 t/h | **validated, running** |
| OBC injection-recovery | 5-40 t/h plumes added to real pixels of 24 pseudo-sites | slope 0.992 (R^2 0.9999); P(z>3) 5 t/h 8%, 10 t/h 46%, 20 t/h 100%, 40 t/h 100% | **validated, running** |
| Confirmed-tier gate (BY-FDR + corroboration) | 6 references + 36 fake candidates | BY alone admits 2/36 fakes; with the second-estimator check 1/36; 4/5 emitters confirmed | **validated, running** |
| EIV-CRF CO/CH4 ratio | CO stacked like CH4, same overpasses | ratio clears the combustion boundary at 3/5 (khajod, deonar, jharia); passed narrowly with the KPW method (2/5 before) | **validated, running** (process evidence only) |
| VOIT tasking | backtest: 2023-24 VOI vs re-detection in 2025-26 | top third 54% vs rest 18% (Fisher p 0.025, n 41) | **validated, running** |
| WIT wind-invariance | centred vs edge-offset injected sources | false-reject 25%, power 4% | failed |
| PSSI-lite sparse + smooth | 3.4-year divergence field | recovery 0 vs screen 3; sign-flipped detections 40 vs 35 | failed |
| DiverSR off-grid refinement | sub-cell peak fit | blind distance 7.9 -> 8.7 km | failed |
| PW-HHP wind projection | national screen | noise down, recovery 4 -> 3 | failed |
| EFA land-use attribution | OSM facilities vs cited sectors of 7 references | runs on GitHub Actions (Overpass API) | pending first run |

Lessons kept on purpose:
- The national 3-sigma screen is a lead list, not evidence: on the 3.4-year field the sign-flipped map gives
  35 "detections" against 37 real ones. Significance comes only from each site's own stack and null.
- Single-site z >= 3 is not a 0.13% test (coastal pseudo-sites near Surat reach z ~4). Hence "confirmed"
  needs BY-FDR plus an independent check.
- Detection limit (OBC): ~10 t/h for 50% detection over the stacked record.

## R6: the integrated inventory (done; refreshed by `.github/workflows/inventory.yml`)
`research/pipeline/run_inventory.py` chains only validated components: final stack -> divergence ->
24-site null (z, Student-t p) -> BY-FDR q over the whole tested family (7 reference sites + every national
candidate that is not one of them) -> Monte Carlo rate (4000 draws: overpass bootstrap + null-structure noise,
x per-site ERA5 gamma, / OBC slope) -> WRPI priority (sector cost, abatable share, AR6 GWP20, x (1 - q)).
Output: `data-pipeline/inventory/inventory.json` with, for every site, the orbits used, overpasses per month,
first/last overpass, wind, the stack image, z/p/q, calibrated t/h (16/50/84%), and the priority numbers.
Tiers: confirmed (q <= 0.05), detected (z >= 3), tentative (2 <= z < 3), not detected (upper limit).

<!-- R6-TABLE -->
Generated 2026-10-07T12:04 UTC from TROPOMI 2023-01-01..2026-10-04, 18,109,561 pixels, 56 sites tested: 12 confirmed, 14 at z >= 3.

| # | Site | Tier | t CH4/h [68%] | z | q (BY) | Sector | t CO2e20 per INR lakh |
|---|---|---|---|---|---|---|---|
| 1 | Ghazipur landfill, Delhi | confirmed | 30.2 [25.7, 35.3] | 8.8 | 0.000 | landfill | 629 |
| 2 | near Lahore | confirmed | 36.5 [30.7, 42.8] | 8.1 | 0.000 | landfill | 627 |
| 3 | near Dhaka | confirmed | 77.4 [68.5, 87.1] | 14.2 | 0.000 | landfill | 626 |
| 4 | Deonar/Mumbai landfill | confirmed | 66.8 [52.2, 83.1] | 5.1 | 0.001 | landfill | 621 |
| 5 | Pirana landfill, Ahmedabad | confirmed | 14.8 [11.3, 18.5] | 4.7 | 0.002 | landfill | 619 |
| 6 | Jawaharnagar landfill, Hyderabad | confirmed | 18.1 [13.1, 23.3] | 4.0 | 0.009 | landfill | 618 |
| 7 | near Dhaka | confirmed | 79.4 [69.1, 90.4] | 10.3 | 0.000 | landfill | 618 |
| 8 | Khajod landfill, Surat | confirmed | 21.0 [15.1, 27.1] | 3.8 | 0.014 | landfill | 616 |
| 9 | 48 km from Sadiqabad | confirmed | 20.5 [16.8, 24.5] | 8.5 | 0.000 | unattributed | 597 |
| 10 | near Chattogram | confirmed | 51.0 [34.9, 67.7] | 3.3 | 0.046 | unattributed | 590 |
| 11 | 129 km from Rajkot | confirmed | 13.5 [8.9, 18.4] | 3.2 | 0.046 | unattributed | 576 |
| 12 | Jharia coal field, Jharkhand | confirmed | 21.8 [16.6, 27.3] | 4.5 | 0.004 | coal | 332 |
| 13 | near Nawabganj | detected | 11.3 [7.4, 15.6] | 3.0 | 0.062 | unattributed | 573 |
| 14 | 80 km from Panaji | detected | 24.5 [12.4, 37.2] | 3.1 | 0.058 | unattributed | 562 |
| 15 | 38 km from Dibrugarh | tentative | 28.4 [18.0, 39.7] | 2.8 | 0.148 | oil_gas | 30500 |
| 16 | near Nawabganj | tentative | 14.2 [9.2, 19.6] | 3.0 | 0.071 | unattributed | 557 |
| 17 | 98 km from Burhanpur | tentative | 8.3 [4.4, 12.0] | 2.8 | 0.097 | landfill | 556 |
| 18 | near Lucknow | tentative | 13.9 [8.0, 20.0] | 2.5 | 0.148 | landfill | 531 |
| 19 | 58 km from Panaji | tentative | 22.5 [12.1, 32.9] | 2.5 | 0.153 | unattributed | 514 |
| 20 | 133 km from Bhuj | tentative | 27.6 [14.8, 41.6] | 2.3 | 0.215 | unattributed | 476 |
| 21 | 26 km from Shwebo | tentative | 9.6 [5.1, 14.1] | 2.3 | 0.215 | unattributed | 464 |
| 22 | 81 km from Nawabganj | tentative | 13.9 [6.7, 21.4] | 2.2 | 0.240 | unattributed | 451 |
| 23 | near Shivamogga | tentative | 21.8 [11.6, 32.1] | 2.2 | 0.240 | unattributed | 449 |
| 24 | 60 km from Bhuj | tentative | 13.0 [3.9, 22.1] | 2.2 | 0.237 | unattributed | 447 |
| 25 | 64 km from Bhagalpur | tentative | 11.2 [5.0, 17.3] | 2.0 | 0.308 | unattributed | 426 |
| 26 | 187 km from Bhuj | tentative | 11.5 [4.4, 19.2] | 2.0 | 0.308 | unattributed | 411 |
| 27 | 105 km from Pune | not detected | < 31.9 | 1.5 | 0.519 | unattributed | - |
| 28 | 65 km from Ranchi | not detected | < 28.2 | 2.0 | 0.311 | coal | - |
| 29 | 30 km from Davangere | not detected | < 26.2 | 1.7 | 0.427 | unattributed | - |
| 30 | 43 km from Guwahati | not detected | < 27.2 | 1.3 | 0.652 | unattributed | - |
| 31 | 49 km from Tumakuru | not detected | < 23.4 | 1.8 | 0.367 | unattributed | - |
| 32 | 49 km from Bahraich | not detected | < 25.2 | 1.4 | 0.554 | unattributed | - |
| 33 | 100 km from Bhuj | not detected | < 29.7 | 0.9 | 1.000 | unattributed | - |
| 34 | 127 km from Dera Ghazi Khan | not detected | < 25.5 | 1.1 | 0.897 | unattributed | - |
| 35 | 40 km from Phyarpon | not detected | < 20.6 | 1.8 | 0.387 | unattributed | - |
| 36 | 59 km from Proddatur | not detected | < 21.8 | 1.6 | 0.473 | unattributed | - |
| 37 | 37 km from Dhangarhi | not detected | < 21.6 | 1.3 | 0.660 | unattributed | - |
| 38 | 133 km from Dera Ghazi Khan | not detected | < 20.4 | 1.5 | 0.554 | unattributed | - |
| 39 | near Hosapete | not detected | < 18.6 | 1.9 | 0.314 | coal | - |
| 40 | 120 km from Raurkela | not detected | < 18.4 | 1.3 | 0.652 | unattributed | - |
| 41 | 152 km from Bilaspur | not detected | < 16.7 | 1.7 | 0.429 | unattributed | - |
| 42 | 26 km from Ranchi | not detected | < 15.2 | 1.9 | 0.314 | unattributed | - |
| 43 | 187 km from Bhuj | not detected | < 20.4 | 1.7 | 0.387 | unattributed | - |
| 44 | 49 km from Taungoo | not detected | < 15.4 | 1.9 | 0.364 | unattributed | - |
| 45 | near Dera Ghazi Khan | not detected | < 14.2 | 1.8 | 0.387 | unattributed | - |
| 46 | 82 km from Shwebo | not detected | < 16.8 | 0.9 | 1.000 | unattributed | - |
| 47 | 93 km from Kolhapur | not detected | < 19.4 | 0.6 | 1.000 | unattributed | - |
| 48 | near Ranchi | not detected | < 14.1 | 0.9 | 1.000 | unattributed | - |
| 49 | 38 km from Hyderabad | not detected | < 17.1 | 0.6 | 1.000 | unattributed | - |
| 50 | 31 km from Hyderabad | not detected | < 19.0 | 0.5 | 1.000 | unattributed | - |
| 51 | 55 km from Hosapete | not detected | < 12.2 | 1.1 | 0.859 | unattributed | - |
| 52 | near Aligarh | not detected | < 8.7 | 0.3 | 1.000 | unattributed | - |
| 53 | Korba coalfield, Chhattisgarh | not detected | < -2.7 | -1.6 | 1.000 | coal | - |
| 54 | near Pyay | not detected | < 3.1 | -0.5 | 1.000 | unattributed | - |
| 55 | 59 km from Zhob | not detected | < 1.9 | -0.7 | 1.000 | unattributed | - |
| 56 | 97 km from Dera Ghazi Khan | not detected | < 0.7 | -0.9 | 1.000 | unattributed | - |
<!-- /R6-TABLE -->

## Live operation
- Every 3 h (`live.yml`): newest real TROPOMI pass over India (NRTI stream, ~3 h latency; OFFL fallback) ->
  `data` branch `live/latest.json` + texture, read at request time by `/api/live`.
- Daily: newly published OFFL days are appended to the archive; the inventory then re-runs on everything.

## Explicitly not done
- R5 external validation against Carbon Mapper / UNEP-IMEO MARS plume catalogues (needs their API access).
- PSSI, NDC, KPW, MRI, MC-FOD, PKTD, EFA, VOIT: designed, not implemented (reasons in algorithms.json).
- Facility-level attribution for the national candidates: needs a facility registry (OSM/state PCB lists).
- The rates are cluster rates within 20 km at 5.5 km pixels, not single facilities.
