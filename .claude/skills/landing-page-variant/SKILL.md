---
name: landing-page-variant
description: How to spin up a new landing-page / entry-scene variant (a different judge-facing entry point, a demo mode, a press/share variant) from a content config, without touching the 3D engine code. Load before adding a route under web/app/(marketing) or a new file under web/content/landing-pages.
---

# Landing-page variant system — sustain-a-thon

The 3D world engine (`web/components/world/**`, governed by the `r3f-scene` skill) is
generic. A "variant" is pure data — never a fork of engine code.

## Why this exists here
Unlike a client-agency site with unrelated variants, our variants are the same
methane-detection product shown at different depths for different audiences: the default
judge walkthrough, a "fast" 90-second demo mode, and a data-heavy analyst mode. All three
share one `<World />`; only `content/landing-pages/*.config.ts` differs.

## Config shape
```ts
// web/content/landing-pages/<slug>.config.ts
import type { LandingPageConfig } from "@/content/types";

export default {
  slug: "default",
  entryStation: "orbit-overview",       // must match a stations.ts slug
  hero: {
    headline: "India's methane super-emitters, from orbit.",
    subhead: "...",
    cta: { label: "Enter the pipeline", target: "screening" },
  },
  theme: { accent: "#ff6a1f", environment: "dusk-orbit-hdri", mood: "dark-observatory" },
  focusHotspots: ["jawaharnagar", "pirana", "jharia-cluster"], // pre-highlighted on load
  navLinks: [
    { label: "Screening", station: "screening" },
    { label: "Attribution", station: "attribution" },
    { label: "Inventory", station: "inventory" },
  ],
  dataMode: "full" | "demo",             // gates which API routes the station fetches
} satisfies LandingPageConfig;
```

## Route wiring
`web/app/(marketing)/[variant]/page.tsx` reads the slug, `import()`s the matching config
(falls back to `default.config.ts` on an unknown slug — never 404 a judge), and renders
`<World config={config} />`. **No `if (variant === "...")` branching anywhere in engine
code** — if a variant needs a capability the engine doesn't have, that's a new prop on
`LandingPageConfig` and a corresponding read in the generic component, not a fork.

## Adding a new variant
1. Copy `default.config.ts` → `<slug>.config.ts`, change only content/theme/entryStation/
   focusHotspots/dataMode fields.
2. If it needs a new texture set (different mood HDRI, different accent-colored materials),
   generate via the `asset-pipeline` skill and reference the new file — never duplicate a
   GLB just to recolor it (recolor via material uniform driven by `theme.accent` instead).
3. Add the slug to `web/content/landing-pages/index.ts` registry.
4. No engine PR should touch more than the registry + the new config file.

## Guardrail
If implementing a variant request means editing anything under `web/components/world/`,
stop — the request is asking for a new *feature*, not a new *variant*. Flag it back rather
than quietly forking the engine per-variant.
