# PS-13-S3 — India Methane Super-Emitter Detection (sustain-a-thon)

## What this repo is
Two coupled work-streams for one hackathon submission:

1. **`/research`** — the science: real Sentinel-5P/TROPOMI + ERA5 ingestion, the flux-divergence
   pipeline (Helmholtz-decomposed winds, averaging-kernel-aware column chemistry, India-specific
   agricultural background separation), the ablation/OSSE validation harness, and the final
   emission-rate + attribution inventory. Nothing here uses synthetic/placeholder data once R1
   lands — every number traces to a cited public source or a derivation in `research/derivations/`.
2. **`/web`** — the cinematic 3D web app (Next.js + React Three Fiber + Rapier + GSAP + Lenis +
   Framer Motion) that presents the pipeline's real output. It reads `/data-pipeline` output through
   `/web/app/api/*` routes — never hardcoded numbers in components.

`/data-pipeline` is the boundary: research code writes versioned JSON/Parquet artifacts there;
`/web` only reads from there (via the API layer), never recomputes science in the browser.

## Non-negotiables
- **No synthetic/fabricated data reaches the UI.** Every site in the inventory carries its evidence
  (overpass IDs, wind field, divergence field snapshot, attribution posterior) traceable to source.
- **No algorithm is "final" until it beats baselines in `research/validation/ablation.py`** with a
  logged, reproducible result. Cite prior art; only claim novelty for what the ablation shows earns
  its keep.
- **Every UI control is wired to the backend.** No dead buttons, no "coming soon" states shipped as
  final — if something isn't ready, the task list says so, not the UI.
- Cameras always ease (no linear tweens). Every interactive prop has a hover affordance. Physics
  props have tuned mass/restitution. Bloom is subtle — lighting and material carry "the look".
  Mobile gets a lighter scene or a static hero, never a blank canvas. Loading has a designed screen.

## Structure
```
research/            science: derivations, ingestion, algorithms, validation, notebooks
  derivations/        the math (continuity eq, PSSI, DiverSR, etc.) as markdown + sympy checks
  ingestion/           TROPOMI L2 CH4/CO + ERA5 pullers (GitHub Actions + local)
  algorithms/          candidate algorithms, one file per algorithm, each with a docstring: status
  validation/          OSSE harness, ablation runner, known-site blind tests
  findings.md          the frozen, current-best pipeline + numbers (source of truth for /web copy)
data-pipeline/        versioned output artifacts research writes and web reads (parquet/json)
web/                   Next.js app (see web/CLAUDE.md once scaffolded)
tools/                 repo-wide scripts (mcp-verify.mjs, etc.)
.claude/skills/        r3f-scene, asset-pipeline, landing-page-variant (project skills)
.claude/agents/        asset-generator, shader-writer, physics-tuner, perf-auditor, scene-reviewer
```

## Working agreement
- Research and frontend are separate sessions/phases (`/clear` between them) — don't mix a
  half-finished derivation with scene code in the same sitting.
- When a research algorithm's status in its docstring is `candidate`, the web layer must not use its
  output yet. Only `validated` algorithms feed `data-pipeline/`.
- Commit messages: `research: ...` / `web: ...` / `data: ...` prefix by area.
