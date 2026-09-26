"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { celestialDirection, lstFromHourAngle, sunDirection } from "@/lib/astro";
import { frame } from "@/lib/timeline";

// The night sky the astronomers of the Jantar Mantar actually read, drawn on top of the real star
// catalogue: constellation figures under their Indian names (J2000 positions of the real stars),
// occasional meteors, and Sentinel-5P itself crossing on the night side of its sun-synchronous
// orbit (descending node ~01:30 local time; drawn from its orbit, not visible to the eye).

const H = (h: number, m: number, s = 0) => ((h + m / 60 + s / 3600) * 15 * Math.PI) / 180;
const D = (d: number, m: number, s = 0) => ((Math.sign(d || 1) * (Math.abs(d) + m / 60 + s / 3600)) * Math.PI) / 180;

type Fig = { name: string; note: string; stars: [number, number][]; lines: [number, number][]; label: number };
const FIGURES: Fig[] = [
  { // Ursa Major's plough: the seven sages
    name: "Saptarishi", note: "the seven sages",
    stars: [[H(11, 3, 44), D(61, 45)], [H(11, 1, 50), D(56, 23)], [H(11, 53, 50), D(53, 42)], [H(12, 15, 26), D(57, 2)],
      [H(12, 54, 2), D(55, 58)], [H(13, 23, 56), D(54, 56)], [H(13, 47, 32), D(49, 19)]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]], label: 5,
  },
  { name: "Dhruva", note: "the pole star the Samrat Yantra's gnomon points at", stars: [[H(2, 31, 49), D(89, 15, 51)]], lines: [], label: 0 },
  { // Orion: Kalpurusha, with Ardra (Betelgeuse) and the belt
    name: "Kalpurusha", note: "Orion, with Ardra",
    stars: [[H(5, 55, 10), D(7, 24)], [H(5, 25, 8), D(6, 21)], [H(5, 40, 46), D(-1, 57)], [H(5, 36, 13), D(-1, 12)],
      [H(5, 32, 0), D(0, 18) * -1], [H(5, 47, 45), D(-9, 40)], [H(5, 14, 32), D(-8, 12)]],
    lines: [[0, 1], [0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6], [5, 6]], label: 0,
  },
  { // Cassiopeia
    name: "Sharmishtha", note: "Cassiopeia",
    stars: [[H(0, 9, 11), D(59, 9)], [H(0, 40, 30), D(56, 32)], [H(0, 56, 42), D(60, 43)], [H(1, 25, 49), D(60, 14)], [H(1, 54, 24), D(63, 40)]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4]], label: 2,
  },
  { name: "Krittika", note: "the Pleiades cluster", stars: [[H(3, 47, 24), D(24, 7)]], lines: [], label: 0 },
];

const R = 820;
const tmp = new THREE.Vector3(), sun = new THREE.Vector3();

function Figure({ f, mat }: { f: Fig; mat: THREE.LineBasicMaterial }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(Math.max(1, f.lines.length) * 6), 3));
    return g;
  }, [f]);
  const label = useRef<THREE.Group>(null);
  const tag = useRef<HTMLDivElement>(null);
  useFrame(() => {
    const lst = lstFromHourAngle(frame.env.hourAngle);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    f.lines.forEach(([a, b], i) => {
      celestialDirection(f.stars[a][0], f.stars[a][1], lst, tmp).multiplyScalar(R); pos.setXYZ(i * 2, tmp.x, tmp.y, tmp.z);
      celestialDirection(f.stars[b][0], f.stars[b][1], lst, tmp).multiplyScalar(R); pos.setXYZ(i * 2 + 1, tmp.x, tmp.y, tmp.z);
    });
    pos.needsUpdate = true;
    const s = f.stars[f.label];
    celestialDirection(s[0], s[1], lst, tmp);
    label.current?.position.copy(tmp).multiplyScalar(R);
    if (tag.current) tag.current.style.opacity = String(tmp.y > 0.05 ? mat.opacity * 2.2 : 0);
  });
  return (
    <>
      {f.lines.length > 0 && <lineSegments geometry={geo} material={mat} frustumCulled={false} renderOrder={-8} />}
      <group ref={label}>
        <Html center zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
          <div ref={tag} className="whitespace-nowrap text-center transition-opacity duration-700" style={{ opacity: 0, transform: "translateY(-18px)" }}>
            <div className="text-[11px] font-medium tracking-wide text-[#cfe2ff]">{f.name}</div>
            <div className="text-[9.5px] text-[#cfe2ff]/60">{f.note}</div>
          </div>
        </Html>
      </group>
    </>
  );
}

