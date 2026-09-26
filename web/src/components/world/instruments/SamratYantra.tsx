"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { goToStage, useWorld } from "@/lib/store";
import { STAGE_INDEX } from "@/content/stages";
import { arcPoints, archPath, curtainToGround, ribbon } from "./geom";
import { makeMarking, makePlaster } from "../materials/plaster";

// Vrihat Samrat Yantra, Jaipur. Dimensions from published figures (27 m gnomon, face at 27 deg =
// Jaipur's latitude, shadow speed 1 mm/s), with the base length and quadrant radius *derived*
// from them: base = 27/tan27 ~ 53 m, radius = 1 mm/s / (15 deg/h) ~ 13.75 m. The hypotenuse is
// parallel to Earth's axis, so the real-time sun in SunRig casts a shadow that reads true solar time.

const H = 27, HALF = 26.5, W = 3.6, R = 13.75, DIAL_W = 3.0;
const LAT = (27 * Math.PI) / 180;
const AXIS = new THREE.Vector3(0, Math.sin(LAT), -Math.cos(LAT));
const DOWN = new THREE.Vector3(0, -Math.cos(LAT), -Math.sin(LAT)); // equatorial plane, meridian
const C_Y = R * Math.cos(LAT) + 1.5;                               // lowest dial point ~1.5 m up
const C_Z = HALF - (2 * HALF * C_Y) / H;                           // on the hypotenuse
const RISE = 0.25;
const STEPS = Math.floor(H / RISE);

function gnomonGeometry() {
  const s = new THREE.Shape();
  s.moveTo(-HALF, 0); s.lineTo(HALF, 0); s.lineTo(HALF, H); s.lineTo(-HALF, 0);
  s.holes.push(archPath(-12, 0, 3.4, 5.2), archPath(0, 0, 4.2, 9), archPath(12, 0, 4.6, 12.5));
  const g = new THREE.ExtrudeGeometry(s, { depth: W, bevelEnabled: false, curveSegments: 18 });
  g.rotateY(Math.PI / 2);          // shape x -> world -z (north), extrude -> +x
  g.translate(-W / 2, 0, 0);
  return g;
}

function Quadrant({ side, plaster, marble, marking, reading }: {
  side: 1 | -1; plaster: THREE.Material; marble: THREE.Material; marking: THREE.Material; reading: THREE.Material;
}) {
  const geos = useMemo(() => {
    const C = new THREE.Vector3(side * W / 2, C_Y, C_Z);
    const E = new THREE.Vector3(side, 0, 0);
    const arc = arcPoints(C, DOWN, E, R, 0, Math.PI / 2, 72);
    const edge = (s: number) => arc.map((p) => p.clone().addScaledVector(AXIS, s));
    const dial = ribbon(arc, AXIS, DIAL_W);
    const sideA = curtainToGround(edge(DIAL_W / 2));
    const sideB = curtainToGround(edge(-DIAL_W / 2), true);
    const end = curtainToGround([edge(-DIAL_W / 2)[72], edge(DIAL_W / 2)[72]]);
    // lime-white lip along both dial edges
    const lipA = ribbon(edge(DIAL_W / 2 + 0.08), AXIS, 0.16);
    const lipB = ribbon(edge(-DIAL_W / 2 - 0.08), AXIS, 0.16);
    // quarter-hour graduations: angle from the meridian = hour angle (15 deg per hour)
    const marks: { pos: THREE.Vector3; quat: THREE.Quaternion; hour: boolean; isReading: boolean }[] = [];
    for (let q = 0; q <= 24; q++) {
      const th = (q * 3.75 * Math.PI) / 180;
      const dirR = DOWN.clone().multiplyScalar(Math.cos(th)).addScaledVector(E, Math.sin(th));
      const pos = C.clone().addScaledVector(dirR, R - 0.02);
      const tangent = DOWN.clone().multiplyScalar(-Math.sin(th)).addScaledVector(E, Math.cos(th));
      const nrm = dirR.clone().negate();
      // right-handed basis (east and west quadrants have opposite chirality)
      const m = new THREE.Matrix4().makeBasis(tangent, nrm, tangent.clone().cross(nrm));
      marks.push({ pos, quat: new THREE.Quaternion().setFromRotationMatrix(m), hour: q % 4 === 0, isReading: side === 1 && q === 6 });
    }
    return { dial, sideA, sideB, end, lipA, lipB, marks };
  }, [side]);

  return (
    <group>
      <mesh geometry={geos.dial} material={marble} castShadow receiveShadow />
      <mesh geometry={geos.sideA} material={plaster} castShadow receiveShadow />
      <mesh geometry={geos.sideB} material={plaster} castShadow receiveShadow />
      <mesh geometry={geos.end} material={plaster} castShadow receiveShadow />
      <mesh geometry={geos.lipA} material={marking} receiveShadow />
      <mesh geometry={geos.lipB} material={marking} receiveShadow />
      {geos.marks.map((m, i) => (
        <mesh key={i} position={m.pos} quaternion={m.quat} material={m.isReading ? reading : marking} receiveShadow>
          <boxGeometry args={[m.hour ? 0.12 : 0.05, 0.03, DIAL_W * (m.hour ? 0.98 : 0.6)]} />
        </mesh>
      ))}
    </group>
  );
}

