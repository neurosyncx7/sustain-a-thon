# Scene bible: "13:30, Jaipur"

Design read: cinematic scientific-storytelling world for hackathon judges (climate scientists and
technical reviewers), with an instrument-astronomy / mission-control language, built as one
continuous R3F world plus Motion UI and custom GLSL.
Dials: DESIGN_VARIANCE 8 / MOTION_INTENSITY 8 / VISUAL_DENSITY 4.

## The idea
The whole site is one place: an observatory modelled on Jantar Mantar, Jaipur (Sawai Jai Singh II,
1720s-1730s), India's own tradition of monumental instrument astronomy. Each masonry instrument
becomes one stage of the methane pipeline. The link is literal, not decorative:

| Real instrument | What it measured | What it does here |
|---|---|---|
| Samrat Yantra (giant equinoctial sundial; gnomon hypotenuse inclined at Jaipur's latitude, ~26.9 deg, parallel to Earth's axis) | local solar time | Hero. Its shadow reads **13:30 local solar time**, TROPOMI's overpass time. Sentinel-5P crosses the sky at that instant and its swath sweeps the courtyard. |
| Jai Prakash Yantra (concave hemispheric bowls, the sky inverted onto the ground) | celestial coordinates | "What orbit sees": the real 2023-24 India XCH4 field mapped inside the bowl. The satellite looks down, the bowl looks up. Month scrubber shows monsoon data gaps as real missing pixels. |
| Rama Yantra (open cylinder with central pillar) | altitude / azimuth | "The column": the atmospheric column and the continuity equation. Flux enters and leaves the cylinder; divergence equals source. Wind is draggable. |
| Digamsha Yantra (azimuth circles) | azimuth | "Rotate with the wind": each real overpass at a site is a translucent sheet that rotates to align with its wind; the stack converges into the plume. |
| Nadi Valaya Yantra (two-faced equatorial dial, north face and south face) | time in two hemispheres | "Two fields": one face is the smooth, seasonal paddy/livestock field, the other the sparse point sources. The separation algorithm made physical. |
| Inscription wall | records | "The ledger": the prioritised inventory, each site a carved tablet with its evidence and uncertainty. |

## Final arc (revised with the team's review): ground -> sky -> ground, night -> day -> night
Stage mapping, locked:
1. **Prologue, night** (courtyard under a slowly wheeling star field, Milky Way, ground fog, lamp
   embers). "For three centuries these instruments read the sky." Camera climbs the Samrat Yantra stair.
2. **Samrat Yantra -> Ingest.** Time-lapse: stars wheel, dawn, the sun climbs; the gnomon shadow lands
   on 13:30; Sentinel-5P crosses; its swath curtain sweeps the ground. "Now the sky reads us."
3. **Rashivalaya Yantra (12 instruments, one per zodiac sign) -> Seasonal detrending.** Each of the 12
   is one real month: its plaster face shows that month's real coverage fraction and diffuse background;
   monsoon months are wrapped in cloud and visibly lose pixels. Afternoon haze.
4. **Jai Prakash Yantra (the bowl) -> Residual anomaly detection.** The residual field mapped inside the
   concave bowl; candidate sites rise as blue light columns. Late afternoon.
5. **Digamsha + Rama Yantra -> Wind attribution and quantification.** Overpass sheets rotate to the wind;
   the stacked plume points back to a facility; the Rama cylinder shows flux in/out (divergence = source).
   Dusk, long shadows, first stars.
6. **Return to the ground: the Ledger, night.** Lamplit stone desk at courtyard level; the reading is
   written down as the ranked, citable inventory. Stars again overhead: the loop closes.

Geometry (derived from published figures, not guessed): Vrihat Samrat gnomon height 27 m, hypotenuse at
27 deg (Jaipur latitude), so base ~ 27/tan 27deg ~ 53 m; shadow speed 1 mm/s and 15 deg/h give dial
quadrant radius ~ 13.75 m. Other instruments are proportioned from photographs and marked as stylised.

Atmosphere toolkit: volumetric ground fog (raymarched height fog shader), noon god rays through aerosol
haze, instanced dust motes, sidereal star field + Milky Way band, monsoon cloud deck, oil-lamp point
lights with flicker, depth-of-field pull during camera flights, subtle film grain and vignette.

## Time of day is the narrative
The hero is at 13:30 because that is when TROPOMI sees India (truthful, and the sundial proves it).
Moving deeper into the pipeline advances time and season: afternoon aerosol haze at the data-quality
bowl, monsoon cloud rolling in (swath pixels drop out where cloud is), dusk at the separation dial,
lamplit night at the ledger. The environment changes with the argument.

## Look
- Materials: Jaipur red sandstone (rose-terracotta, porous, sun-bleached edges), white lime plaster
  with engraved scale markings, dark brass fittings.
- Data colour (the one accent): methane burns blue, so every data signal is a desaturated
  flame-blue (#6FB4FF core, #2E6FD1 deep). Nothing else in the world is blue except the sky.
- Light: hard high sun with volumetric haze (the aerosols are the data problem made visible),
  long raking shadows later in the journey. Bloom only on data emissives.
- Type: Geist (sans) for prose, Geist Mono for every number. No serif.

## Interaction model
- Top nav (single line): Observe / Column / Wind / Separate / Ledger. Each is a camera flight
  through the courtyard, never a page cut. URL syncs (`/?at=wind`).
- Bottom toggle, basement-style: **Story | Evidence**. Story narrates; Evidence overlays raw numbers,
  provenance (orbit ids, dates, qa), uncertainty bands, and download links.
- Every instrument is clickable (hover: plaster markings glow blue, cursor changes); clicking flies in.
- Ledger tablets open a site dossier as a full page (`/site/[id]`) with a shared-element transition.

## Truth constraints
- Every data surface reads from `/api/*`, which reads `data-pipeline/` / the `data` branch.
- Unvalidated research is labelled as such in Evidence mode; nothing pretends to be the final inventory
  before R3-R6 finish (see research/findings.md).
- Instrument geometry follows published proportions; where simplified, it says so in docs.
