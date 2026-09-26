"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { goToStage, useWorld } from "@/lib/store";
import { STAGE_INDEX } from "@/content/stages";
import { frame } from "@/lib/timeline";
import { useApi } from "@/lib/useData";
import { makeMarking, makePlaster } from "../materials/plaster";

// Return to the ground: a stone lectern with the open ledger, brass oil lamps, and a wall of
// tablets, one per in-India screening candidate (/api/candidates), those near known sites lit.
// Night lamps (diyas) line the processional paths; all flames flicker from one noise clock.

export const LEDGER = { x: 26, z: 62 };

const flameVert = `attribute vec3 aOff; attribute float aSeed; uniform float uT, uS; varying vec2 vUv; varying float vS;
  void main(){ vUv=uv; vS=aSeed; float f = 0.85 + 0.15*sin(uT*13.0+aSeed*40.0) + 0.08*sin(uT*29.0+aSeed*17.0);
    vec4 mv = modelViewMatrix*vec4(aOff,1.0); mv.xy += position.xy*vec2(0.55,1.0)*uS*f; gl_Position=projectionMatrix*mv; }`;
const flameFrag = `varying vec2 vUv; varying float vS; uniform float uA;
  void main(){ vec2 c = vUv-vec2(0.5,0.3); c.x *= 1.0 + c.y*1.4;
    float core = exp(-dot(c*vec2(4.0,2.4),c*vec2(4.0,2.4))*3.0);
    float glow = exp(-dot(c,c)*9.0)*0.35;
    vec3 col = mix(vec3(1.0,0.45,0.1), vec3(1.0,0.93,0.72), core);
    gl_FragColor = vec4(col*(core*2.2+glow), (core+glow)*uA); }`;

function Flames({ points, size }: { points: [number, number, number][]; size: number }) {
  const { g, m } = useMemo(() => {
    const g = new THREE.InstancedBufferGeometry();
    g.copy(new THREE.PlaneGeometry(1, 1) as any);
    g.instanceCount = points.length;
    g.setAttribute("aOff", new THREE.InstancedBufferAttribute(new Float32Array(points.flat()), 3));
    g.setAttribute("aSeed", new THREE.InstancedBufferAttribute(new Float32Array(points.map(() => Math.random())), 1));
    const m = new THREE.ShaderMaterial({ vertexShader: flameVert, fragmentShader: flameFrag, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: false, uniforms: { uT: { value: 0 }, uA: { value: 1 }, uS: { value: size } } });
    return { g, m };
  }, [points, size]);
  useFrame(({ clock }) => { m.uniforms.uT.value = clock.elapsedTime; m.uniforms.uA.value = frame.env.lamps; });
  return <mesh geometry={g} material={m} frustumCulled={false} />;
}

function PathLamps() {
  // diyas every ~6 m along the processional routes the camera actually travels
  const pts = useMemo(() => {
    const out: [number, number, number][] = [];
    const seg = (a: [number, number], b: [number, number]) => {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const n = Math.floor(L / 6);
      for (let i = 0; i <= n; i++) {
        const t = i / n; const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
        const nx = -(b[1] - a[1]) / L, nz = (b[0] - a[0]) / L;
        out.push([x + nx * 3.6, 0.22, z + nz * 3.6], [x - nx * 3.6, 0.22, z - nz * 3.6]);
      }
    };
    seg([0, 30], [0, 88]); seg([6, 62], [22, 62]); seg([-10, 62], [-38, 62]); seg([-40, 34], [-44, 56]);
    // lamps climbing both parapets of the Samrat Yantra stair (27 deg hypotenuse, 53 m base)
    for (let k = 1; k < 16; k++) {
      const t = k / 16, y = 27 * t, zz = 26.5 - 53 * t;
      out.push([-1.55, y + 1.02, zz], [1.55, y + 1.02, zz]);
    }
    return out;
  }, []);
  return <Flames points={pts} size={0.28} />;
}

