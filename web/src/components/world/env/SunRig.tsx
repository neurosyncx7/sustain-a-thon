"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { sunDirection } from "@/lib/astro";
import { frame } from "@/lib/timeline";
import { horizonColor } from "./SkyDome";

// Sun (true solar direction, shadow-casting), moon fill, hemisphere sky/ground bounce, and fog
// colour matched to the sky horizon every frame. The sun's shadow is what the Samrat Yantra reads.

const SHADOW_EXTENT = 95;
const sunV = new THREE.Vector3();
const warm = new THREE.Color("#ffb070"), white = new THREE.Color("#fff3e2"), tmpC = new THREE.Color();

export function SunRig() {
  const sun = useRef<THREE.DirectionalLight>(null);
  const moon = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const { scene } = useThree();
  const target = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    scene.fog = new THREE.FogExp2("#0b1020", 0.006);
    scene.add(target);
    if (sun.current) {
      sun.current.target = target;
      const cam = sun.current.shadow.camera as THREE.OrthographicCamera;
      cam.left = -SHADOW_EXTENT; cam.right = SHADOW_EXTENT;
      cam.top = SHADOW_EXTENT; cam.bottom = -SHADOW_EXTENT;
      cam.near = 1; cam.far = 600;
      cam.updateProjectionMatrix();
    }
    return () => { scene.remove(target); scene.fog = null; };
  }, [scene, target]);

  useFrame(() => {
    const e = frame.env;
    sunDirection(e.hourAngle, sunV);
    const elev = sunV.y;
    const dayK = THREE.MathUtils.smoothstep(elev, -0.03, 0.2);
    if (sun.current) {
      sun.current.position.copy(sunV).multiplyScalar(300);
      sun.current.intensity = 3.6 * dayK * (1 - 0.25 * e.haze) * (1 - 0.45 * e.cloud);
      sun.current.color.copy(warm).lerp(white, THREE.MathUtils.smoothstep(elev, 0.02, 0.45));
      sun.current.castShadow = dayK > 0.01;
    }
    if (moon.current) moon.current.intensity = 0.32 * (1 - dayK);
    if (hemi.current) {
      horizonColor(elev, e.haze, tmpC);
      hemi.current.color.copy(tmpC).multiplyScalar(1.1);
      hemi.current.groundColor.set("#5a3528").multiplyScalar(0.35 + 0.65 * dayK);
      hemi.current.intensity = 0.16 + 0.48 * dayK;
    }
    const fog = scene.fog as THREE.FogExp2 | null;
    if (fog) {
      horizonColor(elev, e.haze, fog.color);
      fog.density = e.fog * 0.7;
    }
  });

  return (
    <>
      <directionalLight
        ref={sun}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
      <directionalLight ref={moon} position={[120, 220, -60]} color="#9fb4e6" />
      <hemisphereLight ref={hemi} />
    </>
  );
}
