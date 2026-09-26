"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { frame } from "@/lib/timeline";

// Low-lying mist as a stack of soft noise slices (true parallax as the camera moves through it)
// plus dust motes that glitter when they sit between the eye and the sun (forward scattering).

const fogVert = /* glsl */ `
varying vec3 vW;
void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`;
const fogFrag = /* glsl */ `
varying vec3 vW;
uniform float uTime, uDensity, uLayer; uniform vec3 uColor; uniform vec3 uCam;
float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float n(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ s+=a*n(p); p*=2.1; a*=.5;} return s; }
void main(){
  vec2 p = vW.xz*0.035 + vec2(uTime*0.012*(1.0+uLayer), uTime*0.007);
  float m = fbm(p + fbm(p*1.7 + uLayer*3.1)*1.3);
  float a = smoothstep(0.35, 0.85, m) * uDensity;
  float d = length(vW.xz - uCam.xz);
  a *= smoothstep(1.5, 9.0, d) * (1.0 - smoothstep(160.0, 320.0, d)); // fade near the eye and far off
  gl_FragColor = vec4(uColor, a * (1.0 - uLayer*0.7));
  #include <colorspace_fragment>
}`;

const SLICES = 9;

export function GroundFog() {
  const mats = useMemo(
    () =>
      Array.from({ length: SLICES }, (_, i) =>
        new THREE.ShaderMaterial({
          vertexShader: fogVert,
          fragmentShader: fogFrag,
          transparent: true,
          depthWrite: false,
          uniforms: {
            uTime: { value: 0 },
            uDensity: { value: 0.5 },
            uLayer: { value: i / (SLICES - 1) },
            uColor: { value: new THREE.Color("#b7b9c6") },
            uCam: { value: new THREE.Vector3() },
          },
        }),
      ),
    [],
  );
  const night = new THREE.Color("#5d6a8c"), day = new THREE.Color("#e8dccb");

  useFrame(({ clock, camera }) => {
    const e = frame.env;
    const dayK = THREE.MathUtils.smoothstep(e.hourAngle, -100, -70) * (1 - THREE.MathUtils.smoothstep(e.hourAngle, 70, 95));
    mats.forEach((m) => {
      m.uniforms.uTime.value = clock.elapsedTime;
      m.uniforms.uDensity.value = 0.22 * e.groundFog + 0.04;
      (m.uniforms.uColor.value as THREE.Color).copy(night).lerp(day, dayK);
      (m.uniforms.uCam.value as THREE.Vector3).copy(camera.position);
    });
  });

  return (
    <group>
      {mats.map((m, i) => (
        <mesh key={i} material={m} rotation-x={-Math.PI / 2} position-y={0.25 + i * 0.45} renderOrder={5}>
          <planeGeometry args={[640, 640]} />
        </mesh>
      ))}
    </group>
  );
}

const dustVert = /* glsl */ `
attribute float aSeed;
uniform float uTime; uniform vec3 uSun; uniform float uSize;
varying float vGlint; varying float vSeed;
void main(){
  vec3 p = position;
  p.x += sin(uTime*0.07 + aSeed*40.0)*3.0;
  p.y += mod(uTime*0.15*(0.3+aSeed) + aSeed*20.0, 18.0);
  p.z += cos(uTime*0.05 + aSeed*20.0)*3.0;
  vec4 mv = modelViewMatrix*vec4(p,1.0);
  vec3 toEye = normalize(-mv.xyz);
  vec3 sunV = normalize((viewMatrix*vec4(uSun,0.0)).xyz);
  vGlint = pow(max(dot(-toEye, sunV), 0.0), 6.0);  // brightest looking toward the sun
  vSeed = aSeed;
  gl_PointSize = uSize * (0.5 + aSeed) * (30.0 / -mv.z);
  gl_Position = projectionMatrix*mv;
}`;
const dustFrag = /* glsl */ `
varying float vGlint; varying float vSeed; uniform float uAmount; uniform vec3 uTint;
void main(){
  vec2 c = gl_PointCoord - 0.5; float r = dot(c,c);
  if (r > 0.25) discard;
  float a = (1.0 - r*4.0) * (0.12 + 1.2*vGlint) * uAmount;
  gl_FragColor = vec4(uTint, a);
}`;

export function Dust({ count = 2600 }: { count?: number }) {
  const { geo, mat } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3), seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 220;
      pos[i * 3 + 1] = Math.random() * 4;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 220;
      seed[i] = Math.random();
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: dustVert,
      fragmentShader: dustFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uSize: { value: 2.2 },
        uAmount: { value: 1 }, uTint: { value: new THREE.Color("#ffe2c0") },
      },
    });
    return { geo: g, mat: m };
  }, [count]);

  useFrame(({ clock }) => {
    const e = frame.env;
    mat.uniforms.uTime.value = clock.elapsedTime;
    const H = (e.hourAngle * Math.PI) / 180;
    (mat.uniforms.uSun.value as THREE.Vector3).set(-Math.sin(H), 0.6, 0.7).normalize();
    mat.uniforms.uAmount.value = 0.35 + 0.9 * e.haze + 0.4 * e.lamps;
  });

  return <points geometry={geo} material={mat} frustumCulled={false} />;
}
