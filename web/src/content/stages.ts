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
  slug: "prologue" | "ingest" | "observe" | "seasons" | "anomalies" | "attribution" | "ledger";
  nav: string;
  instrument: string;
  step: string;              // which stage of the working pipeline this instrument stands for
  title: string;
  story: string;
  algorithms: string[];      // the validated components that run at this step (names match /api/algorithms)
  link: { href: string; label: string };
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
    step: "India's methane super-emitters, read from orbit",
    title: "India's biggest methane sources, found from orbit and checked in the open.",
    story:
      "Methane traps over 80 times more heat than CO₂ across twenty years. Most of India's is diffuse, from paddy and livestock; the part that can be fixed fastest comes from concentrated sources such as landfills, coal fields and oil fields. Vāyu Lekha reads every clear pass of ESA's Sentinel-5P over India, finds the persistent sources, tests each against its own statistical null, and ranks them by warming avoided per rupee. The instruments Sawai Jai Singh II built to read the sky carry the pipeline, one stage each.",
    algorithms: [],
    link: { href: "/ledger", label: "Skip to the inventory" },
    camera: { pos: [9, 1.7, 36], target: [-1, 21, -10], fov: 56 },
    env: { hourAngle: -210, stars: 1, fog: 0.0035, groundFog: 0.55, haze: 0.12, cloud: 0, lamps: 1, exposure: 1.0 },
  },
  {
    slug: "ingest",
    nav: "13:30",
    instrument: "Samrat Yantra",
    step: "Step 1 · Ingest",
    title: "13:30. Now the sky reads us.",
    story:
      "Sentinel-5P crosses India at about 13:30 local solar time; the sundial's computed shadow marks that moment. Within about three hours the pass is on the Copernicus mirror, and our pipeline downloads it, checks every file against Copernicus's own checksum, keeps only pixels the retrieval trusts, and publishes the result. This happens every three hours, without anyone pressing a button.",
    algorithms: ["Copernicus checksum verification", "qa ≥ 0.5 filter", "3-hourly live pass"],
    link: { href: "/ledger#live", label: "See today's pass" },
    camera: { pos: [14, 12, 19], target: [5, 3.5, -6], fov: 42 },
    approach: [30, 14, 48],
    env: { hourAngle: 22.5, stars: 0, fog: 0.0028, groundFog: 0.15, haze: 0.55, cloud: 0, lamps: 0, exposure: 1.0 },
  },
  {
    slug: "observe",
    nav: "Observe",
    instrument: "Sentinel-5P / TROPOMI",
    step: "Step 2 · Clean the signal",
    title: "Millions of clear looks, cleaned before they are trusted.",
    story:
      "Stacked since 2023, the passes draw India's methane: the Indo-Gangetic plain glows, the Himalaya goes quiet. Bright desert, dark forest and dust all bend the retrieval, so the pipeline removes the part of each pass that tracks surface brightness and aerosol (ABD), and weights every pass by its own measured noise (SRECE). Together they lower the detection floor before any source is sought.",
    algorithms: ["ABD albedo/aerosol correction", "SRECE noise weighting"],
    link: { href: "/ledger#algorithms", label: "How much each step earns" },
    camera: { pos: [30, 62, -26], target: [0, 0, -112], fov: 50 },
    approach: [32, 40, 6],
    env: { hourAngle: 30, stars: 0, fog: 0.0022, groundFog: 0.08, haze: 0.5, cloud: 0.05, lamps: 0, exposure: 1.0 },
  },
  {
    slug: "seasons",
    nav: "Seasons",
    instrument: "Rashivalaya Yantra",
    step: "Step 3 · Separate the seasons",
    title: "Twelve dials, twelve months of background.",
    story:
      "Paddy flooding, monsoon cloud and livestock set India's diffuse methane rhythm. Each dial is one month: how much of India was actually seen. July is almost blind, about 44 times fewer clear pixels a day than December (2023-2026 average), so monsoon months are left out and reported as unobserved, never as zero. What remains of the seasonal field is removed site by site with a local background plane fitted 60 to 140 km out.",
    algorithms: ["Monsoon exclusion", "Local plane background"],
    link: { href: "/ledger", label: "Coverage in the inventory" },
    camera: { pos: [70, 16, 40], target: [70, 2, -4], fov: 58 },
    approach: [70, 40, -20],
    env: { hourAngle: 45, stars: 0, fog: 0.0035, groundFog: 0.1, haze: 0.8, cloud: 0.55, lamps: 0, exposure: 1.02 },
  },
  {
    slug: "anomalies",
    nav: "Anomalies",
    instrument: "Jai Prakash Yantra",
    step: "Step 4 · Find the leads",
    title: "What remains once the seasons are gone.",
    story:
      "The bowl inverts the sky onto the ground. It holds the flux divergence, where more methane leaves a place than arrives: the fingerprint of a source. Given no list of known sites, this national screen still lands next to documented landfills and coal fields, named below. A lead is only a lead: each one next gets its own stack and its own test.",
    algorithms: ["Flux divergence (continuity equation)", "Blind national screen"],
    link: { href: "/ledger#leads", label: "All screen leads" },
    camera: { pos: [-44, 17, 38], target: [-58, -3, 21], fov: 48 },
    approach: [10, 38, 40],
    env: { hourAngle: 62, stars: 0, fog: 0.004, groundFog: 0.2, haze: 0.7, cloud: 0.2, lamps: 0, exposure: 1.02 },
  },
  {
    slug: "attribution",
    nav: "Attribution",
    instrument: "Digamsha and Rama Yantra",
    step: "Step 5 · Stack, measure, attribute",
    title: "Follow the wind back to the source.",
    story:
      "Every overpass is turned to face its own wind, spread over its true footprint (DiverSR), balanced so no sub-pixel position dominates (KPW), and stacked; a real source stays put while noise averages away. The rate is calibrated by plumes injected into real data (OBC), and carbon monoxide in the same pixels says whether the source burns or decays (EIV-CRF).",
    algorithms: ["Wind rotation", "DiverSR drizzle", "KPW phase weighting", "OBC calibration", "EIV-CRF CO/CH₄"],
    link: { href: "/site/jawaharnagar", label: "Open this site's dossier" },
    camera: { pos: [-36, 10, 82], target: [-60, 4, 55], fov: 46 },
    approach: [-30, 26, 50],
    env: { hourAngle: 82, stars: 0.35, fog: 0.005, groundFog: 0.55, haze: 0.5, cloud: 0.1, lamps: 0.4, exposure: 1.05 },
  },
  {
    slug: "ledger",
    nav: "Ledger",
    instrument: "The ledger",
    step: "Step 6 · Decide what to fix first",
    title: "The reading, written down.",
    story:
      "Each site becomes an entry with its evidence attached. It is confirmed only if it passes a false-discovery gate across all sites tested and an independent check, such as being found again in separate years. It is ranked by warming avoided per rupee (WRPI), and the most informative unconfirmed sites are flagged for a high-resolution satellite look (VOIT). A person reviews every entry before anyone acts.",
    algorithms: ["BY-FDR + corroboration gate", "WRPI priority", "VOIT tasking", "Human review"],
    link: { href: "/ledger", label: "Open the full inventory" },
    camera: { pos: [27.9, 2.05, 64.9], target: [25.7, 0.95, 61.0], fov: 44 },
    approach: [-5, 20, 80],
    env: { hourAngle: 132, stars: 1, fog: 0.007, groundFog: 0.9, haze: 0.15, cloud: 0, lamps: 1, exposure: 1.0 },
  },
];

export const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.slug, i])) as Record<Stage["slug"], number>;
