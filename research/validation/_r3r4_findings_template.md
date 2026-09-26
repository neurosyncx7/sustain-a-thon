## R3: quantifier comparison on real stacks (done; final method)
Wind-rotated, footprint-drizzled stacks with monsoon months excluded and overpasses weighted by their
background noise (the configuration the R4 ablation selected), three quantifiers on the same stack,
bootstrap 68% intervals, and an empirical null from **24 pseudo-sites** 60-90 km away using the same
overpasses (`research/validation/r3_known_sites.py` -> `data-pipeline/r3/known_sites.json`).
Rates in t/h at gamma=1 (TROPOMI's ECMWF 10 m wind; ERA5 suggests gamma ~1.2-1.3, applied in R6).

| Site (20 km radius) | overpasses | IME t/h [68%] | CSF t/h [68%] | Divergence t/h [68%] | floor 1 sigma |
|---|---|---|---|---|---|
{ROWS}

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
{ABL}

Conclusions (what earns its keep):
- **Wind rotation is the dominant single component** (Jawaharnagar -1.1 -> 1.7, Pirana 0.0 -> 1.8,
  floor 6.9 -> 5.9 t/h).
- **Only the combined method lifts every known emitter above 3 sigma** and gives the lowest floor
  (5.4 t/h): drizzle + monsoon exclusion + noise weighting add +1.6 (Jawaharnagar) and +1.4 (Jharia).
- Detrending and monsoon exclusion alone do not move site z-scores; their value is unbiased
  backgrounds and honest coverage (unobserved months are reported as unobserved, never as zero).
- Limitation: Mumbai is an extended coastal cluster; its raw z (6.3) is partly land/sea contrast
  and falls to 4.6 once the method models a wind-aligned point source. Flagged, not hidden.

