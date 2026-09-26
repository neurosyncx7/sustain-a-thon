"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { sunDirection } from "@/lib/astro";
import { frame } from "@/lib/timeline";

// Life in the courtyard after dark: fireflies drifting over the stone (additive, twinkling, gone by
// day).

const COUNT = 140;
const sun = new THREE.Vector3();

function darkness() {
  const y = sunDirection(frame.env.hourAngle, sun).y;
  return (1 - THREE.MathUtils.smoothstep(y, -0.2, 0.02)) * frame.env.stars;
}

function Fireflies() {
  const pts = useRef<THREE.Points>(null);
  const { geo, mat } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(COUNT * 3), seed = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      // a band around the Samrat Yantra and the path toward the viewer
      const a = Math.random() * Math.PI * 2, r = 6 + Math.pow(Math.random(), 0.7) * 34;
      p[i * 3] = Math.cos(a) * r * 0.9 + 4;
      p[i * 3 + 1] = 0.25 + Math.random() * 2.6;
      p[i * 3 + 2] = Math.sin(a) * r * 0.6 + 16;
      seed[i] = Math.random();
    }
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      uniforms: { uTime: { value: 0 }, uDark: { value: 1 }, uPx: { value: 1 } },
      vertexShader: /* glsl */`
        attribute float aSeed; uniform float uTime, uPx; varying float vA;
        void main(){
          vec3 p = position;
          float t = uTime*0.35 + aSeed*40.0;
          p += vec3(sin(t*0.9+aSeed*7.0)*0.9, sin(t*1.3)*0.35, cos(t*0.7+aSeed*3.0)*0.9);
          vec4 mv = modelViewMatrix*vec4(p,1.0);
          vA = pow(0.5+0.5*sin(uTime*(1.2+aSeed*2.0)+aSeed*60.0), 3.0);
          gl_PointSize = uPx * (26.0 / -mv.z) * (0.6 + aSeed);
          gl_Position = projectionMatrix*mv;
        }`,
      fragmentShader: /* glsl */`
        uniform float uDark; varying float vA;
        void main(){
          vec2 c = gl_PointCoord-0.5; float r2 = dot(c,c)*4.0;
          float a = (exp(-r2*9.0) + exp(-r2*2.2)*0.35) * vA * uDark;
          if (a < 0.004) discard;
          gl_FragColor = vec4(vec3(0.45,0.72,1.0)*(1.0+exp(-r2*12.0)), a);
        }`,
    });
    return { geo: g, mat: m };
  }, []);
  useFrame(({ clock, gl }) => {
    mat.uniforms.uTime.value = clock.elapsedTime;
    mat.uniforms.uDark.value = darkness();
    mat.uniforms.uPx.value = gl.getPixelRatio() * 6;
  });
  return <points ref={pts} geometry={geo} material={mat} frustumCulled={false} />;
}

export function NightLife() {
  return (
    <>
      <Fireflies />
    </>
  );
}
