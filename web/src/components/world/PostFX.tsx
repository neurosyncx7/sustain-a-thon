"use client";

import { EffectComposer, Bloom, Vignette, Noise, ToneMapping, DepthOfField, N8AO } from "@react-three/postprocessing";
import { ToneMappingMode, BlendFunction } from "postprocessing";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { frame } from "@/lib/timeline";
import { sunDirection } from "@/lib/astro";
import { HeightFogEffect } from "./effects/HeightFog";
import { horizonColor } from "./env/SkyDome";

// "The look" is lighting and material; post finishes it. Order: AO (contact weight) -> height fog
// (mist pools in the courtyard) -> depth of field (opens only in flight) -> bloom (data emissives
// and sun only) -> AgX tone map -> grain -> vignette.
const tmpV = new THREE.Vector3(), nightFog = new THREE.Color("#3a4666"), tmpC = new THREE.Color();

export function PostFX() {
  const dof = useRef<any>(null);
  const fog = useMemo(() => new HeightFogEffect(), []);

  useFrame(({ camera, clock }) => {
    const e = frame.env;
    const u = fog.uniforms;
    (u.get("uProjInv")!.value as THREE.Matrix4).copy(camera.projectionMatrixInverse);
    (u.get("uViewInv")!.value as THREE.Matrix4).copy(camera.matrixWorld);
    (u.get("uCam")!.value as THREE.Vector3).copy(camera.position);
    u.get("uTime")!.value = clock.elapsedTime;
    sunDirection(e.hourAngle, tmpV);
    (u.get("uSunDir")!.value as THREE.Vector3).copy(tmpV);
    const day = THREE.MathUtils.smoothstep(tmpV.y, -0.05, 0.25);
    horizonColor(tmpV.y, e.haze, tmpC);
    (u.get("uColor")!.value as THREE.Color).copy(nightFog).lerp(tmpC, day);
    (u.get("uSunColor")!.value as THREE.Color).setRGB(1.0, 0.78, 0.55).multiplyScalar(day * (0.3 + e.haze));
    u.get("uDensity")!.value = 0.004 + 0.045 * e.groundFog;
    u.get("uFalloff")!.value = 0.28;
    if (dof.current) dof.current.bokehScale = 0.4 + frame.flight * 4;
  });

  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <N8AO aoRadius={2.5} intensity={2.2} distanceFalloff={1.2} quality="medium" halfRes />
      <primitive object={fog} />
      <DepthOfField ref={dof} focusDistance={0.02} focalLength={0.08} bokehScale={0.4} />
      <Bloom luminanceThreshold={0.92} luminanceSmoothing={0.2} intensity={0.5} mipmapBlur />
      <ToneMapping mode={ToneMappingMode.AGX} />
      <Noise opacity={0.04} blendFunction={BlendFunction.SOFT_LIGHT} />
      <Vignette offset={0.26} darkness={0.64} />
    </EffectComposer>
  );
}