export function Ledger() {
  const cands = useApi("/api/candidates");
  const stone = useMemo(() => makePlaster({ base: "#9c6a5a", shade: "#5e3a31", bleach: "#c49887", grime: 0.4, scale: 0.9, bump: 0.12 }), []);
  const lime = useMemo(() => makeMarking(), []);
  const page = useMemo(() => new THREE.MeshStandardMaterial({ color: "#efe3c8", roughness: 0.85, side: THREE.DoubleSide }), []);
  const ink = useMemo(() => new THREE.MeshBasicMaterial({ color: "#3b2a22" }), []);
  const brass = useMemo(() => new THREE.MeshStandardMaterial({ color: "#b08a4a", metalness: 0.9, roughness: 0.35 }), []);
  const lampA = useRef<THREE.PointLight>(null), lampB = useRef<THREE.PointLight>(null);

  const list: any[] = cands.data?.candidates ?? [];
  const tabletMats = useMemo(() => list.map(() => { const m = makeMarking(); m.color.set("#d9cdb8"); return m; }), [list.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(({ clock }) => {
    const t = clock.elapsedTime, l = frame.env.lamps;
    const f = (s: number) => l * (1.0 + 0.18 * Math.sin(t * 11 + s) + 0.1 * Math.sin(t * 23.7 + s * 2));
    if (lampA.current) lampA.current.intensity = 9 * f(0);
    if (lampB.current) lampB.current.intensity = 9 * f(3);
    const near = Math.max(0, 1 - Math.abs(useWorld.getState().progress * 6 - STAGE_INDEX.ledger) * 1.2);
    tabletMats.forEach((m, i) => { m.emissiveIntensity = near * (list[i]?.known_site_match ? 1.0 : 0.12); });
  });

  const lamp = (x: number) => (
    <group position={[LEDGER.x + x, 0, LEDGER.z]}>
      <mesh material={brass} position={[0, 0.55, 0]} castShadow><cylinderGeometry args={[0.05, 0.12, 1.1, 12]} /></mesh>
      <mesh material={brass} position={[0, 1.12, 0]}><cylinderGeometry args={[0.16, 0.08, 0.08, 16]} /></mesh>
    </group>
  );

  return (
    <group name="instrument:ledger"
      onPointerOver={(e) => { e.stopPropagation(); useWorld.getState().setHovered("ledger"); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { useWorld.getState().setHovered(null); document.body.style.cursor = "auto"; }}
      onClick={(e) => { e.stopPropagation(); goToStage(STAGE_INDEX.ledger); }}
    >
      {/* sculpted lectern: plinth, tapered pedestal, slanted reading top */}
      <mesh material={stone} position={[LEDGER.x, 0.12, LEDGER.z]} castShadow receiveShadow><boxGeometry args={[1.9, 0.24, 1.4]} /></mesh>
      <mesh material={stone} position={[LEDGER.x, 0.58, LEDGER.z]} castShadow receiveShadow><cylinderGeometry args={[0.32, 0.46, 0.7, 6]} /></mesh>
      <mesh material={stone} position={[LEDGER.x, 0.98, LEDGER.z]} rotation-x={0.32} castShadow receiveShadow><boxGeometry args={[1.5, 0.1, 1.05]} /></mesh>
      <mesh material={lime} position={[LEDGER.x, 1.035, LEDGER.z - 0.02]} rotation-x={0.32}><boxGeometry args={[1.54, 0.012, 1.09]} /></mesh>
      {/* open ledger: two pages bowed toward the spine, ruled entries in iron-gall ink */}
      {[-1, 1].map((sd) => (
        <group key={sd} position={[LEDGER.x + sd * 0.36, 1.07, LEDGER.z]} rotation={[0.32, 0, sd * -0.07]}>
          <mesh material={page} castShadow receiveShadow><boxGeometry args={[0.68, 0.014, 0.9]} /></mesh>
          {Array.from({ length: 13 }, (_, k) => (
            <mesh key={k} material={ink} position={[-0.02 * sd, 0.009, -0.36 + k * 0.06]}>
              <boxGeometry args={[0.52 * (0.55 + ((k * 37 + (sd + 1) * 11) % 10) / 22), 0.001, 0.007]} />
            </mesh>
          ))}
        </group>
      ))}
      {lamp(-1.15)}{lamp(1.15)}
      <Flames points={[[LEDGER.x - 1.15, 1.28, LEDGER.z], [LEDGER.x + 1.15, 1.28, LEDGER.z]]} size={0.34} />
      <pointLight ref={lampA} position={[LEDGER.x - 1.15, 1.4, LEDGER.z]} color="#ff9a4a" distance={18} decay={2} castShadow={false} />
      <pointLight ref={lampB} position={[LEDGER.x + 1.15, 1.4, LEDGER.z]} color="#ff9a4a" distance={18} decay={2} />
      {/* an arc of standing steles behind the reader, one per in-India candidate, ranked */}
      {list.map((c, i) => {
        const n = Math.max(1, list.length - 1);
        const a = Math.PI * (0.18 + 0.64 * (i / n));          // arc behind (north of) the lectern
        const R = 6.2 + (i % 2) * 0.9;
        const x = LEDGER.x - Math.cos(a) * R, z = LEDGER.z - Math.sin(a) * R;
        const h = 1.7 + Math.min(1.3, (c.z - 3) * 0.28);        // taller for stronger detections
        return (
          <group key={i} position={[x, 0, z]} rotation-y={Math.PI / 2 - a}>
            <mesh material={stone} position={[0, h / 2, 0]} castShadow receiveShadow><boxGeometry args={[0.72, h, 0.22]} /></mesh>
            <mesh material={stone} position={[0, h + 0.1, 0]} castShadow><boxGeometry args={[0.82, 0.2, 0.28]} /></mesh>
            {Array.from({ length: 5 }, (_, k) => (
              <mesh key={k} material={tabletMats[i]} position={[0, h - 0.35 - k * 0.2, 0.115]}>
                <boxGeometry args={[0.46 - (k % 2) * 0.12, 0.035, 0.01]} />
              </mesh>
            ))}
          </group>
        );
      })}
      <PathLamps />
    </group>
  );
}
