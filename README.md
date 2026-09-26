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
- **Final method** (wind-rotated, footprint-drizzled stacking; monsoon exclusion; noise weighting;
  albedo/aerosol bias removal; flux divergence) detects **all five known landfill/coal emitters above
  3 sigma** against a 24-pseudo-site local null. Korba is null, consistent with the published finding that
  Indian coal is over-counted in inventories.
- **Controlled ablation**: the detection floor falls at every step, 7.3 -> 5.0 t/h; wind rotation is the
  largest single gain.
- **18 algorithms designed, each tested on real data against a pass mark written before the run**:
  5 validated and running in the pipeline, 2 partly built, 3 failed (kept on the page), 8 not built
  (`/api/algorithms`, `data-pipeline/inventory/algorithms.json`).
- **Injection-recovery on real backgrounds**: the method recovers 98.9% of an injected plume; 50% detection
  at ~10 t/h over the stacked record.
- **Integrated inventory** (`/ledger`, `/api/inventory`, `/api/export`): every tested site with calibrated
  t/h (Monte Carlo 68%), BY-FDR q-value (<= 5% false entries in the confirmed tier) and warming avoided per rupee.
- **Blind national screen** recovered Ghazipur (Delhi), Jharia, Jawaharnagar and Pirana without being told
  where to look.

## Live operation (what to show a jury)
| Every | Workflow | What happens |
|---|---|---|
| 3 h | `.github/workflows/live.yml` | newest real TROPOMI pass over India (NRTI, ~3 h after sensing) -> `data` branch `live/` |
| day | `live.yml` (02:41 UTC) | newly published OFFL days appended to the archive |
| day | `.github/workflows/inventory.yml` | national screen + inventory re-run on the whole archive, committed to `main` (redeploys) |

On the site: the header dot shows when the satellite last saw India; `/ledger#live` shows that pass on the
map, what it saw at each inventory site, current winds (Open-Meteo), the exchange rate used by the priority
index (ECB), and the state of every pipeline run with links to its GitHub Actions log. With
`GITHUB_DISPATCH_TOKEN` set in the deployment, a "Fetch the newest pass now" button starts a real run.

## Repository map
```
research/
  derivations/continuity_equation.md   3D mass conservation -> column flux divergence, AK, dry-air column
  ingestion/extract_month.py           real TROPOMI L2 extraction (runs on GitHub Actions)
  algorithms/site_stack.py             stacking engine + IME / cross-sectional flux / divergence
  validation/r3_known_sites.py         quantifier comparison with pseudo-site null
  validation/r4_ablation.py            controlled ablation
  algorithms/{wit,obc,eiv_crf,by_fdr,wrpi}.py  invented algorithms (status in each docstring)
  screening/national_screen.py         national divergence screen + map products
  findings.md                          the source of truth for every claim
data-pipeline/                         outputs the website reads (large raw extraction on the `data` branch)
web/                                   Next.js + React Three Fiber world, HUD, ledger, dossiers, API
research/validation/r5_algorithms.py  the invented algorithms, each tested on real data
research/pipeline/run_inventory.py     R6: the integrated inventory (validated algorithms only)
research/ingestion/live_quicklook.py   the 3-hourly live pass
.github/workflows/                     extraction, live pass, daily ingest, inventory refresh
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
