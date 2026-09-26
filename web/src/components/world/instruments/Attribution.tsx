"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { goToStage, useWorld } from "@/lib/store";
import { STAGE_INDEX } from "@/content/stages";
import { useApi } from "@/lib/useData";
import { makeMarking, makePlaster } from "../materials/plaster";

// Digamsha Yantra (azimuth instrument: central pillar inside two concentric walls) carries the
// wind-rotation step. Ten REAL Jawaharnagar overpasses (exported from the TROPOMI record with their
// real ECMWF winds) hover as sheets in their observed north-up frame; as the stage is reached each
// turns by its own wind direction and they settle onto the real R3 stack, whose plume points
// downwind (+x). Rama Yantra beside it shows the continuity equation as flow through a column.

export const DIG = { x: -50, z: 62 };
export const RAMA = { x: -78, z: 50, r: 7, h: 5 };
const SHEET = 9; // metres per 100 km tile

const sheetFrag = `varying vec2 vUv; uniform sampler2D uTex; uniform float uTile, uTiles, uA, uStack;
  vec3 ramp(float s){ // diverging: sink = dim slate, source = flame blue
    return s > 0.0 ? mix(vec3(0.04,0.07,0.14), vec3(0.4,0.72,1.0), pow(s,1.3)) : mix(vec3(0.10,0.14,0.22), vec3(0.18,0.11,0.12), pow(-s,0.8)); }
  void main(){
    vec2 uv = uStack > 0.5 ? vUv : vec2((uTile + vUv.x)/uTiles, vUv.y);
    float raw = texture2D(uTex, uv).r*255.0;
    if (raw < 0.5) discard;
    float s = (raw-128.0)/127.0;
    vec2 c = vUv-0.5; float edge = smoothstep(0.5,0.44,max(abs(c.x),abs(c.y)));
    gl_FragColor = vec4(ramp(s), (0.18 + 0.6*abs(s)) * edge * uA);
  }`;
const sheetVert = "varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}";

function Digamsha() {
  const meta = useApi("/data/stacks/jawaharnagar_overpasses.json");
  const stacks = useApi("/data/stacks/stacks.json");
  const plaster = useMemo(() => makePlaster({ doubleSided: true }), []);
  const lime = useMemo(() => makeMarking(), []);
  const n = meta.data?.tiles ?? 0;
  const mats = useMemo(() => Array.from({ length: n }, (_, i) => new THREE.ShaderMaterial({
    vertexShader: sheetVert, fragmentShader: sheetFrag, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    uniforms: { uTex: { value: null }, uTile: { value: i }, uTiles: { value: n }, uA: { value: 0.8 }, uStack: { value: 0 } },
  })), [n]);
  const stackMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: sheetVert, fragmentShader: sheetFrag, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTex: { value: null }, uTile: { value: 0 }, uTiles: { value: 1 }, uA: { value: 0 }, uStack: { value: 1 } },
  }), []);

  useEffect(() => {
    if (!n) return;
    new THREE.TextureLoader().load("/data/stacks/jawaharnagar_overpasses.png", (t) => {
      t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.NearestFilter; t.magFilter = THREE.LinearFilter;
      mats.forEach((m) => (m.uniforms.uTex.value = t));
    });
  }, [n, mats]);
  useEffect(() => {
    if (!stacks.data?.jawaharnagar) return;
    new THREE.TextureLoader().load(stacks.data.jawaharnagar.file, (t) => {
      t.colorSpace = THREE.NoColorSpace; stackMat.uniforms.uTex.value = t;
    });
  }, [stacks.data, stackMat]);

  const refs = useMemo(() => Array.from({ length: n }, () => new THREE.Group()), [n]);
  useFrame(({ clock }) => {
    const st = useWorld.getState();
    const near = Math.max(0, 1 - Math.abs(st.progress * 6 - STAGE_INDEX.attribution) * 1.2);
    const align = THREE.MathUtils.smoothstep(near, 0.35, 1.0);
    refs.forEach((g, i) => {
      const op = meta.data.overpasses[i];
      // math angle of the wind (from +x toward -z = north in scene); rotate so wind -> +x
      const windAng = Math.atan2(op.v10, op.u10);
      g.rotation.set(-Math.PI / 2, 0, align * -windAng);
      g.position.set(DIG.x, 4.2 + i * 0.55 * (1 - align) + Math.sin(clock.elapsedTime * 0.6 + i) * 0.08 * (1 - align), DIG.z);
      mats[i].uniforms.uA.value = (0.25 + 0.55 * near) * (1 - 0.6 * align);
    });
    stackMat.uniforms.uA.value = align * 0.9;
    lime.emissiveIntensity = st.hovered === "attribution" ? 0.8 : 0;
  });

  // stack plane is in the wind frame already (+x downwind); its extent is -50..90 km x -50..50 km
  const sx = stacks.data?.jawaharnagar ? (stacks.data.jawaharnagar.x_km[1] - stacks.data.jawaharnagar.x_km[0]) / 100 * SHEET : SHEET;
  const sy = stacks.data?.jawaharnagar ? (stacks.data.jawaharnagar.y_km[1] - stacks.data.jawaharnagar.y_km[0]) / 100 * SHEET : SHEET;
  const cx = stacks.data?.jawaharnagar ? ((stacks.data.jawaharnagar.x_km[0] + stacks.data.jawaharnagar.x_km[1]) / 2) / 100 * SHEET : 0;
  return (
    <group name="instrument:digamsha">
      <mesh position={[DIG.x, 2, DIG.z]} material={plaster} castShadow receiveShadow>
        <cylinderGeometry args={[0.9, 1.0, 4, 24]} />
      </mesh>
      {[[4, 2.4], [7, 1.4]].map(([r, h]) => (
        <group key={r}>
          <mesh position={[DIG.x, h / 2, DIG.z]} material={plaster} castShadow receiveShadow>
            <cylinderGeometry args={[r + 0.3, r + 0.3, h, 64, 1, true]} />
          </mesh>
          <mesh position={[DIG.x, h / 2, DIG.z]} material={plaster} receiveShadow>
            <cylinderGeometry args={[r - 0.3, r - 0.3, h, 64, 1, true]} />
          </mesh>
          <mesh position={[DIG.x, h + 0.01, DIG.z]} rotation-x={-Math.PI / 2} material={lime}>
            <ringGeometry args={[r - 0.3, r + 0.3, 64]} />
          </mesh>
        </group>
      ))}
      {n > 0 && refs.map((g, i) => (
        <primitive key={i} object={g}>
          <mesh material={mats[i]}><planeGeometry args={[SHEET, SHEET]} /></mesh>
        </primitive>
      ))}
      <mesh position={[DIG.x + cx, 4.25, DIG.z]} rotation-x={-Math.PI / 2} material={stackMat}>
        <planeGeometry args={[sx, sy]} />
      </mesh>
    </group>
  );
}

