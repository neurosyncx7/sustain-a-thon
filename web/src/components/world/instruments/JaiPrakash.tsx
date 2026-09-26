"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { goToStage, useWorld } from "@/lib/store";
import { STAGE_INDEX } from "@/content/stages";
import { useApi } from "@/lib/useData";
import { makeMarking, makePlaster } from "../materials/plaster";

// Jai Prakash Yantra: a hemispherical bowl sunk into the ground (the sky inverted onto the earth),
// segmented by radial walkways, with crossed sighting wires above. Painted inside: the real mean
// daily flux divergence over India, 2023-2024 (/api/maps -> divergence_mean.png). Screened
// candidates (/api/candidates) rise as light columns, height by z-score.

export const JP = { x: -58, z: 22, r: 8.75, y: 1.0 };
const BOX = { lon0: 68, lon1: 97.5, lat0: 6.5, lat1: 37.5 };
// disc (x,z) in [-1,1] -> lon/lat: north up (-z), fitted so India's box fills the bowl
export function bowlXZ(lon: number, lat: number): [number, number] {
  const u = ((lon - BOX.lon0) / (BOX.lon1 - BOX.lon0)) * 2 - 1;
  const v = ((lat - BOX.lat0) / (BOX.lat1 - BOX.lat0)) * 2 - 1;
  return [u * JP.r * 0.68, -v * JP.r * 0.68];
}
export function bowlSurfaceY(dx: number, dz: number) {
  const rr = Math.min(JP.r * 0.999, Math.hypot(dx, dz));
  return JP.y - Math.sqrt(JP.r * JP.r - rr * rr);
}

export function JaiPrakash() {
  const maps = useApi("/api/maps");
  const cands = useApi("/api/candidates");
  const plaster = useMemo(() => makePlaster({ doubleSided: true }), []);
  const lime = useMemo(() => makeMarking(), []);
  const uniforms = useMemo(() => ({
    uData: { value: null as THREE.Texture | null }, uHas: { value: 0 }, uGlow: { value: 0.3 },
    uR: { value: JP.r * 0.68 }, uC: { value: new THREE.Vector2(JP.x, JP.z) },
  }), []);

  useEffect(() => {
    const m = maps.data?.divergence_mean;
    if (!m) return;
    new THREE.TextureLoader().load(m.file, (t) => {
      t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.LinearFilter;
      uniforms.uData.value = t; uniforms.uHas.value = 1;
    });
  }, [maps.data, uniforms]);

  const bowlMat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: "#ebe4d8", roughness: 0.5, side: THREE.BackSide });
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uniforms);
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vW;")
        .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvW=(modelMatrix*vec4(transformed,1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", `#include <common>
          varying vec3 vW; uniform sampler2D uData; uniform float uHas, uGlow, uR; uniform vec2 uC;`)
        .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
          {
            vec2 d = (vW.xz - uC) / uR;                 // map disc
            vec2 uv = vec2(d.x*0.5+0.5, 0.5 - d.y*0.5);
            float raw = texture2D(uData, clamp(uv,0.0,1.0)).r*255.0;
            float inside = step(abs(d.x),1.0)*step(abs(d.y),1.0)*step(0.5, raw)*uHas;
            float v = clamp((raw-1.0)/254.0, 0.0, 1.0);
            float pos = smoothstep(0.55, 1.0, v);        // sources: upper tail of divergence
            // radial walkways: 12 darker gaps like the real bowl's segments
            float ang = atan(vW.z-uC.y, vW.x-uC.x);
            float seg = smoothstep(0.02, 0.05, abs(fract(ang/6.28318*12.0)-0.5)*2.0*0.5);
            diffuseColor.rgb *= mix(0.55, 1.0, seg);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05,0.06,0.09), inside*0.9);
            totalEmissiveRadiance += inside * (vec3(0.3,0.62,1.0)*pow(pos,2.0)*2.8 + vec3(0.03,0.07,0.16)*smoothstep(0.3,0.7,v)) * uGlow;
          }`);
    };
    return m;
  }, [uniforms]);

  const list: any[] = cands.data?.candidates ?? [];
  const cols = useMemo(() => list.map((c) => {
    const [dx, dz] = bowlXZ(c.lon, c.lat);
    const h = 0.6 + Math.min(5.5, (c.z - 3) * 1.1);
    return { dx, dz, y0: bowlSurfaceY(dx, dz), h };
  }), [list.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const colMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#8cc6ff", transparent: true, opacity: 0.85, toneMapped: false, fog: false }), []);

  const hovered = useWorld((s) => s.hovered === "anomalies");
  useFrame(({ clock }) => {
    const st = useWorld.getState();
    const near = Math.max(0, 1 - Math.abs(st.progress * 6 - STAGE_INDEX.anomalies) * 1.1);
    uniforms.uGlow.value = 0.35 + 0.9 * near + (hovered ? 0.4 : 0);
    colMat.opacity = (0.25 + 0.65 * near) * (0.85 + 0.15 * Math.sin(clock.elapsedTime * 3));
    lime.emissiveIntensity = hovered ? 0.8 : 0;
  });

  const wireY = JP.y + 1.6;
  return (
    <group name="instrument:jai-prakash"
      onPointerOver={(e) => { e.stopPropagation(); useWorld.getState().setHovered("anomalies"); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { useWorld.getState().setHovered(null); document.body.style.cursor = "auto"; }}
      onClick={(e) => { e.stopPropagation(); goToStage(STAGE_INDEX.anomalies); }}
    >
      <mesh position={[JP.x, JP.y, JP.z]} material={bowlMat} receiveShadow>
        <sphereGeometry args={[JP.r, 96, 48, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
      </mesh>
      {/* rim wall and lime coping */}
      <mesh position={[JP.x, JP.y / 2, JP.z]} material={plaster} castShadow receiveShadow>
        <cylinderGeometry args={[JP.r + 0.9, JP.r + 1.0, JP.y + 0.05, 96, 1, true]} />
      </mesh>
      <mesh position={[JP.x, JP.y + 0.02, JP.z]} rotation-x={-Math.PI / 2} material={lime} receiveShadow>
        <ringGeometry args={[JP.r, JP.r + 0.9, 96]} />
      </mesh>
      {/* crossed sighting wires on four posts, with the central ring whose shadow reads the sun */}
      {[0, Math.PI / 2].map((a) => (
        <mesh key={a} position={[JP.x, wireY, JP.z]} rotation={[0, a, Math.PI / 2]} material={lime}>
          <cylinderGeometry args={[0.025, 0.025, 2 * (JP.r + 0.5), 6]} />
        </mesh>
      ))}
      <mesh position={[JP.x, wireY, JP.z]} rotation-x={Math.PI / 2} material={lime}>
        <torusGeometry args={[0.35, 0.05, 8, 24]} />
      </mesh>
      {[0, 1, 2, 3].map((k) => {
        const a = (k * Math.PI) / 2;
        return (
          <mesh key={k} position={[JP.x + Math.cos(a) * (JP.r + 0.5), (wireY + 0.1) / 2, JP.z + Math.sin(a) * (JP.r + 0.5)]} material={plaster} castShadow>
            <boxGeometry args={[0.35, wireY + 0.1, 0.35]} />
          </mesh>
        );
      })}
      {cols.map((c, i) => (
        <mesh key={i} material={colMat} position={[JP.x + c.dx, c.y0 + c.h / 2, JP.z + c.dz]}>
          <cylinderGeometry args={[0.07, 0.11, c.h, 8]} />
        </mesh>
      ))}
    </group>
  );
}
