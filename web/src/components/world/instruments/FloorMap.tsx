"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useWorld } from "@/lib/store";
import { STAGE_INDEX } from "@/content/stages";
import { useApi } from "@/lib/useData";
import { makeMarking } from "../materials/plaster";

// The courtyard floor carries an inlaid map of India (Natural Earth, India POV boundary). When the
// 13:30 pass happens, Sentinel-5P's pushbroom scan line sweeps north across it and reveals the
// real 2023-2024 mean XCH4 field (9.6 M pixels, /api/maps -> xch4_mean.png).

export const MAP = { cx: 0, cz: -110, scale: 4, lon0: 82.5, lat0: 22, cosLat: Math.cos((22 * Math.PI) / 180) };
export const lonLatToXZ = (lon: number, lat: number): [number, number] => [
  MAP.cx + (lon - MAP.lon0) * MAP.scale * MAP.cosLat,
  MAP.cz - (lat - MAP.lat0) * MAP.scale,
];
export const SWEEP = { from: -38, to: -186, seconds: 9 };

// shared scan state (0..1), advanced once the 13:30 stage has been reached
export const scan = { t: 0 };

function outlineGeometries(polys: number[][][]) {
  const shapes = polys.map((poly) => {
    const s = new THREE.Shape();
    poly.forEach(([lon, lat], i) => {
      const [x, z] = lonLatToXZ(lon, lat);
      if (i === 0) s.moveTo(x, -z); else s.lineTo(x, -z);   // shape in (x, -z)
    });
    return s;
  });
  const fill = new THREE.ShapeGeometry(shapes, 1);
  fill.rotateX(-Math.PI / 2);                                // (x, -z) -> (x, 0, z)
  // lime-white border ribbon
  const pos: number[] = [], idx: number[] = [];
  const w = 0.28;
  polys.forEach((poly) => {
    for (let i = 0; i < poly.length - 1; i++) {
      const [x0, z0] = lonLatToXZ(poly[i][0], poly[i][1]);
      const [x1, z1] = lonLatToXZ(poly[i + 1][0], poly[i + 1][1]);
      const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz) || 1;
      const nx = (-dz / L) * w, nz = (dx / L) * w, b = pos.length / 3;
      pos.push(x0 - nx, 0, z0 - nz, x0 + nx, 0, z0 + nz, x1 - nx, 0, z1 - nz, x1 + nx, 0, z1 + nz);
      idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    }
  });
  const border = new THREE.BufferGeometry();
  border.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  border.setIndex(idx);
  border.computeVertexNormals();
  return { fill, border };
}

