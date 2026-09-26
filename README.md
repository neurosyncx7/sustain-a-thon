# Vāyu Lekha · the air ledger

**India's methane super-emitters, read from orbit.** PS-13-S3, sustain-a-thon.

Two years of real Sentinel-5P/TROPOMI observations over India (2023-2024; 1,365 orbits; 9.6 million
quality-filtered pixels) turned into a screened, tested, citable list of persistent methane sources,
separated from India's dominant agricultural background, with the evidence for every entry.

The website presents it as a single cinematic place: the Jantar Mantar observatory in Jaipur, where each
masonry instrument performs one stage of the pipeline, and the day runs from night, through the 13:30
satellite overpass, to a lamplit ledger.

## What is real here
Everything numeric on the site is read from research outputs through the API (`web/src/app/api/*`).
Nothing is mocked or synthetic.

| Stage | Instrument | What it shows | Source |
|---|---|---|---|
| Night | Jantar Mantar | 19,054 catalogue stars placed for Jaipur's real sky | d3-celestial (Hipparcos), BSD |
| 13:30 | Samrat Yantra | the computed sun's shadow reads TROPOMI's overpass time on the dial | solar ephemeris for 2024-01-15, the real sample date |
| Observe | floor map | 2-year mean XCH4 over India, revealed by the scan-line sweep | 9.6 M TROPOMI pixels |
| Seasons | Rashivalaya (12 dials) | real monthly coverage: July has ~70x fewer usable pixels than December | extraction logs |
| Anomalies | Jai Prakash bowl | national 2-year flux-divergence map and screened candidates | `research/screening/national_screen.py` |
| Attribution | Digamsha + Rama | 10 real overpasses turning by their real winds onto the real stack | `research/algorithms/site_stack.py` |
| Ledger | steles + book | known-site results and the national candidate list | `/ledger`, `/api/export` |

## Headline results (details and caveats: `research/findings.md`)
- **Final method** (wind-rotated, footprint-drizzled stacking; monsoon exclusion; noise weighting; flux
  divergence) detects **all five known landfill/coal emitters above 3 sigma** against a 24-pseudo-site
  local null: Mumbai/Deonar, Jharia, Jawaharnagar, Pirana, Khajod. Korba is null, consistent with the
  published finding that Indian coal is over-counted in inventories.
- **Controlled ablation** (raw -> detrend -> monsoon-aware -> wind -> combined): wind rotation is the
  largest single gain; only the combined method puts every known emitter above 3 sigma.
- **Blind national screen** recovered Ghazipur (Delhi), Jharia, Jawaharnagar and Pirana without being
  told where to look.
- **Honest limits:** 3-sigma detection floor is roughly 10-20 t/h per 20 km cluster over two years; rates
  are cluster rates at the 10 m wind (calibration and facility attribution are the next steps).

## Repository map
```
research/
  derivations/continuity_equation.md   3D mass conservation -> column flux divergence, AK, dry-air column
  ingestion/extract_month.py           real TROPOMI L2 extraction (runs on GitHub Actions)
  algorithms/site_stack.py             stacking engine + IME / cross-sectional flux / divergence
  validation/r3_known_sites.py         quantifier comparison with pseudo-site null
  validation/r4_ablation.py            controlled ablation
  screening/national_screen.py         national divergence screen + map products
  findings.md                          the source of truth for every claim
data-pipeline/                         outputs the website reads (large raw extraction on the `data` branch)
web/                                   Next.js + React Three Fiber world, HUD, ledger, dossiers, API
.github/workflows/extract-tropomi.yml  reproducible 24-month extraction
```

## Run it
```bash
cd web
npm install
npm run dev          # syncs data-pipeline outputs, then serves http://localhost:3000
```
Deep links: `/?at=ingest`, `/?at=seasons`, ... `/?at=ledger`; `/?render=static` forces the low-power
experience. Inventory: `/ledger`; a site dossier: `/site/jharia`; citable CSV: `/api/export`.

Reproduce the data: push `.github/extract-request.json` (list of months) to trigger the Actions
extraction; outputs land on the `data` branch; then run the scripts in `research/validation` and
`research/screening`.

## Data and credits
Copernicus Sentinel-5P data (processed by ESA), via the public MEEO mirror `s3://meeo-s5p`. ERA5 via
Open-Meteo. Boundaries and places: Natural Earth (India point-of-view edition), public domain. Star
catalogue: d3-celestial, BSD-3-Clause. Instrument proportions follow published figures for the Jaipur
Jantar Mantar (Samrat Yantra 27 m at 27 deg; base and dial radius derived); other instruments are
stylised.
