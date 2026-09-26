"use client";

import { Physics, RigidBody, CuboidCollider, CylinderCollider, type RapierRigidBody } from "@react-three/rapier";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { LEDGER } from "./Ledger";

// Brass paperweights on the ledger. Mounted only near the ledger stage (Rapier WASM is loaded
// lazily). Values are physical, not defaults (see .claude/skills/r3f-scene: physics section):
//  - brass density 8,500 kg/m^3; r = 5 cm, h = 3.2 cm  ->  mass ~ 2.1 kg
//  - restitution 0.12: brass on lime-washed stone is a dull clack, not a bounce
//  - friction 0.55 (metal on stone); angular damping 0.6 so a nudged weight rocks then settles
// The reading desk is tilted 0.32 rad like the lectern mesh, so weights creep toward the lip
// and stop against it, the way real ones do.

const R = 0.05, H = 0.032;
const MASS = Math.PI * R * R * H * 8500;
const TILT = 0.32;

function Weight({ position, i }: { position: [number, number, number]; i: number }) {
  const body = useRef<RapierRigidBody>(null);
  const [hover, setHover] = useState(false);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#b8904e", metalness: 0.95, roughness: 0.28 }), []);
  mat.emissive.set(hover ? "#6fb4ff" : "#000000");
  mat.emissiveIntensity = hover ? 0.35 : 0;
  return (
    <RigidBody ref={body} position={position} colliders={false} mass={MASS} restitution={0.12} friction={0.55}
      angularDamping={0.6} linearDamping={0.15} ccd>
      <CylinderCollider args={[H / 2, R]} />
      <mesh material={mat} castShadow receiveShadow
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = "grab"; }}
        onPointerOut={() => { setHover(false); document.body.style.cursor = "auto"; }}
        onClick={(e) => {
          e.stopPropagation();
          // a flick: horizontal impulse away from the viewer plus a little spin
          const dir = new THREE.Vector3().subVectors(e.point, e.camera.position).setY(0).normalize();
          body.current?.applyImpulse({ x: dir.x * 0.9 * MASS, y: 0.35 * MASS, z: dir.z * 0.9 * MASS }, true);
          body.current?.applyTorqueImpulse({ x: 0, y: 0.002 * (i % 2 ? 1 : -1), z: 0.0015 }, true);
        }}>
        <cylinderGeometry args={[R, R * 1.04, H, 28]} />
      </mesh>
    </RigidBody>
  );
}

export function LedgerProps() {
  // desk frame: matches the lectern top in Ledger.tsx (centre LEDGER, y 0.98, tilted TILT about x)
  const q = useMemo(() => new THREE.Quaternion().setFromEuler(new THREE.Euler(TILT, 0, 0)), []);
  const deskTop = (x: number, z: number, lift = 0): [number, number, number] => {
    const v = new THREE.Vector3(x, 0.05 + lift, z).applyQuaternion(q);
    return [LEDGER.x + v.x, 0.98 + 0.06 + v.y, LEDGER.z + v.z];
  };
  return (
    <Physics gravity={[0, -9.81, 0]} timeStep="vary">
      {/* reading desk surface and its raised lip (fixed), plus the courtyard floor */}
      <RigidBody type="fixed" colliders={false} position={[LEDGER.x, 0.98, LEDGER.z]} quaternion={q}>
        <CuboidCollider args={[0.75, 0.05, 0.525]} friction={0.55} />
        <CuboidCollider args={[0.75, 0.04, 0.02]} position={[0, 0.07, 0.5]} />
      </RigidBody>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[40, 0.1, 40]} position={[LEDGER.x, -0.1, LEDGER.z]} />
      </RigidBody>
      <Weight i={0} position={deskTop(-0.62, -0.28, 0.03)} />
      <Weight i={1} position={deskTop(0.62, -0.22, 0.03)} />
      <Weight i={2} position={deskTop(0.58, 0.18, 0.03)} />
    </Physics>
  );
}
