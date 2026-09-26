---
name: asset-pipeline
description: How a raw generated or sourced asset (Higgsfield image/video, real DEM/satellite tile, Blender export) becomes a production-ready web asset in this repo — GLB export settings, Draco/Meshopt compression, texture size caps, naming, and where it lands under web/public. Load before adding or regenerating any asset in web/public/models or web/public/textures.
---

# Asset pipeline — sustain-a-thon

Two asset classes in this project, handled differently:

## 1. 3D props/environment (GLB)
Source → Blender/procedural → compressed GLB → `web/public/models/<slug>.glb`.

- **Export settings (Blender → glTF 2.0):** `+Y up`, apply all transforms, include tangents,
  merge vertices, `KHR_materials_emissive_strength` for anything bloom-lit, pack textures into
  the GLB only for props <2MB raw — larger props reference external compressed textures.
- **Compression (required, no exceptions):**
  `npx gltf-transform optimize <in>.glb web/public/models/<slug>.glb --texture-compress webp
  --texture-size 2048 --simplify --simplify-error 0.001`
  Then verify: `npx gltf-transform inspect web/public/models/<slug>.glb` — flag anything over
  5MB for a manual look (usually an uncompressed texture slipped through).
- **Draco vs Meshopt:** Meshopt (`gltfpack -cc`) for anything animated or physics-collided
  (Rapier needs clean topology); Draco is fine for static, non-collided background geometry.
- **Naming:** `<station-slug>-<prop-name>.glb`, lowercase-kebab, e.g. `screening-arcade.glb`.
- **LOD:** any prop appearing in more than one station or visible at a distance >8 world units
  gets a `-lod1` sibling at 30% triangle count; wire through `<Detailed>` from drei.

## 2. Real-world / satellite-derived textures (this project's differentiator)
This site visualizes *real* methane data, not decorative-only environments. When a texture
represents actual geography or actual XCH4/divergence fields:
- Source the DEM/satellite basemap from the same real pipeline as `/research` (Sentinel-2 true
  color or SRTM relief for terrain height — never a stock "satellite-looking" texture for a
  station that claims to show a real site).
- Bake through `research/ingestion/export_basemap.py` → PNG/WebP → `gltf-transform` texture
  pipeline above. Tag the resulting file's origin in `web/content/asset-manifest.json`
  (`{file, source: "sentinel-2 L2A <date>", derived: true}`) so the UI can cite it — this
  manifest is what a station's "evidence" panel reads to show provenance, never invent it.

## 3. Cinematic B-roll (Higgsfield-generated, decorative only)
For mood/interstitial clips (never for anything presented as real satellite data):
- Follow the `scroll-cinematic` skill's Higgsfield → ffmpeg frame-sequence pattern
  (`~/.claude/skills/scroll-cinematic/scripts/extract-frames.sh` /
  `compress-frames.sh`) when a station wants a canvas-scrub interlude rather than a live R3F
  scene (e.g. a title/transition beat). 1600px wide, q88, ≤180 frames per sequence.
  Output to `web/public/broll/<sequence-slug>/frame_%04d.jpg`.
- Label these as decorative in `asset-manifest.json` (`derived: false, decorative: true`) so
  they never get treated as evidence.

## Texture size caps (hard limits, enforced by perf-auditor)
| Use | Max size | Format |
|---|---|---|
| Hero/near-camera prop | 2048×2048 | WebP, q82 |
| Background/far prop | 1024×1024 | WebP, q75 |
| UI/overlay texture (CRT screen, etc.) | 1024×1024 | WebP or procedural shader instead |
| Environment HDRI | 2K equirect | KTX2/Basis via `gltf-transform` |

## Checklist before a new asset is "done"
1. Compressed, under the size cap for its class.
2. Correctly named and placed.
3. If it represents real data: entry in `asset-manifest.json` with source + date.
4. If decorative: marked `decorative: true` in the manifest, never wired to a data-driven label.
