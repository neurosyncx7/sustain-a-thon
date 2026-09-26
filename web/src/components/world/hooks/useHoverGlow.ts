"use client";

import { useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

// Shared hover affordance: cursor -> pointer, emissive pulse on the mesh. r3f-scene skill:
// every hotspot uses this hook, never an ad hoc per-component hover handler.
export function useHoverGlow(baseEmissive = 0.15, hoverEmissive = 0.65) {
  const [hovered, setHovered] = useState(false);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame((_, delta) => {
    if (!matRef.current) return;
    const target = hovered ? hoverEmissive : baseEmissive;
    matRef.current.emissiveIntensity +=
      (target - matRef.current.emissiveIntensity) * Math.min(1, delta * 8);
  });

  const handlers = {
    onPointerOver: (e: any) => {
      e.stopPropagation();
      setHovered(true);
      document.body.style.cursor = "pointer";
    },
    onPointerOut: (e: any) => {
      e.stopPropagation();
      setHovered(false);
      document.body.style.cursor = "auto";
    },
  };

  return { matRef, hovered, handlers };
}
