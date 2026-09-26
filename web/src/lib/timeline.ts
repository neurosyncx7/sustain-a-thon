import * as THREE from "three";
import { STAGES, type StageEnv } from "@/content/stages";

// Pure function of scroll progress -> camera pose + environment. Plateaus around each stage let
// the camera settle (hold) before the next flight; flights follow quadratic Bezier arcs through
// each stage's `approach` point so the camera never cuts straight through masonry.

const N = STAGES.length;
const smoother = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export type Frame = {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
  env: StageEnv;
  segment: number;   // index of stage we're leaving
  t: number;         // eased 0..1 within segment
  flight: number;    // 0 at a hold, ->1 mid-flight (drives depth-of-field / motion blur feel)
};

const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3();

export const frame: Frame = {
  pos: new THREE.Vector3(),
  target: new THREE.Vector3(),
  fov: 50,
  env: { ...STAGES[0].env },
  segment: 0,
  t: 0,
  flight: 0,
};

export function evaluate(progress: number, out: Frame = frame): Frame {
  const x = clamp01(progress) * (N - 1);
  const i = Math.min(N - 2, Math.floor(x));
  const raw = x - i;
  const t = smoother(clamp01((raw - 0.1) / 0.8));
  const a = STAGES[i], b = STAGES[i + 1];

  tmpA.fromArray(a.camera.pos);
  tmpB.fromArray(b.camera.pos);
  if (b.approach) tmpC.fromArray(b.approach);
  else tmpC.copy(tmpA).add(tmpB).multiplyScalar(0.5);
  // quadratic Bezier A -> C -> B
  const u = 1 - t;
  out.pos.set(
    u * u * tmpA.x + 2 * u * t * tmpC.x + t * t * tmpB.x,
    u * u * tmpA.y + 2 * u * t * tmpC.y + t * t * tmpB.y,
    u * u * tmpA.z + 2 * u * t * tmpC.z + t * t * tmpB.z,
  );
  out.target.fromArray(a.camera.target).lerp(tmpB.fromArray(b.camera.target), t);
  out.fov = a.camera.fov + (b.camera.fov - a.camera.fov) * t;

  const ea = a.env, eb = b.env, e = out.env;
  (Object.keys(ea) as (keyof StageEnv)[]).forEach((k) => {
    e[k] = ea[k] + (eb[k] - ea[k]) * t;
  });
  out.segment = i;
  out.t = t;
  out.flight = Math.sin(Math.PI * t);
  return out;
}
