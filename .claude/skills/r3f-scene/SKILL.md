---
name: r3f-scene
description: House conventions for structuring React Three Fiber scenes in this repo — naming, camera rigging, Rapier collider setup, post-processing layering, room/station composition. Load before writing or editing any file under web/components/world or web/components/rooms.
---

# R3F scene conventions — sustain-a-thon

This is the single highest-leverage skill in the repo: it stops every session from
reinventing scene structure. Read it before touching `web/components/world/**`.

## File layout
```
web/components/world/
  Experience.tsx        <Canvas> root: renderer settings, camera, Suspense, PostFX, cursor
  CameraRig.tsx          the only component allowed to touch camera.position/quaternion
  Lighting.tsx            three-point + environment map per active station (from station config)
  PostFX.tsx               @react-three/postprocessing stack, tuned per station
  stations/<slug>/
    index.tsx            the station's scene graph (geometry, props, triggers)
    colliders.ts           Rapier collider defs for this station, split from visual mesh
    hotspots.ts             { id, position, label, onSelect } — feeds UI overlay + camera targets
  props/<PropName>.tsx    one physics-enabled interactive object, self-contained
  shaders/<name>/          vertex.glsl, fragment.glsl, index.ts (uniforms + shaderMaterial)
```

## Naming
- Station slugs match route segments exactly (`stations/screening/` ↔ `/world/screening`).
- Every mesh that's a navigation/interaction target gets `name="hotspot:<id>"` — the reviewer
  agent and Playwright QA both select by this, never by index or visual position.
- Physics bodies: `rb:<PropName>` on the `<RigidBody>` itself, distinct from the mesh name.

## Camera rig
- **One** `CameraRig` component owns the camera. Nothing else calls `camera.lookAt` or sets
  `camera.position` directly — station components only *request* a target via the Zustand
  store (`useWorldStore.setCameraTarget(stationSlug, hotspotId?)`).
- All camera moves are GSAP timelines on a proxy object tweened each frame into the camera
  (`gsap.to(cameraProxy, {...}, onUpdate: () => camera.position.copy(cameraProxy)})`), eased
  with `power3.inOut` for station-to-station, `back.out(1.4)` (slight overshoot) for
  settling into a hotspot focus. **Never linear.** Idle state: a slow mouse-parallax offset
  (±0.15 world units, lerped, never fighting an active GSAP tween — gate it on
  `!cameraRig.isTweening`).
- Camera moves must never clip geometry: every station defines a `cameraPath` (a Catmull-Rom
  curve through 2–4 waypoints) instead of a straight lerp between two points when the direct
  line would cross a wall/prop — check with a raycast in dev mode (`?debug=camera`).

## Physics (Rapier via @react-three/rapier)
- Only props the user can plausibly expect to react (balls, toggles, small objects) get
  `<RigidBody>`. Floors/walls/static set dressing are `<RigidBody type="fixed">` with
  `colliders="trimesh"` generated once, not per-frame.
- No default mass/restitution/friction. Every prop's collider block in `colliders.ts` states
  values with a one-line comment of *why* (e.g. `restitution: 0.35 // dead-ish landfill-ball
  thud, not superball bounce`). The physics-tuner subagent owns getting these right.
- Cap active rigid bodies per station at ~20; beyond that, bake to static + swap a small
  "activate on click" trigger volume instead of always-simulating physics.

## Lighting & post-processing
- Three-point minimum per station (key/fill/rim) plus one `<Environment>` HDRI matched to the
  station's mood token from its config. Bloom threshold stays high (≥0.85) and intensity low
  (≤0.4) — "the look" is lighting/material, bloom only kisses emissive edges (arcade-style
  screens, the plume-heatmap shader). Vignette subtle (~0.3), no chromatic aberration unless a
  station explicitly wants a glitch/anomaly beat.

## Hover / interaction affordance
- Every hotspot mesh: `onPointerOver` → cursor `pointer` + emissive pulse (via a shared
  `useHoverGlow(meshRef)` hook, not ad hoc per component) + a UI label fade-in keyed to
  `hotspot.id`. `onPointerOut` reverses both. Never rely on outline-only hover; always pair a
  cursor change with a visual state change on the object itself.

## Adding a new station — checklist
1. Add `stations/<slug>/` with `index.tsx`, `colliders.ts`, `hotspots.ts`.
2. Register in `web/content/stations.ts` (slug, entry camera waypoint id, theme tokens).
3. Add nav entry + portal trigger prop in whichever station should link to it.
4. Run the scene-reviewer subagent before merging: camera clipping, hover affordances present,
   physics values non-default, draw calls within budget (see perf-auditor).
