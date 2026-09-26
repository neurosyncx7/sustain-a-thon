# Vāyu Lekha · Operations and live-demo runbook

This is the script for showing the judges the working system: what to open, what to say, which
algorithm each screen proves, and what to do if something is slow. Everything shown is computed from
real Sentinel-5P data; nothing on the site is simulated.

- Live site: https://sustain-a-thon-plum.vercel.app/
- Code and every result file: https://github.com/neurosyncx7/sustain-a-thon
- Pipeline runs (public log): https://github.com/neurosyncx7/sustain-a-thon/actions
- Partner (coordinates) login: `/partner`, demo access key **`vayu-lekha-partner-demo`**

---

## 1. Before the judges arrive (5 minutes)

1. Open the site on the presenting laptop in Chrome, full screen (F11), and let the loader finish once;
   the 3D scene compiles its shaders on first load.
2. Look at the header pill (top right). It should read *"Last pass over India N h ago"*.
   Sentinel-5P crosses India around 07:00-09:00 UTC (12:30-14:30 IST); the pass appears on the site
   about 3 hours later. Before ~15:30 IST the newest pass is yesterday's; that is expected, say so.
3. Open these in background tabs so switching is instant:
   - `/ledger` (the inventory + live panel)
   - `/site/ghazipur` (a site dossier)
   - `/responsible` (safeguards)
   - https://github.com/neurosyncx7/sustain-a-thon/actions (the running pipeline)
4. Optional, to show a run starting live: on the Actions page, open **live** → **Run workflow** →
   **Run workflow**. It takes 3-6 minutes, then the site's live panel shows the new processing time.
   (Starting runs from the site's own button needs a GitHub token in Vercel; without it the button is
   hidden, so use the Actions page.)
5. If the laptop is weak or on battery, the scene lowers its own quality automatically. If it still
   stutters, add `?render=static` to the URL for the still-image version with the same text and data.

## 2. The story, stage by stage (8-10 minutes)

Scroll slowly; each stop settles on its own. Arrow keys or the top navigation jump between stages.
**Story** mode shows the narrative; switch to **Evidence** (bottom toggle) to add source notes under
every number. Every chip under a stage title is an algorithm that runs at that step.

