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
Wind-rotated, footprint-drizzled stacks with monsoon months excluded, overpasses weighted by their
background noise and the albedo/aerosol bias removed (ABD) - the configuration R4 + R5 selected - three quantifiers on the same stack,
bootstrap 68% intervals, and an empirical null from **24 pseudo-sites** 60-90 km away using the same
overpasses (`research/validation/r3_known_sites.py` -> `data-pipeline/r3/known_sites.json`).
Rates in t/h at gamma=1 (TROPOMI's ECMWF 10 m wind; ERA5 suggests gamma ~1.2-1.3, applied in R6).

| Site (20 km radius) | overpasses | IME t/h [68%] | CSF t/h [68%] | Divergence t/h [68%] | floor 1 sigma |
|---|---|---|---|---|---|
| Jawaharnagar landfill, Hyderabad | 80 | 8.7 [7.3, 10.3] (z 2.0) | 7.9 [5.3, 10.4] (z 1.7) | 11.1 [8.9, 13.2] (z 3.2) | 3.8 |
| Pirana landfill, Ahmedabad | 206 | 7.7 [6.8, 8.5] (z 1.3) | 13.3 [11.4, 15.1] (z 4.1) | 9.3 [8.0, 10.7] (z 3.6) | 2.9 |
| Khajod landfill, Surat | 193 | 11.4 [10.0, 12.6] (z 1.3) | 18.4 [15.9, 20.6] (z 3.3) | 14.1 [11.7, 16.1] (z 3.3) | 5.4 |
| Deonar/Mumbai landfill | 164 | 42.0 [38.6, 44.6] (z 5.2) | 58.9 [52.5, 66.6] (z 3.8) | 52.8 [48.0, 59.8] (z 5.0) | 11.2 |
| Jharia coal field, Jharkhand | 101 | 3.0 [1.4, 4.8] (z 0.9) | 20.7 [18.9, 22.2] (z 3.7) | 17.2 [15.6, 18.9] (z 5.3) | 3.4 |
| Korba coalfield, Chhattisgarh | 84 | 1.9 [1.1, 2.8] (z 0.7) | -2.0 [-4.0, -0.5] (z -0.4) | -2.9 [-4.7, -1.3] (z -0.8) | 3.1 |

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

## R5: the invented algorithms, tested one by one on real data (done, 2026-09-26)
`research/validation/r5_algorithms.py` -> `data-pipeline/r5/*.json`. Each test's pass criterion is written
in the code before the run. Status of all 18 designs, generated from these files:
`data-pipeline/inventory/algorithms.json` (5 validated, 2 partial, 3 failed, 8 not implemented).

| Algorithm | Test on real TROPOMI | Result | Status |
|---|---|---|---|
| ABD albedo/aerosol bias decorrelation | final vs final+ABD, 6 sites, same 24-site null | mean z 3.74 -> 4.06; floor 5.4 -> 5.0 t/h | **validated, in method** |
| OBC injection-recovery calibration | Gaussian plumes of 5-40 t/h added to real pixels of 24 pseudo-sites in 4 windows | recovery slope 0.989 (R^2 0.9998, site CV 0.5%); P(z>3) = 8% at 5 t/h, 46% at 10, 100% at 20 | **validated, in method** |
| BY-FDR (site family) | 36 fake candidates (pseudo-sites) + 6 references in one family | 0 of 36 fakes admitted, fake p-values uniform (KS p 0.43); only 2 of 5 references survive (BY is conservative) | **validated for size**, weak power |
| BY-FDR (national grid) | local maxima vs mirrored local minima | 0 discoveries: minima are as deep as maxima | failed -> screen stays a lead list |
| WIT wind-invariance test | centred vs edge-offset injected sources | false-reject 21% (needs <= 15%), power 8% (needs >= 50%) | failed |
| EIV-CRF CO/CH4 fingerprint | CO stacked like CH4, same overpasses | CO detected above its own null at all 5 (z 2.3-8.1); ratio separated from the combustion boundary at 2 of 5 (Deonar 0.45 [0.41, 0.50], Jharia 2.2 [2.0, 2.4] - Jharia's coal fires) | failed gate (needs 3) |
| DiverSR off-grid refinement | quadratic sub-cell peak fit on the national field | mean blind distance 7.9 -> 8.7 km | failed |
| PW-HHP Helmholtz wind projection | national screen with non-divergent winds | noise -29%, but blind recovery 4 -> 3 (Jawaharnagar lost, Jharia 6.6 -> 3.8 km) | failed |

Lessons kept on purpose:
- The single-site z >= 3 rule is not a 0.13% test: the largest of 36 fake candidates reached z 3.19. That
  is why the inventory's citable tier uses BY-FDR q-values, and z >= 3 alone is labelled "detected", not "confirmed".
- Detection limit (OBC): ~10 t/h for 50% detection over two years of stacking; below ~5 t/h a site is invisible
  to TROPOMI with this method. Single-facility sources of 1-5 t/h need Carbon Mapper/EMIT/GHGSat (VOIT, planned).

## R6: the integrated inventory (done; refreshed by `.github/workflows/inventory.yml`)
`research/pipeline/run_inventory.py` chains only validated components: final stack -> divergence ->
24-site null (z, Student-t p) -> BY-FDR q over the whole tested family (7 reference sites + every national
candidate that is not one of them) -> Monte Carlo rate (4000 draws: overpass bootstrap + null-structure noise,
x per-site ERA5 gamma, / OBC slope) -> WRPI priority (sector cost, abatable share, AR6 GWP20, x (1 - q)).
Output: `data-pipeline/inventory/inventory.json` with, for every site, the orbits used, overpasses per month,
first/last overpass, wind, the stack image, z/p/q, calibrated t/h (16/50/84%), and the priority numbers.
Tiers: confirmed (q <= 0.05), detected (z >= 3), tentative (2 <= z < 3), not detected (upper limit).

## Live operation
- Every 3 h (`live.yml`): newest real TROPOMI pass over India (NRTI stream, ~3 h latency; OFFL fallback) ->
  `data` branch `live/latest.json` + texture, read at request time by `/api/live`.
- Daily: newly published OFFL days are appended to the archive; the inventory then re-runs on everything.

## Explicitly not done
- R5 external validation against Carbon Mapper / UNEP-IMEO MARS plume catalogues (needs their API access).
- PSSI, NDC, KPW, MRI, MC-FOD, PKTD, EFA, VOIT: designed, not implemented (reasons in algorithms.json).
- Facility-level attribution for the national candidates: needs a facility registry (OSM/state PCB lists).
- The rates are cluster rates within 20 km at 5.5 km pixels, not single facilities.
