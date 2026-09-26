"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { sunDirection } from "@/lib/astro";
import { frame } from "@/lib/timeline";
import { makePlaster } from "../materials/plaster";

// Life in the courtyard after dark: fireflies drifting over the stone (additive, twinkling, gone by
// day) and a lone observer on the platform, looking up the way the observatory's astronomers did.

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

// The stargazer: a drawn silhouette (seen from behind, head tilted back toward Dhruva, hands in a
// long coat's pockets) on a low stone plinth, rim-lit by the sky. A camera-facing card keeps the
// outline crisp at any distance; its alpha is the figure, its colour near-black with a cool edge.
const FIGURE_D =
  "M123.0 58.0 C127.7 60.0 123.2 66.7 125.0 70.0 C126.8 73.3 129.8 75.5 134.0 78.0 C138.2 80.5 145.3 82.2 150.0 85.0 C154.7 87.8 159.0 90.5 162.0 95.0 C165.0 99.5 166.7 103.7 168.0 112.0 C169.3 120.3 169.8 132.8 170.0 145.0 C170.2 157.2 169.5 172.2 169.0 185.0 C168.5 197.8 167.7 211.5 167.0 222.0 C166.3 232.5 165.7 240.3 165.0 248.0 C164.3 255.7 163.0 262.7 163.0 268.0 C163.0 273.3 165.7 276.0 165.0 280.0 C164.3 284.0 161.3 289.0 159.0 292.0 C156.7 295.0 152.2 291.7 151.0 298.0 C149.8 304.3 151.3 320.3 152.0 330.0 C152.7 339.7 156.5 350.7 155.0 356.0 C153.5 361.3 145.5 358.0 143.0 362.0 C140.5 366.0 140.8 368.7 140.0 380.0 C139.2 391.3 138.8 415.3 138.0 430.0 C137.2 444.7 135.8 459.7 135.0 468.0 C134.2 476.3 131.7 476.3 133.0 480.0 C134.3 483.7 141.2 487.2 143.0 490.0 C144.8 492.8 148.2 495.8 144.0 497.0 C139.8 498.2 122.7 499.2 118.0 497.0 C113.3 494.8 116.2 493.5 116.0 484.0 C115.8 474.5 116.7 454.0 117.0 440.0 C117.3 426.0 118.7 411.7 118.0 400.0 C117.3 388.3 115.5 375.0 113.0 370.0 C110.5 365.0 105.5 365.0 103.0 370.0 C100.5 375.0 98.7 388.3 98.0 400.0 C97.3 411.7 98.7 426.0 99.0 440.0 C99.3 454.0 100.2 474.5 100.0 484.0 C99.8 493.5 102.7 494.8 98.0 497.0 C93.3 499.2 76.2 498.2 72.0 497.0 C67.8 495.8 71.2 492.8 73.0 490.0 C74.8 487.2 81.7 483.7 83.0 480.0 C84.3 476.3 81.8 476.3 81.0 468.0 C80.2 459.7 78.8 444.7 78.0 430.0 C77.2 415.3 76.2 391.3 76.0 380.0 C75.8 368.7 78.8 366.0 77.0 362.0 C75.2 358.0 66.5 361.3 65.0 356.0 C63.5 350.7 67.3 339.7 68.0 330.0 C68.7 320.3 70.2 304.3 69.0 298.0 C67.8 291.7 63.3 295.0 61.0 292.0 C58.7 289.0 55.7 284.0 55.0 280.0 C54.3 276.0 57.0 273.3 57.0 268.0 C57.0 262.7 55.7 255.7 55.0 248.0 C54.3 240.3 53.7 232.5 53.0 222.0 C52.3 211.5 51.5 197.8 51.0 185.0 C50.5 172.2 49.8 157.2 50.0 145.0 C50.2 132.8 50.7 120.3 52.0 112.0 C53.3 103.7 55.0 99.5 58.0 95.0 C61.0 90.5 65.3 87.8 70.0 85.0 C74.7 82.2 81.8 80.5 86.0 78.0 C90.2 75.5 93.2 73.3 95.0 70.0 C96.8 66.7 92.3 60.0 97.0 58.0 C101.7 56.0 118.3 56.0 123.0 58.0 Z M127.4 31.2 C128.1 33.8 128.4 36.6 128.4 39.2 C128.4 41.8 128.0 44.5 127.4 46.9 C126.7 49.3 125.7 51.6 124.5 53.6 C123.3 55.5 121.7 57.2 120.0 58.5 C118.3 59.8 116.3 60.7 114.3 61.2 C112.3 61.7 110.1 61.8 108.0 61.5 C105.9 61.2 103.7 60.4 101.7 59.3 C99.7 58.1 97.7 56.6 96.0 54.7 C94.3 52.9 92.7 50.7 91.5 48.4 C90.3 46.1 89.2 43.4 88.6 40.8 C87.9 38.2 87.6 35.4 87.6 32.8 C87.6 30.2 88.0 27.5 88.6 25.1 C89.3 22.7 90.3 20.4 91.5 18.4 C92.7 16.5 94.3 14.8 96.0 13.5 C97.7 12.2 99.7 11.3 101.7 10.8 C103.7 10.3 105.9 10.2 108.0 10.5 C110.1 10.8 112.3 11.6 114.3 12.7 C116.3 13.9 118.3 15.4 120.0 17.3 C121.7 19.1 123.3 21.3 124.5 23.6 C125.7 25.9 126.8 28.6 127.4 31.2 Z";

function figureTexture() {
  const W = 220, H = 500;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  const FIGURE = new Path2D(FIGURE_D);
  // cool rim: the sky behind lights the edge of the figure
  g.shadowColor = "rgba(150,190,255,0.85)"; g.shadowBlur = 7;
  g.fillStyle = "rgba(160,195,255,0.9)"; g.fill(FIGURE);
  g.shadowBlur = 0;
  g.save(); g.translate(0.9, 1.2); g.fillStyle = "#05060b"; g.fill(FIGURE); g.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function Stargazer() {
  const g = useRef<THREE.Group>(null);
  const card = useRef<THREE.Mesh>(null);
  const map = useMemo(() => (typeof document === "undefined" ? null : figureTexture()), []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: true, alphaTest: 0.08, fog: false, toneMapped: false }), [map]);
  const stone = useMemo(() => makePlaster({ base: "#6b5b55", shade: "#3e3432", bleach: "#8c7a70", grime: 0.4, scale: 0.4, roughness: 0.95, bump: 0.2 }), []);
  useFrame(({ camera }) => {
    const d = darkness();
    if (g.current) g.current.visible = d > 0.02;
    mat.opacity = Math.min(1, d * 1.4);
    if (card.current) {                                    // face the camera, stay upright
      const p = card.current.getWorldPosition(tmpV);
      card.current.rotation.y = Math.atan2(camera.position.x - p.x, camera.position.z - p.z);
    }
  });
  return (
    <group ref={g} position={[11.2, 0, 22]}>
      <mesh material={stone} position={[0, 0.6, 0]} castShadow receiveShadow><boxGeometry args={[2.2, 1.2, 2.2]} /></mesh>
      <mesh material={stone} position={[0, 1.24, 0]} receiveShadow><boxGeometry args={[2.5, 0.08, 2.5]} /></mesh>
      <mesh ref={card} material={mat} position={[0, 1.28 + 0.9, 0]} renderOrder={2}>
        <planeGeometry args={[0.79, 1.8]} />
      </mesh>
    </group>
  );
}
const tmpV = new THREE.Vector3();

export function NightLife() {
  return (
    <>
      <Fireflies />
      <Stargazer />
    </>
  );
}