| Stage (nav) | What the judges see | What it proves | Algorithms shown | Say this |
|---|---|---|---|---|
| **Night** (hero) | Jantar Mantar under the real night sky of Jaipur: 19,054 catalogue stars, the Milky Way through Cassiopeia (Sharmishtha), Dhruva (the pole star the Samrat Yantra's gnomon points at), Saptarishi, meteors, Sentinel-5P crossing on its night pass. Headline figures: sites confirmed in India of those tested, clear pixels read, record since 2023, newest pass. | The system is live and the scale is real. | – | "Every clear pass of Sentinel-5P over India since 2023 is in this inventory, and it is still running: the newest pass was processed a few hours ago." Press **Begin the reading**. |
| **13:30** | The sundial's computed shadow at 13:30 local solar time. Figures: newest pass date, files verified against Copernicus, clear pixels. | Ingestion is automatic, verified and continuous. | Copernicus checksum verification · qa ≥ 0.5 filter · 3-hourly live pass | "Every three hours a job pulls the newest pass, checks each file's checksum against the official Copernicus catalogue, rejects any mismatch, and keeps only pixels the retrieval trusts." Click **See today's pass**. |
| **Observe** | India's mean methane drawn on the courtyard floor, revealed by a scan line. Figures: detection floor raw → after ABD → full method. | Data quality handling removes known retrieval biases. | ABD (albedo/aerosol) · SRECE (noise weighting) | "Bright deserts, dark forests and dust bias the methane retrieval. ABD removes the part of each pass that tracks surface brightness and aerosol; each pass is weighted by its own measured noise. The floor falls from about 7 to under 5 t/h." |
| **Seasons** | Twelve dials, one per month, showing how much of India was actually seen. | Monsoon and agricultural background are handled honestly. | Monsoon exclusion · local plane background | "July is almost blind, about 70 times fewer clear pixels than December. We never fill those months in; they are reported as unobserved. The paddy and regional background is removed site by site." |
| **Anomalies** | The Jai Prakash bowl holding the national flux-divergence map. Figures: leads found, known sites found blind. | Sources can be found with no list given. | Flux divergence (continuity equation) · blind national screen | "Divergence is where more methane leaves a place than arrives. Given no site list, the screen lands next to documented landfills and coal fields (read the names under the figures). But a lead is only a lead." |
| **Attribution** | Real overpasses turning to their real winds and stacking onto the plume, for Jawaharnagar (Hyderabad). Figures: overpasses stacked, calibrated t/h, z; the ablation ladder from raw to full method; CO/CH₄ ratio. | The core method, and that every component earns its place. | Wind rotation · DiverSR drizzle · KPW phase weighting · OBC calibration · EIV-CRF CO/CH₄ | "Each pass is turned to face its own wind and stacked: a real source stays put, noise averages away. The ladder shows each component's effect on the same data. The rate is calibrated by plumes we injected into real data, and carbon monoxide says whether it burns or decays." Click **Open this site's dossier**. |
| **Ledger** | The lectern book and one stele per site, lit if confirmed. The ranked list. | Output is a prioritised, citable inventory. | BY-FDR + corroboration gate · WRPI priority · VOIT tasking · human review | "Confirmed means two things: under a 5% false-discovery rate across every site we tested, and passing an independent check, such as being found again in separate years. Then we rank by warming avoided per rupee, and flag where one high-resolution satellite look would settle the most." Click **Open the full inventory**. |

## 3. The live proof: `/ledger`

**Live from orbit** (top of the page):
- The map shows the newest real pass over India (0.1° grid; gaps are clouds). Rings are inventory sites.
- *Newest pass processed*, *Orbits*, *Clear pixels*: the latest 3-hourly run.
- *What this pass saw at inventory sites*: for every site under today's pass, the **full validated
  method run on this one pass** (the method line lists every step), with its single-pass noise.
  Point out: "one pass is a snapshot; the inventory needs the stacked record, which is why the column
  says σ."
- *Wind right now*: current winds at the top sites (Open-Meteo forecast).
- *The pipeline, running*: status of each GitHub Actions job with a link to its log.

**The inventory table:** rank, tier, calibrated t CH₄/h with 68% interval, z, q-value, the four check
boxes (Y re-detected in separate years, M second estimator, C co-emitted CO, B blind screen), sector,
avoidable warming, warming per ₹ lakh. **Download CSV** gives the citable file.

**The algorithms running in this inventory:** one card per validated algorithm, each with its test
result and a link to the result file in the repository. Only algorithms that passed are listed here.

## 4. Which page proves which algorithm

| Algorithm | Where to show it | What to point at |
|---|---|---|
| Copernicus checksum verification | Stage **13:30**; `/responsible` §4 | "Files verified against Copernicus: N; rejected: 0" |
| ABD albedo/aerosol correction | Stage **Observe**; `/ledger#algorithms` | Floor raw → after ABD; mean z 3.74 → 4.06 on the 5 known emitters |
| SRECE noise weighting | Stage **Observe**; `/ledger#algorithms` | Part of the step that lifts every known emitter above 3σ |
| Monsoon exclusion + local plane background | Stage **Seasons** | July vs December coverage; "unobserved, never zero" |
| Flux divergence + blind screen | Stage **Anomalies**; `/ledger#leads` | Known sites found with no list |
| DiverSR (footprint drizzle) | Stage **Attribution** (ladder row "Combined") | z jumps when footprints are used |
| KPW phase weighting | Stage **Attribution** (ladder row "+KPW") | mean z 4.06 → 4.37, floor down again |
| OBC injection-recovery | Site dossier "Injection-recovery slope"; `/ledger#algorithms` | Recovers 99% of an injected plume; 50% detection near 10 t/h |
| MSFD CO leg + EIV-CRF | Site dossier "What process it looks like" | Jharia: CO/CH₄ ≈ 2.2, combustion-influenced (its coal fires); Ghazipur ≈ 0.54 and Deonar ≈ 0.50, decay |
| BY-FDR + corroboration gate | `/ledger` tiers and check boxes; `/responsible` §2 | Confirmed = q ≤ 0.05 AND an independent check; false-pass rates measured each run |
| WRPI priority | `/ledger` last two columns; site dossier "Priority" | t CO₂e₂₀ avoided per ₹ lakh, with cited cost sources |
| VOIT tasking | Site dossier banner "Recommended for a high-resolution overpass" | The top 5 unconfirmed sites by value of information |
| Human review | Site dossier "Human review"; `/responsible` §1 | Every entry is a machine candidate until a person records a decision |
| Tiered disclosure | Any dossier signed out vs signed in | Coordinates rounded to 0.25° publicly; exact after `/partner` sign-in |

## 5. Judge questions, and where the answer is on screen

- **"Is this real data or a simulation?"** Open the Actions page, click the latest **live** run, and
  show the log listing real Copernicus file names and checksums. Then `/ledger#live`.
- **"Who verifies the results?"** `/responsible` §1 and any dossier's *Human review*: nothing is a
  finding until an analyst or regulator records a decision, with name and date, in the repository
  (`data-pipeline/review/decisions.json`, added by pull request).
- **"What if you flag a site wrongly?"** `/responsible` §2: the 5% false-discovery gate across all
  sites, plus an independent check whose false-pass rate is measured on 24 pseudo-sites every run.
  Then say plainly: "we also publish what we tried that failed, like the wind-direction test, and
  our rates are 20 km cluster totals, not single facilities."
- **"Security and misuse?"** Open a dossier signed out (rounded location, no plume image), then sign in
  at `/partner` with `vayu-lekha-partner-demo` and reopen it (exact coordinates, plume stack, orbits;
  every view logged). Data integrity: `/responsible` §4.
- **"How do you know your algorithms work?"** `/ledger#algorithms`: each card has its test result and a
  link to the JSON the test wrote. The full record, including designs that failed, is at
  `/api/algorithms?all=1`.
- **"How small a leak can you see?"** About 10 t/h is detected half the time over the stacked record
  (injection-recovery). Smaller sources need Carbon Mapper, EMIT or GHGSat; VOIT picks where to point them.

## 6. What runs automatically

| When | Workflow | What it does |
|---|---|---|
| every 3 h | `live.yml` | newest NRTI pass over India → checksum check → full method per site → `data` branch `live/` → site reads it within minutes |
| daily 02:41 UTC | `live.yml` (ingest) | newly published OFFL days appended to the archive (grids + site windows) |
| daily 05:23 UTC, and after any extraction | `inventory.yml` | national screen → new leads join the tested family → OpenStreetMap facilities → R5 checks (EFA, VOIT) → inventory → commit → Vercel redeploys |
| when new leads appear | `extract-sites.yml` | extracts 150 km pixel windows around new leads for the whole archive |

To rerun anything by hand: Actions → pick the workflow → **Run workflow**.

## 7. If something goes wrong during the demo

| Symptom | What to do |
|---|---|
| Header says "Awaiting first live pass" or the live map is blank | The raw.githubusercontent.com fetch was slow; wait 60 s (the panel re-polls) or reload. The inventory and story still work. |
| "Copernicus mirror: fetch failed" in the live panel | The public S3 mirror is slow; everything else still works. Say so; it is an external service. |
| 3D is choppy | Add `?render=static` to the URL. |
| A stage looks empty | Press Evidence mode, or jump with the top navigation; numbers load from `/api` in under a second. |
| A GitHub run shows red | Open its log; the previous successful outputs stay live, nothing on the site is lost. |

## 8. Running it locally

```bash
cd web && npm install && npm run dev        # http://localhost:3000
```
Research reproduction: see `README.md` (extraction on GitHub Actions, then `research/validation/*` and
`research/pipeline/run_inventory.py`).
