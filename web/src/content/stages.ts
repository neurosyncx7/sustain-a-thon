// The six beats of the world. Order = scroll order. Camera poses are in metres in the
// observatory frame (x east, y up, z south). Environment keys are interpolated between beats.
// Copy is written against research/findings.md; every number shown on screen comes from /api.

export type Vec3 = [number, number, number];

export type StageEnv = {
  hourAngle: number;   // deg; 0 = solar noon, +west. Drives sun, shadow, stars.
  stars: number;       // 0..1 star-field opacity
  fog: number;         // scene exp2 fog density
  groundFog: number;   // 0..1 low-lying fog layer
  haze: number;        // 0..1 aerosol haze in the sky and god rays
  cloud: number;       // 0..1 monsoon cloud deck
  lamps: number;       // 0..1 oil-lamp intensity
  exposure: number;
};

export type Stage = {
  slug: "prologue" | "ingest" | "seasons" | "anomalies" | "attribution" | "ledger";
  nav: string;
  instrument: string;
  title: string;
  story: string;
  camera: { pos: Vec3; target: Vec3; fov: number };
  // Control point for the flight INTO this stage from the previous one (keeps flights off walls).
  approach?: Vec3;
  env: StageEnv;
};

export const STAGES: Stage[] = [
  {
    slug: "prologue",
    nav: "Night",
    instrument: "Jantar Mantar, Jaipur",
    title: "For three centuries these instruments read the sky.",
    story:
      "Sawai Jai Singh II built them in stone to time the sun and track the stars. We use them to read India's methane record, one instrument per stage of the pipeline.",
    camera: { pos: [9, 1.7, 36], target: [0, 17, -10], fov: 52 },
    env: { hourAngle: -150, stars: 1, fog: 0.006, groundFog: 1, haze: 0.2, cloud: 0, lamps: 1, exposure: 1.0 },
  },
  {
    slug: "ingest",
    nav: "Observe",
    instrument: "Samrat Yantra",
    title: "13:30. Now the sky reads us.",
    story:
      "Sentinel-5P crosses India at about 13:30 local solar time. The sundial's real shadow marks the moment its TROPOMI swath sweeps the ground and records methane in every cloud-free pixel.",
    camera: { pos: [14, 12, 19], target: [5, 3.5, -6], fov: 42 },
    approach: [30, 14, 48],
    env: { hourAngle: 22.5, stars: 0, fog: 0.0028, groundFog: 0.15, haze: 0.55, cloud: 0, lamps: 0, exposure: 1.0 },
  },
  {
    slug: "seasons",
    nav: "Seasons",
    instrument: "Rashivalaya Yantra",
    title: "Twelve instruments, twelve months of background.",
    story:
      "Paddy flooding, monsoon cloud and livestock set India's diffuse methane rhythm. Each of the twelve dials shows one month: how much of India was actually observed, and the background we must remove.",
    camera: { pos: [60, 11, 48], target: [55, 3, 8], fov: 46 },
    approach: [62, 30, 40],
    env: { hourAngle: 45, stars: 0, fog: 0.0035, groundFog: 0.1, haze: 0.8, cloud: 0.55, lamps: 0, exposure: 1.02 },
  },
  {
    slug: "anomalies",
    nav: "Anomalies",
    instrument: "Jai Prakash Yantra",
    title: "What remains once the seasons are gone.",
    story:
      "The bowl inverts the sky onto the ground. Here it holds the residual field: persistent excess methane that the seasonal background cannot explain.",
    camera: { pos: [-44, 20, 4], target: [-50, -1, 26], fov: 48 },
    approach: [0, 40, 30],
    env: { hourAngle: 62, stars: 0, fog: 0.004, groundFog: 0.2, haze: 0.7, cloud: 0.2, lamps: 0, exposure: 1.02 },
  },
  {
    slug: "attribution",
    nav: "Attribution",
    instrument: "Digamsha and Rama Yantra",
    title: "Follow the wind back to the source.",
    story:
      "Every overpass is turned to face its own wind, then stacked. A real source stays fixed while noise averages away, and the flux through the column gives its emission rate.",
    camera: { pos: [-28, 8, -14], target: [-52, 3, -34], fov: 46 },
    approach: [-60, 24, 0],
    env: { hourAngle: 82, stars: 0.35, fog: 0.005, groundFog: 0.55, haze: 0.5, cloud: 0.1, lamps: 0.4, exposure: 1.05 },
  },
  {
    slug: "ledger",
    nav: "Ledger",
    instrument: "The ledger",
    title: "The reading, written down.",
    story:
      "Back on the ground, each site becomes an entry: where it is, what it emits, how sure we are, and what fixing it buys per rupee.",
    camera: { pos: [25.5, 2.1, 64], target: [20, 1.0, 55.5], fov: 40 },
    approach: [0, 22, 40],
    env: { hourAngle: 132, stars: 1, fog: 0.007, groundFog: 0.9, haze: 0.15, cloud: 0, lamps: 1, exposure: 1.0 },
  },
];

export const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.slug, i])) as Record<Stage["slug"], number>;