// Meteors: short-lived streaks, a few a minute, only under a dark sky.
const METEORS = 3;
function Meteors({ dark }: { dark: React.MutableRefObject<number> }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const state = useMemo(() => Array.from({ length: METEORS }, () => ({ t: -Math.random() * 12, dur: 0.8, a: new THREE.Vector3(), b: new THREE.Vector3() })), []);
  const geo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: /* glsl */`attribute float aAlpha; varying vec2 vUv; varying float vA; void main(){ vUv=uv; vA=aAlpha; gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);} `,
    fragmentShader: /* glsl */`varying vec2 vUv; varying float vA; void main(){ float head=smoothstep(0.0,1.0,vUv.x); float w=exp(-pow((vUv.y-0.5)*6.0,2.0)); float a=vA*head*head*w; if(a<0.004) discard; gl_FragColor=vec4(vec3(0.85,0.92,1.0)*(1.0+head*2.0),a);} `,
  }), []);
  const alpha = useMemo(() => new THREE.InstancedBufferAttribute(new Float32Array(METEORS), 1), []);
  useMemo(() => geo.setAttribute("aAlpha", alpha), [geo, alpha]);
  const m4 = useMemo(() => new THREE.Matrix4(), []), q = useMemo(() => new THREE.Quaternion(), []);
  const dirV = new THREE.Vector3(), mid = new THREE.Vector3(), up = new THREE.Vector3();
  useFrame(({ camera }, dt) => {
    const d = dark.current;
    state.forEach((s, i) => {
      s.t += dt;
      if (s.t > s.dur) {
        if (d > 0.5 && Math.random() < dt * 0.12) {
          const az = Math.random() * Math.PI * 2, alt = 0.35 + Math.random() * 0.7;
          s.a.set(Math.cos(alt) * Math.sin(az), Math.sin(alt), Math.cos(alt) * Math.cos(az)).multiplyScalar(700);
          const dAz = (Math.random() - 0.5) * 0.5, dAlt = -0.12 - Math.random() * 0.18;
          s.b.set(Math.cos(alt + dAlt) * Math.sin(az + dAz), Math.sin(alt + dAlt), Math.cos(alt + dAlt) * Math.cos(az + dAz)).multiplyScalar(700);
          s.t = 0; s.dur = 0.5 + Math.random() * 0.7;
        } else { alpha.setX(i, 0); return; }
      }
      const k = s.t / s.dur;
      const env = Math.sin(Math.PI * Math.min(1, k)) * d;
      mid.copy(s.a).lerp(s.b, k * 0.8);
      dirV.copy(s.b).sub(s.a);
      const len = dirV.length() * 0.35;
      dirV.normalize();
      up.copy(mid).normalize();
      const side = new THREE.Vector3().crossVectors(up, dirV).normalize();
      const zAxis = new THREE.Vector3().crossVectors(dirV, side);
      m4.makeBasis(dirV, side, zAxis);
      q.setFromRotationMatrix(m4);
      m4.compose(mid.clone().add(camera.position), q, new THREE.Vector3(len, 2.2, 1));
      mesh.current!.setMatrixAt(i, m4);
      alpha.setX(i, env);
    });
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
    alpha.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[geo, mat, METEORS]} frustumCulled={false} renderOrder={-7} />;
}

// Sentinel-5P on its descending night-side leg: near-polar (inclination 98.7 deg), north to south,
// about 7 degrees of sky a second as seen from the ground would be too fast to read; slowed 20x.
function Satellite({ dark }: { dark: React.MutableRefObject<number> }) {
  const g = useRef<THREE.Group>(null);
  const tag = useRef<HTMLDivElement>(null);
  const dot = useRef<THREE.Mesh>(null);
  useFrame(({ clock, camera }) => {
    const T = 46, t = (clock.elapsedTime % T) / T;                // one crossing every 46 s
    const alt = Math.sin(Math.PI * t) * 1.15 + 0.05;                // rises in the north, sets in the south
    const az = Math.PI - 0.22 + t * 0.05;                            // near-meridian, slight westward tilt (98.7 deg)
    const n = t < 0.5 ? 1 : -1;
    tmp.set(Math.cos(alt) * Math.sin(az) * 0.2, Math.sin(alt), -n * Math.cos(alt));
    tmp.normalize().multiplyScalar(760);
    g.current?.position.copy(tmp).add(camera.position);
    const vis = dark.current * Math.min(1, Math.sin(Math.PI * t) * 3);
    if (dot.current) (dot.current.material as THREE.MeshBasicMaterial).opacity = vis;
    if (tag.current) tag.current.style.opacity = String(vis * 0.85);
  });
  return (
    <group ref={g}>
      <mesh ref={dot} renderOrder={-6}>
        <sphereGeometry args={[1.4, 8, 8]} />
        <meshBasicMaterial color="#bfe0ff" transparent depthWrite={false} fog={false} toneMapped={false} />
      </mesh>
      <Html center zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
        <div ref={tag} className="whitespace-nowrap" style={{ opacity: 0, transform: "translate(52px, 0)" }}>
          <div className="text-[11px] font-medium text-[#8fc2ff]">Sentinel-5P</div>
          <div className="text-[9.5px] text-[#cfe2ff]/60">night-side pass · reads India at 13:30</div>
        </div>
      </Html>
    </group>
  );
}

