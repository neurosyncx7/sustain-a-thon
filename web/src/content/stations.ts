// Registry of world stations. r3f-scene skill: slug must match the folder under
// components/world/stations/<slug>/. No station content here is invented copy — headline/body
// text is written against research/findings.md and updated only when that file changes.
export type StationConfig = {
  slug: string;
  title: string;
  summary: string;
  cameraWaypoint: [number, number, number];
  lookAt: [number, number, number];
  environment: "dusk-orbit-hdri" | "lab-neutral-hdri";
};

export const STATIONS: Record<string, StationConfig> = {
  "orbit-overview": {
    slug: "orbit-overview",
    title: "India's methane super-emitters, from orbit",
    summary:
      "A real Sentinel-5P/TROPOMI + ERA5 pipeline screening India for persistent point-source " +
      "methane emitters, separated from the country's dominant diffuse agricultural signal.",
    cameraWaypoint: [0, 1.6, 6],
    lookAt: [0, 1, 0],
    environment: "dusk-orbit-hdri",
  },
  screening: {
    slug: "screening",
    title: "Screening",
    summary:
      "Wind-rotated flux-divergence screening across India, with an explicit detection floor " +
      "and per-season/region uncertainty — not a single-overpass claim.",
    cameraWaypoint: [3, 1.4, 2],
    lookAt: [0, 1, 0],
    environment: "lab-neutral-hdri",
  },
};

export const STATION_ORDER = ["orbit-overview", "screening"] as const;
