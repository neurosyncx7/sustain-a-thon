## R3: quantifier comparison on real stacks (done; final method)
Wind-rotated, footprint-drizzled stacks with monsoon months excluded, overpasses weighted by their
background noise and the albedo/aerosol bias removed (ABD) - the configuration R4 + R5 selected - three quantifiers on the same stack,
bootstrap 68% intervals, and an empirical null from **24 pseudo-sites** 60-90 km away using the same
overpasses (`research/validation/r3_known_sites.py` -> `data-pipeline/r3/known_sites.json`).
Rates in t/h at gamma=1 (TROPOMI's ECMWF 10 m wind; ERA5 suggests gamma ~1.2-1.3, applied in R6).

| Site (20 km radius) | overpasses | IME t/h [68%] | CSF t/h [68%] | Divergence t/h [68%] | floor 1 sigma |
|---|---|---|---|---|---|
{ROWS}

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
{ABL}

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