// Glows: Dhruva as the hero star (four-point diffraction flare, as a lens records it) and Krittika's
// blue reflection nebulosity around its real stars. Canvas textures, generated once.
function glowTexture(kind: "star" | "nebula") {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const rg = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  if (kind === "star") {
    rg.addColorStop(0, "rgba(255,255,255,1)"); rg.addColorStop(0.08, "rgba(220,235,255,0.9)");
    rg.addColorStop(0.25, "rgba(150,190,255,0.22)"); rg.addColorStop(1, "rgba(120,160,255,0)");
    g.fillStyle = rg; g.fillRect(0, 0, 256, 256);
    g.globalCompositeOperation = "lighter";
    for (const [w, h] of [[256, 3], [3, 256]]) {
      const lg = g.createLinearGradient(128 - w / 2, 128 - h / 2, 128 + w / 2, 128 + h / 2);
      lg.addColorStop(0, "rgba(200,225,255,0)"); lg.addColorStop(0.5, "rgba(230,240,255,0.85)"); lg.addColorStop(1, "rgba(200,225,255,0)");
      g.fillStyle = lg; g.fillRect(128 - w / 2, 128 - h / 2, w, h);
    }
  } else {
    rg.addColorStop(0, "rgba(140,200,255,0.55)"); rg.addColorStop(0.35, "rgba(80,170,210,0.25)");
    rg.addColorStop(0.7, "rgba(90,80,200,0.08)"); rg.addColorStop(1, "rgba(60,60,160,0)");
    g.fillStyle = rg; g.fillRect(0, 0, 256, 256);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const PLEIADES: [number, number, number][] = [   // RA, Dec, relative brightness (Alcyone brightest)
  [H(3, 47, 29), D(24, 6, 18), 1], [H(3, 49, 9), D(24, 3, 12), 0.7], [H(3, 44, 52), D(24, 6, 48), 0.65],
  [H(3, 45, 49), D(24, 22, 4), 0.55], [H(3, 49, 11), D(24, 8, 12), 0.45], [H(3, 44, 35), D(24, 33, 17), 0.45], [H(3, 46, 19), D(23, 56, 54), 0.4],
];
const POLARIS: [number, number] = [H(2, 31, 49), D(89, 15, 51)];

function Glows({ dark }: { dark: React.MutableRefObject<number> }) {
  const { star, neb } = useMemo(() => ({ star: glowTexture("star"), neb: glowTexture("nebula") }), []);
  const mk = (map: THREE.Texture) => new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false });
  const polaris = useRef<THREE.Sprite>(null), nebula = useRef<THREE.Sprite>(null);
  const cluster = useRef<(THREE.Sprite | null)[]>([]);
  const mats = useMemo(() => ({ p: mk(star), n: mk(neb), c: PLEIADES.map(() => mk(star)) }), [star, neb]);
  useFrame(() => {
    const lst = lstFromHourAngle(frame.env.hourAngle), d = dark.current;
    celestialDirection(POLARIS[0], POLARIS[1], lst, tmp);
    polaris.current?.position.copy(tmp).multiplyScalar(R * 0.98);
    mats.p.opacity = d * 0.95;
    PLEIADES.forEach(([ra, dec, b], i) => {
      celestialDirection(ra, dec, lst, tmp);
      cluster.current[i]?.position.copy(tmp).multiplyScalar(R * 0.98);
      mats.c[i].opacity = d * (0.55 + 0.45 * b) * (tmp.y > 0 ? 1 : 0);
    });
    celestialDirection(PLEIADES[0][0], PLEIADES[0][1], lst, tmp);
    nebula.current?.position.copy(tmp).multiplyScalar(R * 0.985);
    mats.n.opacity = d * 0.9 * (tmp.y > 0 ? 1 : 0);
  });
  return (
    <>
      <sprite ref={polaris} material={mats.p} scale={[46, 46, 1]} renderOrder={-7} />
      <sprite ref={nebula} material={mats.n} scale={[70, 70, 1]} renderOrder={-8} />
      {PLEIADES.map(([, , b], i) => (
        <sprite key={i} ref={(el) => { cluster.current[i] = el; }} material={mats.c[i]} scale={[10 + 12 * b, 10 + 12 * b, 1]} renderOrder={-7} />
      ))}
    </>
  );
}

export function SkyLore() {
  const root = useRef<THREE.Group>(null);
  const dark = useRef(0);
  const mat = useMemo(() => new THREE.LineBasicMaterial({ color: "#9cc4ff", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), []);
  useFrame(({ camera }) => {
    const e = frame.env;
    const sunY = sunDirection(e.hourAngle, sun).y;
    dark.current = e.stars * (1 - THREE.MathUtils.smoothstep(sunY, -0.28, -0.05)) * (1 - 0.9 * e.cloud) * (1 - frame.flight * 0.6);
    mat.opacity = 0.22 * dark.current;
    root.current?.position.copy(camera.position);
  });
  return (
    <>
      <group ref={root}>
        {FIGURES.map((f) => <Figure key={f.name} f={f} mat={mat} />)}
        <Glows dark={dark} />
      </group>
      <Meteors dark={dark} />
      <Satellite dark={dark} />
    </>
  );
}
