"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { goToStage, useWorld } from "@/lib/store";
import { STAGE_INDEX } from "@/content/stages";
import { useApi } from "@/lib/useData";
import { makeMarking, makePlaster } from "../materials/plaster";

// Rashivalaya Yantra: twelve small sundials, each historically aligned to one zodiac sign (tilts
// and yaws here are stylised). Here each is one calendar month of the real 2023-2024 record:
// its dial glows and its light shaft rises with the fraction of India actually observed that
// month (/api/months); monsoon months stay dim and are wrapped in cloud.

export const RASHI = { cx: 70, cz: -38, r: 46 };
export function rashiPosition(i: number): [number, number, number] {
  const a = ((158 - i * (136 / 11)) * Math.PI) / 180;   // ~9.9 m apart
  return [RASHI.cx + RASHI.r * Math.cos(a), 0, RASHI.cz + RASHI.r * Math.sin(a)];
}
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function smallGnomon(h: number, len: number) {
  const s = new THREE.Shape();
  s.moveTo(-len / 2, 0); s.lineTo(len / 2, 0); s.lineTo(len / 2, h); s.lineTo(-len / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 1.1, bevelEnabled: false });
  g.rotateY(Math.PI / 2); g.translate(-0.55, 0, 0);
  return g;
}

const shaftVert = "varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}";
const shaftFrag = `varying vec2 vUv; uniform float uA, uT;
  void main(){ float r = abs(vUv.x-0.5)*2.0; float a = (1.0-r*r) * pow(1.0-vUv.y, 1.6) * uA;
    a *= 0.8 + 0.2*sin(uT*2.0 + vUv.y*14.0);
    gl_FragColor = vec4(vec3(0.45,0.72,1.0), a*0.32); }`;

const cloudVert = `attribute vec3 aOff; attribute float aSeed; uniform float uT; varying vec2 vUv; varying float vS;
  void main(){ vUv = uv; vS = aSeed;
    vec3 c = aOff + vec3(sin(uT*0.1+aSeed*20.0)*1.2, sin(uT*0.07+aSeed*9.0)*0.4, cos(uT*0.08+aSeed*13.0)*1.2);
    vec4 mv = modelViewMatrix*vec4(c,1.0); mv.xy += position.xy * (3.0 + aSeed*3.0);
    gl_Position = projectionMatrix*mv; }`;
const cloudFrag = `varying vec2 vUv; varying float vS; uniform float uA; uniform vec3 uCol;
  float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  float n(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
  void main(){ vec2 c = vUv-0.5; float r = length(c)*2.0;
    float nz = n(vUv*4.0+vS*10.0)*0.6 + n(vUv*9.0-vS*7.0)*0.4;
    float a = smoothstep(1.0, 0.2, r + (nz-0.5)*0.6) * uA;
    gl_FragColor = vec4(uCol, a*0.38); }`;

