"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { GAL_POLE, POLAR_AXIS, celestialDirection, lstFromHourAngle, sunDirection } from "@/lib/astro";
import { frame } from "@/lib/timeline";

// One dome shader: twilight colour model driven by true solar elevation, aerosol haze, sun disk
// and forward-scatter glow, procedural stars + Milky Way fixed in the celestial frame (rotated
// about Jaipur's polar axis by the hour angle, so the sky turns exactly as it would), a faint
// sodium-orange city glow on the night horizon, and a drifting monsoon cloud deck.

const vert = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
}`;

const frag = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform vec3 uSun;
uniform mat3 uCel;      // world -> celestial frame (for noise that must turn with the sky)
uniform vec3 uGal;      // north galactic pole, world space (real RA/Dec)
uniform float uStars, uHaze, uCloud, uTime;

float h13(vec3 p){ p = fract(p*vec3(443.897,441.423,437.195)); p += dot(p, p.yzx+19.19); return fract((p.x+p.y)*p.z); }
float n3(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(h13(i),h13(i+vec3(1,0,0)),f.x),mix(h13(i+vec3(0,1,0)),h13(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h13(i+vec3(0,0,1)),h13(i+vec3(1,0,1)),f.x),mix(h13(i+vec3(0,1,1)),h13(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm(vec3 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*n3(p); p*=2.02; a*=.5;} return s; }


void main(){
  vec3 d = normalize(vDir);
  float e = uSun.y;                          // sun elevation (sine)
  float up = max(d.y, 0.0);
  float day = smoothstep(-0.05, 0.3, e);
  float twi = exp(-pow((e+0.02)*7.0, 2.0));
  float night = 1.0 - smoothstep(-0.25, 0.02, e);

  // --- base gradient by regime
  vec3 dayZen = mix(vec3(0.28,0.46,0.74), vec3(0.55,0.60,0.68), uHaze*0.6);
  vec3 dayHor = mix(vec3(0.80,0.82,0.84), vec3(0.98,0.82,0.62), uHaze);
  vec3 nZen = vec3(0.012,0.018,0.04), nHor = vec3(0.035,0.045,0.08);
  float hz = pow(1.0 - up, 3.0);
  vec3 col = mix(nZen, nHor, hz);
  col = mix(col, mix(dayZen, dayHor, hz), day);

  // twilight belt: warm on the sun side, rose/violet opposite (Belt of Venus)
  vec3 sunH = normalize(vec3(uSun.x, 0.0, uSun.z) + 1e-5);
  float toward = dot(normalize(vec3(d.x,0.,d.z)+1e-5), sunH)*0.5+0.5;
  vec3 twiCol = mix(vec3(0.42,0.26,0.42), vec3(1.0,0.48,0.22), toward);
  col = mix(col, twiCol, twi * pow(1.0-up, 2.2) * 0.95);
  col += twi * vec3(0.08,0.05,0.12) * (1.0-hz);

  // sun disk + scattering
  float mu = max(dot(d, uSun), 0.0);
  vec3 sunCol = mix(vec3(1.0,0.55,0.28), vec3(1.0,0.96,0.88), smoothstep(0.0,0.4,e));
  col += sunCol * pow(mu, 12.0) * (0.25 + 0.6*uHaze) * smoothstep(-0.1,0.05,e);
  col += sunCol * pow(mu, 180.0) * 0.8 * smoothstep(-0.05,0.05,e);
  col += sunCol * smoothstep(0.9995, 0.99975, mu) * 18.0 * smoothstep(-0.02,0.02,e);

  // stars + Milky Way in the celestial frame
  vec3 c = uCel * d;
  float starVis = uStars * night * smoothstep(-0.02, 0.18, d.y) * (1.0 - uCloud*0.9);
  float band = exp(-pow(dot(d, uGal)/0.17, 2.0));     // real galactic plane
  float dust = fbm(c*6.0);
  float lanes = smoothstep(0.35, 0.75, fbm(c*11.0+3.0));
  float grain = smoothstep(0.62, 0.95, fbm(c*48.0));                 // unresolved star clouds
  vec3 armCol = mix(vec3(0.46,0.54,0.86), vec3(0.92,0.78,0.62), smoothstep(0.2,0.9,dust)); // blue arms, warm dust
  vec3 milky = armCol*band*(0.35+0.65*dust)*(1.0-0.75*lanes*band) + vec3(0.75,0.8,1.0)*band*grain*0.35;
  col += milky * 0.36 * starVis;   // point stars come from the real catalogue (Stars.tsx)
  // airglow: the faint green-violet oxygen glow a few degrees above a dark horizon
  col += (vec3(0.05,0.11,0.07) + vec3(0.05,0.02,0.09)*smoothstep(0.02,0.25,up)) * starVis * exp(-pow((up-0.12)/0.09, 2.0)) * 0.7;

  // city glow on the night horizon (Jaipur is a city of 4 million)
  col += vec3(0.20,0.10,0.04) * night * exp(-up*9.0) * 0.55;

  // monsoon cloud deck
  if (d.y > 0.0 && uCloud > 0.001){
    vec2 uv = d.xz / (d.y + 0.08) * 0.9 + vec2(uTime*0.004, uTime*0.002);
    float cl = fbm(vec3(uv*1.4, uTime*0.01));
    float cov = smoothstep(1.0 - uCloud*0.95, 1.0 - uCloud*0.55, cl);
    vec3 lit = mix(vec3(0.45,0.47,0.52), vec3(0.95,0.9,0.85), day) * (0.6 + 0.5*pow(mu,4.0));
    lit = mix(lit, twiCol*0.9, twi*0.6);
    col = mix(col, lit * (0.75 + 0.35*cl), cov * smoothstep(0.0,0.2,d.y));
  }

  // below the horizon: blend into the ground-haze colour
  col = mix(col, mix(nHor, dayHor, day) * (0.7 + 0.3*day), smoothstep(0.02, -0.08, d.y));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const tmpM4 = new THREE.Matrix4();

export function SkyDome() {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uSun: { value: new THREE.Vector3(0, 1, 0) },
      uCel: { value: new THREE.Matrix3() },
      uGal: { value: new THREE.Vector3(0, 1, 0) },
      uStars: { value: 1 },
      uHaze: { value: 0.3 },
      uCloud: { value: 0 },
      uTime: { value: 0 },
    }),
    [],
  );

  const mesh = useRef<THREE.Mesh>(null);
  useFrame(({ clock, camera }) => {
    mesh.current?.position.copy(camera.position); // dome travels with the eye: sky at infinity
    const e = frame.env;
    const u = uniforms;
    sunDirection(e.hourAngle, u.uSun.value);
    // celestial = Rot(axis, +H) * world  (verified numerically against sunDirection)
    tmpM4.makeRotationAxis(POLAR_AXIS, (e.hourAngle * Math.PI) / 180);
    u.uCel.value.setFromMatrix4(tmpM4);
    celestialDirection(GAL_POLE.ra, GAL_POLE.dec, lstFromHourAngle(e.hourAngle), u.uGal.value);
    u.uStars.value = e.stars;
    u.uHaze.value = e.haze;
    u.uCloud.value = e.cloud;
    u.uTime.value = clock.elapsedTime;
  });

  return (
    <mesh ref={mesh} frustumCulled={false} renderOrder={-10}>
      <sphereGeometry args={[900, 64, 32]} />
      <shaderMaterial
        ref={mat}
        vertexShader={vert}
        fragmentShader={frag}
        uniforms={uniforms}
        side={THREE.BackSide}
        depthWrite={false}
        fog={false}
      />
    </mesh>
  );
}

/** CPU twin of the shader's horizon colour, used for scene fog so geometry melts into the sky. */
export function horizonColor(sunY: number, haze: number, out: THREE.Color) {
  const ss = (a: number, b: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const day = ss(-0.05, 0.3, sunY);
  const twi = Math.exp(-Math.pow((sunY + 0.02) * 7, 2));
  const n = [0.035, 0.045, 0.08];
  const dh = [0.8 + (0.98 - 0.8) * haze, 0.82 + (0.82 - 0.82) * haze, 0.84 + (0.62 - 0.84) * haze];
  const r = n[0] + (dh[0] - n[0]) * day + 0.45 * twi;
  const g = n[1] + (dh[1] - n[1]) * day + 0.22 * twi;
  const b = n[2] + (dh[2] - n[2]) * day + 0.12 * twi;
  return out.setRGB(r * 0.85, g * 0.85, b * 0.85);
}
