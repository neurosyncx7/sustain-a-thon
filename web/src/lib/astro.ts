import * as THREE from "three";

// Real solar geometry for the Jaipur observatory. Coordinates: x = east, y = up, z = south.
// Declination is fixed to the date of the real TROPOMI sample in data-pipeline (2024-01-15),
// so the sundial in the scene shows the sun where it actually was that day.
export const JAIPUR_LAT_DEG = 26.92;
const D2R = Math.PI / 180;

// Low-precision solar ephemeris (Astronomical Almanac, accurate to ~0.01 deg), evaluated at the
// real sample overpass: TROPOMI orbit 32417, 2024-01-15 ~07:41 UTC.
export const SCENE_UTC = Date.UTC(2024, 0, 15, 7, 41);
function solarEphemeris(utcMs: number) {
  const n = (utcMs - Date.UTC(2000, 0, 1, 12)) / 86400000;
  const L = (280.46 + 0.9856474 * n) * D2R;
  const g = (357.528 + 0.9856003 * n) * D2R;
  const lam = L + (1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * D2R;
  const eps = (23.439 - 0.0000004 * n) * D2R;
  return {
    ra: Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)),
    dec: Math.asin(Math.sin(eps) * Math.sin(lam)),
  };
}
const EPH = solarEphemeris(SCENE_UTC);
export const DECLINATION_DEG = EPH.dec / D2R;   // ~ -21.2 deg
export const SUN_RA_RAD = EPH.ra;

/** Local sidereal angle (rad) implied by the sun's hour angle: LST = RA_sun + H_sun. */
export const lstFromHourAngle = (hourAngleDeg: number) => SUN_RA_RAD + hourAngleDeg * D2R;

/** World direction of any celestial object (RA/Dec rad) at a given local sidereal angle. */
export function celestialDirection(ra: number, dec: number, lst: number, out = new THREE.Vector3()) {
  const phi = JAIPUR_LAT_DEG * D2R;
  const h = lst - ra;
  const east = -Math.cos(dec) * Math.sin(h);
  const north = Math.cos(phi) * Math.sin(dec) - Math.sin(phi) * Math.cos(dec) * Math.cos(h);
  const up = Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(h);
  return out.set(east, up, -north).normalize();
}

// North galactic pole (J2000): RA 192.859 deg, Dec +27.128 deg.
export const GAL_POLE = { ra: 192.859 * D2R, dec: 27.128 * D2R };

/** Unit vector pointing to the sun for an hour angle H (deg, 0 = local solar noon, +west). */
export function sunDirection(hourAngleDeg: number, out = new THREE.Vector3()) {
  const phi = JAIPUR_LAT_DEG * D2R;
  const dec = DECLINATION_DEG * D2R;
  const H = hourAngleDeg * D2R;
  const east = -Math.cos(dec) * Math.sin(H);
  const north = Math.cos(phi) * Math.sin(dec) - Math.sin(phi) * Math.cos(dec) * Math.cos(H);
  const up = Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H);
  return out.set(east, up, -north).normalize();
}

/** Earth's rotation axis in scene coordinates: points to the north celestial pole. */
export const POLAR_AXIS = new THREE.Vector3(0, Math.sin(JAIPUR_LAT_DEG * D2R), -Math.cos(JAIPUR_LAT_DEG * D2R)).normalize();

/** Local solar time (hours) for an hour angle. */
export const solarTime = (hourAngleDeg: number) => 12 + hourAngleDeg / 15;

export function formatSolarTime(hourAngleDeg: number) {
  let t = solarTime(hourAngleDeg);
  t = ((t % 24) + 24) % 24;
  const h = Math.floor(t);
  const m = Math.floor((t - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Hour angle at which the sun sets that day (deg). */
export const SUNSET_HOUR_ANGLE =
  Math.acos(-Math.tan(JAIPUR_LAT_DEG * D2R) * Math.tan(DECLINATION_DEG * D2R)) / D2R;