function Chhatri({ plaster, marking }: { plaster: THREE.Material; marking: THREE.Material }) {
  const cols = [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]];
  return (
    <group position={[0, H + 0.3, -HALF + 1.6]}>
      <mesh material={plaster} castShadow receiveShadow position={[0, 0, 0]}>
        <boxGeometry args={[W + 1.2, 0.6, 3.6]} />
      </mesh>
      {cols.map(([x, z], i) => (
        <mesh key={i} material={plaster} castShadow position={[x, 1.6, z]}>
          <cylinderGeometry args={[0.16, 0.2, 2.6, 12]} />
        </mesh>
      ))}
      <mesh material={marking} castShadow position={[0, 3.0, 0]}>
        <boxGeometry args={[3.4, 0.22, 3.4]} />
      </mesh>
      <mesh material={plaster} castShadow position={[0, 3.1, 0]}>
        <sphereGeometry args={[1.35, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh material={marking} position={[0, 4.6, 0]}>
        <coneGeometry args={[0.12, 0.6, 10]} />
      </mesh>
    </group>
  );
}

export function SamratYantra() {
  const plaster = useMemo(() => makePlaster({ doubleSided: true }), []);
  const marble = useMemo(() => makePlaster({ base: "#ece6db", shade: "#b9a998", bleach: "#fbf7ef", grime: 0.2, scale: 0.8, roughness: 0.55, doubleSided: true, bump: 0.03 }), []);
  const marking = useMemo(() => makeMarking(), []);
  const reading = useMemo(() => {
    const m = makeMarking();
    m.emissiveIntensity = 1.6;
    return m;
  }, []);
  const gnomon = useMemo(() => gnomonGeometry(), []);
  const steps = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const run = RISE / Math.tan(LAT);
    const m = new THREE.Matrix4();
    for (let k = 0; k < STEPS; k++) {
      const y = (k + 0.5) * RISE;
      const z = HALF - (y / H) * 2 * HALF - run / 2;
      m.makeTranslation(0, y + RISE / 2, z);
      steps.current!.setMatrixAt(k, m);
    }
    steps.current!.instanceMatrix.needsUpdate = true;
  }, []);

  const hovered = useWorld((s) => s.hovered === "ingest");
  useFrame((_, dt) => {
    const target = hovered ? 0.9 : 0;
    marking.emissiveIntensity += (target - marking.emissiveIntensity) * Math.min(1, dt * 6);
  });

  const slopeLen = Math.hypot(2 * HALF, H);
  return (
    <group
      name="instrument:samrat"
      onPointerOver={(e) => { e.stopPropagation(); useWorld.getState().setHovered("ingest"); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { useWorld.getState().setHovered(null); document.body.style.cursor = "auto"; }}
      onClick={(e) => { e.stopPropagation(); goToStage(STAGE_INDEX.ingest); }}
    >
      <mesh geometry={gnomon} material={plaster} castShadow receiveShadow />
      <instancedMesh ref={steps} args={[undefined, undefined, STEPS]} material={plaster} castShadow receiveShadow>
        <boxGeometry args={[W - 1.1, RISE, RISE / Math.tan(LAT) + 0.02]} />
      </instancedMesh>
      {[-1, 1].map((sx) => (
        <mesh key={sx} material={marking} castShadow receiveShadow
          position={[sx * (W / 2 - 0.25), H / 2 + 0.45, 0]} rotation-x={LAT}>
          <boxGeometry args={[0.5, 0.9, slopeLen]} />
        </mesh>
      ))}
      <Quadrant side={1} plaster={plaster} marble={marble} marking={marking} reading={reading} />
      <Quadrant side={-1} plaster={plaster} marble={marble} marking={marking} reading={reading} />
      <Chhatri plaster={plaster} marking={marking} />
    </group>
  );
}
