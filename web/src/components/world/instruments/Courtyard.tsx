"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { makeMarking, makePlaster } from "../materials/plaster";
import { JP } from "./JaiPrakash";

// Courtyard floor (compacted sandstone dust with paving), the observatory's boundary wall with
// crenellations, and the Aravalli ridge on the northern horizon (Nahargarh sits on it) so the
// sky never meets an empty edge.

function ridgeGeometry() {
  const g = new THREE.PlaneGeometry(1600, 140, 400, 1);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    if (y > 0) {
      const h = 30 + 26 * Math.sin(x * 0.006 + 1.3) + 14 * Math.sin(x * 0.017 + 0.4)
        + 6 * Math.sin(x * 0.05) + 3 * Math.sin(x * 0.13);
      pos.setY(i, h);
    } else pos.setY(i, -4);
  }
  g.computeVertexNormals();
  return g;
}

function Wall({ from, to, mat, lime }: { from: [number, number]; to: [number, number]; mat: THREE.Material; lime: THREE.Material }) {
  const dx = to[0] - from[0], dz = to[1] - from[1];
  const len = Math.hypot(dx, dz);
  const ang = Math.atan2(dx, dz);
  const merlons = Math.floor(len / 3.2);
  return (
    <group position={[(from[0] + to[0]) / 2, 0, (from[1] + to[1]) / 2]} rotation-y={ang}>
      <mesh material={mat} castShadow receiveShadow position-y={2.2}>
        <boxGeometry args={[1.2, 4.4, len]} />
      </mesh>
      <mesh material={lime} position-y={4.43}>
        <boxGeometry args={[1.3, 0.06, len]} />
      </mesh>
      {Array.from({ length: merlons }, (_, i) => (
        <mesh key={i} material={mat} castShadow position={[0, 4.95, -len / 2 + 1.6 + i * 3.2]}>
          <boxGeometry args={[1.2, 1.0, 1.7]} />
        </mesh>
      ))}
    </group>
  );
}

export function Courtyard() {
  const ground = useMemo(
    () => makePlaster({ base: "#b89877", shade: "#8a6a50", bleach: "#d8c2a3", grime: 0, scale: 0.12, roughness: 0.96, bump: 0.12 }),
    [],
  );
  const paving = useMemo(
    () => makePlaster({ base: "#c9ad8d", shade: "#9c7f63", bleach: "#e1cdb2", grime: 0, scale: 0.9, roughness: 0.9, bump: 0.08 }),
    [],
  );
  const wall = useMemo(() => makePlaster({ base: "#c07a62", grime: 0.8 }), []);
  const lime = useMemo(() => makeMarking(), []);
  const ridge = useMemo(() => ridgeGeometry(), []);
  // ground with a circular opening where the Jai Prakash bowl is sunk into the earth
  const groundGeo = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-450, -450); s.lineTo(450, -450); s.lineTo(450, 450); s.lineTo(-450, 450); s.lineTo(-450, -450);
    const hole = new THREE.Path();
    hole.absarc(JP.x, -JP.z, JP.r + 0.95, 0, Math.PI * 2, true);
    s.holes.push(hole);
    return new THREE.ShapeGeometry(s, 64);
  }, []);
  const ridgeMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#5c4a44", roughness: 1 }), []);

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} geometry={groundGeo} material={ground} receiveShadow />
      {/* processional paths linking the instruments */}
      {[
        [0, 58, 8, 60, 0],
        [14, 62, 7, 18, Math.PI / 2],
        [-24, 62, 7, 30, Math.PI / 2],
        [-32, 29, 6, 24, 1.3],
        [36, 8, 6, 34, 1.45],
      ].map(([x, z, l, w, r], i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, r]} position={[x, 0.02, z]} material={paving} receiveShadow>
          <planeGeometry args={[w, l]} />
        </mesh>
      ))}
      <Wall from={[-120, 100]} to={[120, 100]} mat={wall} lime={lime} />
      <Wall from={[120, 100]} to={[120, -210]} mat={wall} lime={lime} />
      <Wall from={[-120, -210]} to={[-120, 100]} mat={wall} lime={lime} />
      <Wall from={[-120, -210]} to={[120, -210]} mat={wall} lime={lime} />
      <mesh geometry={ridge} material={ridgeMat} position={[0, 0, -520]} />
      <mesh geometry={ridge} material={ridgeMat} position={[80, -6, 560]} rotation-y={Math.PI} scale={[1, 0.6, 1]} />
    </group>
  );
}