export function Rashivalaya() {
  const months = useApi("/api/months");
  const plaster = useMemo(() => makePlaster({ doubleSided: true }), []);
  const dialMats = useMemo(() => MONTH.map(() => {
    const m = makeMarking(); m.emissiveIntensity = 0; return m;
  }), []);
  const shaftMats = useMemo(() => MONTH.map(() => new THREE.ShaderMaterial({
    vertexShader: shaftVert, fragmentShader: shaftFrag, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uA: { value: 0 }, uT: { value: 0 } },
  })), []);

  const coverage: number[] = months.data?.months.map((m: any) => m.coverage_relative) ?? [];
  const specs = useMemo(() => MONTH.map((_, i) => {
    const h = 4.2 + 1.6 * Math.sin(i * 1.7);
    const tilt = (20 + 22 * ((i * 5) % 12) / 11) * (Math.PI / 180);
    const len = h / Math.tan(tilt);
    return { h, len, yaw: ((i % 2 ? 1 : -1) * (6 + (i * 7) % 18) * Math.PI) / 180, geo: smallGnomon(h, len) };
  }), []);

  // cloud billboards around poorly observed months (count scales with the real coverage deficit)
  const clouds = useMemo(() => {
    if (!coverage.length) return null;
    const offs: number[] = [], seeds: number[] = [];
    coverage.forEach((c, i) => {
      const n = Math.round(Math.pow(1 - c, 2) * 10);
      const [x, , z] = rashiPosition(i);
      for (let k = 0; k < n; k++) {
        offs.push(x + (Math.random() - 0.5) * 8, 3 + Math.random() * 6, z + (Math.random() - 0.5) * 8);
        seeds.push(Math.random());
      }
    });
    const g = new THREE.InstancedBufferGeometry();
    g.copy(new THREE.PlaneGeometry(1, 1) as any);
    g.instanceCount = seeds.length;
    g.setAttribute("aOff", new THREE.InstancedBufferAttribute(new Float32Array(offs), 3));
    g.setAttribute("aSeed", new THREE.InstancedBufferAttribute(new Float32Array(seeds), 1));
    const m = new THREE.ShaderMaterial({ vertexShader: cloudVert, fragmentShader: cloudFrag, transparent: true, depthWrite: false,
      uniforms: { uT: { value: 0 }, uA: { value: 0 }, uCol: { value: new THREE.Color("#d9dde6") } } });
    return { g, m };
  }, [coverage.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const hovered = useWorld((s) => s.hovered === "seasons");
  useFrame(({ clock }, dt) => {
    const st = useWorld.getState();
    const near = Math.max(0, 1 - Math.abs(st.progress * 6 - STAGE_INDEX.seasons) * 1.2);
    MONTH.forEach((_, i) => {
      const c = coverage[i] ?? 0;
      const target = (0.05 + 1.1 * c * c) * (0.3 + 0.7 * near) + (hovered ? 0.25 : 0);
      dialMats[i].emissiveIntensity += (target - dialMats[i].emissiveIntensity) * Math.min(1, dt * 4);
      shaftMats[i].uniforms.uA.value = c * near;
      shaftMats[i].uniforms.uT.value = clock.elapsedTime + i;
    });
    if (clouds) { clouds.m.uniforms.uT.value = clock.elapsedTime; clouds.m.uniforms.uA.value = 0.25 + 0.75 * near; }
  });

  return (
    <group name="instrument:rashivalaya"
      onPointerOver={(e) => { e.stopPropagation(); useWorld.getState().setHovered("seasons"); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { useWorld.getState().setHovered(null); document.body.style.cursor = "auto"; }}
      onClick={(e) => { e.stopPropagation(); goToStage(STAGE_INDEX.seasons); }}
    >
      {specs.map((sp, i) => {
        const [x, , z] = rashiPosition(i);
        const c = coverage[i] ?? 0;
        return (
          <group key={i} position={[x, 0, z]} rotation-y={sp.yaw}>
            <mesh geometry={sp.geo} material={plaster} castShadow receiveShadow />
            {/* plinth */}
            <mesh material={plaster} position={[0, 0.3, 0]} castShadow receiveShadow>
              <boxGeometry args={[5.2, 0.6, sp.len + 1.4]} />
            </mesh>
            {/* two dial faces (lime/marble), glowing with the month's observed coverage */}
            {[-1, 1].map((sx) => (
              <mesh key={sx} material={dialMats[i]} position={[sx * 2.1, 0.62, 0]} rotation-x={-Math.PI / 2} receiveShadow>
                <ringGeometry args={[1.2, 2.4, 40, 1, sx > 0 ? -Math.PI / 2 : Math.PI / 2, Math.PI]} />
              </mesh>
            ))}
            <mesh material={shaftMats[i]} position={[0, 0.7 + (2 + 16 * c) / 2, 0]}>
              <cylinderGeometry args={[1.6, 2.2, 2 + 16 * c, 24, 1, true]} />
            </mesh>
          </group>
        );
      })}
      {clouds && <mesh geometry={clouds.g} material={clouds.m} frustumCulled={false} />}
    </group>
  );
}

export const RASHI_MONTHS = MONTH;
