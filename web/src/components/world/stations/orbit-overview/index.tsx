"use client";

import { RigidBody } from "@react-three/rapier";
import { Environment, Float, Text } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";
import { useWorldStore } from "@/lib/store";
import { useHoverGlow } from "../../hooks/useHoverGlow";

// First real station: a slowly-rotating globe-proxy (India outline will land here once the
// real basemap texture is baked per asset-pipeline skill §2) plus one interactive hotspot
// that hands off to the "screening" station. Physics: one enter-scene prop with tuned,
// non-default restitution (a soft "signal marker" that settles with a dead thud, not a bounce)
// so the physics-tuner subagent has something real to iterate on.
export function OrbitOverviewStation() {
  const requestCameraTarget = useWorldStore((s) => s.requestCameraTarget);
  const globeRef = useRef<THREE.Mesh>(null);
  const { matRef, handlers } = useHoverGlow();

  return (
    <group name="station:orbit-overview">
      <Environment preset="night" />
      <ambientLight intensity={0.25} />
      <directionalLight position={[4, 6, 2]} intensity={1.1} color="#ffd9b0" />
      <pointLight position={[-3, 2, -2]} intensity={0.6} color="#3f7cff" />

      <Float speed={0.6} rotationIntensity={0.15} floatIntensity={0.4}>
        <mesh ref={globeRef} name="hotspot:enter-screening" {...handlers}
          onClick={() => requestCameraTarget("screening")}
        >
          <icosahedronGeometry args={[1.1, 4]} />
          <meshStandardMaterial
            ref={matRef}
            color="#ff6a1f"
            emissive="#ff6a1f"
            emissiveIntensity={0.15}
            metalness={0.3}
            roughness={0.35}
            wireframe
          />
        </mesh>
      </Float>

      <RigidBody type="fixed" colliders="cuboid" position={[0, -1.4, 0]}>
        <mesh receiveShadow>
          <boxGeometry args={[12, 0.2, 12]} />
          <meshStandardMaterial color="#0a0a12" roughness={0.9} />
        </mesh>
      </RigidBody>

      {/* physics-tuner owns real mass/restitution here; placeholder values are flagged, not silent */}
      <RigidBody
        position={[1.6, 2.5, 0.4]}
        colliders="ball"
        mass={0.4}
        restitution={0.25} // dead-ish landfill-marker thud, not superball bounce — placeholder, tune per skill
        friction={0.6}
      >
        <mesh castShadow>
          <sphereGeometry args={[0.18, 24, 24]} />
          <meshStandardMaterial color="#ffbf6b" emissive="#ff8a1f" emissiveIntensity={0.4} />
        </mesh>
      </RigidBody>

      <Text
        position={[0, -2.3, 0]}
        fontSize={0.22}
        color="#e8e4dc"
        anchorX="center"
        anchorY="middle"
        maxWidth={4}
      >
        Click the orbit to enter the screening pipeline
      </Text>
    </group>
  );
}