function Rama() {
  const plaster = useMemo(() => makePlaster({ doubleSided: true }), []);
  const lime = useMemo(() => makeMarking(), []);
  const N = 14, PARTS = 420;
  // particles stream along +x through the column; inside it the flow gains mass (more, brighter
  // particles leave than enter): div(F) = Q, drawn as a diagram of the equation, not as data.
  const { geo, mat } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const seed = new Float32Array(PARTS * 3);
    for (let i = 0; i < PARTS; i++) { seed[i * 3] = Math.random(); seed[i * 3 + 1] = Math.random(); seed[i * 3 + 2] = Math.random(); }
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(PARTS * 3), 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 3));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      uniforms: { uT: { value: 0 }, uA: { value: 0 }, uR: { value: RAMA.r } },
      vertexShader: `attribute vec3 aSeed; uniform float uT, uR; varying float vB;
        void main(){ float x = mod(aSeed.x*40.0 + uT*(2.0+aSeed.z), 40.0) - 20.0;
          float inside = step(abs(x), uR);
          float born = step(-uR + aSeed.y*2.0*uR, x);           // particles born inside the column
          float isSource = step(0.62, aSeed.z);
          float visible = mix(1.0, born*step(-uR, x), isSource);
          vB = visible * (0.35 + 0.65*isSource*step(-uR, x));
          vec3 p = vec3(x, 0.6 + aSeed.y*(4.0), (aSeed.z-0.5)*uR*1.6);
          vec4 mv = modelViewMatrix*vec4(p,1.0); gl_PointSize = 26.0/-mv.z*(1.0+isSource); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `varying float vB; uniform float uA; void main(){ vec2 c=gl_PointCoord-0.5; float a=exp(-dot(c,c)*18.0)*vB*uA; if(a<0.01) discard; gl_FragColor=vec4(0.55,0.8,1.0,a); }`,
    });
    return { geo: g, mat: m };
  }, []);
  useFrame(({ clock }) => {
    const st = useWorld.getState();
    const near = Math.max(0, 1 - Math.abs(st.progress * 6 - STAGE_INDEX.attribution) * 1.2);
    mat.uniforms.uT.value = clock.elapsedTime; mat.uniforms.uA.value = near;
  });
  return (
    <group name="instrument:rama" position={[RAMA.x, 0, RAMA.z]}>
      {Array.from({ length: N }, (_, i) => {
        const a = (i / N) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * RAMA.r, RAMA.h / 2, Math.sin(a) * RAMA.r]} rotation-y={-a} material={plaster} castShadow receiveShadow>
            <boxGeometry args={[1.0, RAMA.h, (2 * Math.PI * RAMA.r) / N - 1.3]} />
          </mesh>
        );
      })}
      <mesh position={[0, RAMA.h + 0.1, 0]} rotation-x={-Math.PI / 2} material={lime}>
        <ringGeometry args={[RAMA.r - 0.5, RAMA.r + 0.5, 64]} />
      </mesh>
      <mesh position={[0, 1.2, 0]} material={plaster} castShadow receiveShadow>
        <cylinderGeometry args={[0.7, 0.8, 2.4, 20]} />
      </mesh>
      <mesh position={[0, 0.05, 0]} rotation-x={-Math.PI / 2} material={lime} receiveShadow>
        <ringGeometry args={[1.0, RAMA.r - 0.5, 64]} />
      </mesh>
      <points geometry={geo} material={mat} frustumCulled={false} />
    </group>
  );
}

export function Attribution() {
  return (
    <group
      onPointerOver={(e) => { e.stopPropagation(); useWorld.getState().setHovered("attribution"); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { useWorld.getState().setHovered(null); document.body.style.cursor = "auto"; }}
      onClick={(e) => { e.stopPropagation(); goToStage(STAGE_INDEX.attribution); }}
    >
      <Digamsha />
      <Rama />
    </group>
  );
}