export function FloorMap() {
  const [polys, setPolys] = useState<number[][][] | null>(null);
  const maps = useApi("/api/maps");
  useEffect(() => {
    fetch("/data/india-outline.json").then((r) => r.json()).then((d) => setPolys(d.polygons));
  }, []);
  const geo = useMemo(() => (polys ? outlineGeometries(polys) : null), [polys]);
  const lime = useMemo(() => makeMarking(), []);

  const uniforms = useMemo(() => ({
    uData: { value: null as THREE.Texture | null },
    uHas: { value: 0 },
    uSweepZ: { value: SWEEP.from },
    uLonLat: { value: new THREE.Vector4(68, 97.5, 6.5, 37.5) },
    uMap: { value: new THREE.Vector4(MAP.cx, MAP.cz, MAP.scale * MAP.cosLat, MAP.scale) },
    uLon0Lat0: { value: new THREE.Vector2(MAP.lon0, MAP.lat0) },
    uTime: { value: 0 },
  }), []);

  useEffect(() => {
    const m = maps.data?.xch4_mean;
    if (!m) return;
    new THREE.TextureLoader().load(m.file, (t) => {
      t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter;
      uniforms.uData.value = t; uniforms.uHas.value = 1;
      const [la0, la1] = maps.data.lat_edges, [lo0, lo1] = maps.data.lon_edges;
      uniforms.uLonLat.value.set(lo0, lo1, la0, la1);
    });
  }, [maps.data, uniforms]);

  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: "#2a2724", roughness: 0.38, metalness: 0.05 }); // dark polished inlay
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uniforms);
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vW;")
        .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvW = (modelMatrix*vec4(transformed,1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", `#include <common>
          varying vec3 vW; uniform sampler2D uData; uniform float uHas, uSweepZ, uTime;
          uniform vec4 uLonLat, uMap; uniform vec2 uLon0Lat0;
          vec3 flame(float v){
            vec3 a = vec3(0.07,0.13,0.32), b = vec3(0.18,0.44,0.82), c = vec3(0.44,0.71,1.0), d = vec3(0.92,0.97,1.0);
            return v < 0.5 ? mix(a, b, v*2.0) : (v < 0.85 ? mix(b, c, (v-0.5)/0.35) : mix(c, d, (v-0.85)/0.15));
          }`)
        .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
          {
            float lon = uLon0Lat0.x + (vW.x - uMap.x) / uMap.z;
            float lat = uLon0Lat0.y - (vW.z - uMap.y) / uMap.w;
            vec2 uv = vec2((lon - uLonLat.x)/(uLonLat.y-uLonLat.x), (lat - uLonLat.z)/(uLonLat.w-uLonLat.z));
            float raw = texture2D(uData, uv).r * 255.0;
            float has = step(0.5, raw) * uHas;
            float v = clamp((raw - 1.0) / 254.0, 0.0, 1.0);
            float revealed = smoothstep(uSweepZ - 0.5, uSweepZ + 2.5, vW.z);
            float line = exp(-pow((vW.z - uSweepZ)/1.2, 2.0));
            float vv = smoothstep(0.38, 1.0, v);                      // restraint: only the upper part of the field glows
            vec3 data = flame(vv) * (0.04 + 0.55*vv*vv + 1.6*pow(vv, 6.0)) * has * revealed;
            diffuseColor.rgb = mix(diffuseColor.rgb, flame(vv)*0.18, has*revealed*0.6);
            totalEmissiveRadiance += data + vec3(0.55,0.8,1.0) * line * 2.2 * step(uSweepZ, -40.0) * step(-184.0, uSweepZ);
          }`);
    };
    return m;
  }, [uniforms]);

  useFrame(({ clock }, dt) => {
    const st = useWorld.getState().stageIndex;
    if (st >= STAGE_INDEX.ingest) scan.t = Math.min(1, scan.t + dt / SWEEP.seconds);
    else scan.t = 0;
    const e = scan.t < 1 ? 1 - Math.pow(1 - scan.t, 2) : 1;
    uniforms.uSweepZ.value = SWEEP.from + (SWEEP.to - SWEEP.from) * e;
    uniforms.uTime.value = clock.elapsedTime;
  });

  if (!geo) return null;
  return (
    <group name="floor-map">
      <mesh geometry={geo.fill} material={mat} position-y={0.04} receiveShadow />
      <mesh geometry={geo.border} material={lime} position-y={0.06} receiveShadow />
    </group>
  );
}

// Sentinel-5P: a bright moving point on its real ascending ground track (heading ~NNW), and the
// pushbroom scan line as a thin vertical light sheet dropping to the ground at the sweep position.
export function Satellite() {
  const sat = useRef<THREE.Mesh>(null);
  const curtain = useRef<THREE.Mesh>(null);
  const curtainMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uA: { value: 0 } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
    fragmentShader: `varying vec2 vUv; uniform float uA;
      void main(){
        float edge = smoothstep(0.0,0.12,vUv.x)*smoothstep(1.0,0.88,vUv.x);
        float fall = pow(1.0 - vUv.y, 2.5);
        gl_FragColor = vec4(vec3(0.5,0.78,1.0), fall*edge*0.35*uA);
      }`,
  }), []);

  useFrame(({ clock }) => {
    const e = scan.t < 1 ? 1 - Math.pow(1 - scan.t, 2) : 1;
    const z = SWEEP.from + (SWEEP.to - SWEEP.from) * e;
    const active = scan.t > 0 && scan.t < 1;
    if (sat.current) {
      sat.current.position.set(-12 + (z - SWEEP.from) * 0.18, 260, z - 40);
      sat.current.visible = scan.t > 0 && scan.t < 1;
      (sat.current.material as THREE.MeshBasicMaterial).opacity = 0.7 + 0.3 * Math.sin(clock.elapsedTime * 9);
    }
    if (curtain.current) {
      curtain.current.position.set(0, 60, z);
      (curtain.current.material as THREE.ShaderMaterial).uniforms.uA.value = active ? Math.sin(Math.PI * scan.t) : 0;
    }
  });

  return (
    <group name="sentinel-5p">
      <mesh ref={sat}>
        <sphereGeometry args={[0.9, 12, 8]} />
        <meshBasicMaterial color="#e8f4ff" transparent toneMapped={false} fog={false} />
      </mesh>
      <mesh ref={curtain} material={curtainMat}>
        <planeGeometry args={[220, 120]} />
      </mesh>
    </group>
  );
}
