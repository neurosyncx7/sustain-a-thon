"use client";

import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { Suspense, useEffect, useState } from "react";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { CameraRig } from "./CameraRig";
import { OrbitOverviewStation } from "./stations/orbit-overview";
import { LoadingScreen } from "./LoadingScreen";
import { MobileFallback } from "./MobileFallback";

function useIsLowPower() {
  const [low, setLow] = useState<boolean | null>(null);
  useEffect(() => {
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const smallScreen = window.innerWidth < 700;
    const noWebgl = (() => {
      try {
        const c = document.createElement("canvas");
        return !(c.getContext("webgl2") || c.getContext("webgl"));
      } catch {
        return true;
      }
    })();
    setLow(mobile || smallScreen || noWebgl);
  }, []);
  return low;
}

export function Experience() {
  const low = useIsLowPower();

  if (low === null) return null; // avoid a hydration flash while we detect
  if (low) return <MobileFallback />;

  return (
    <>
      <LoadingScreen />
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ fov: 45, position: [0, 1.6, 6] }}
      >
        <color attach="background" args={["#08070a"]} />
        <fog attach="fog" args={["#08070a", 8, 22]} />
        <Suspense fallback={null}>
          <Physics gravity={[0, -9.81, 0]}>
            <OrbitOverviewStation />
          </Physics>
          <CameraRig />
          <EffectComposer>
            <Bloom luminanceThreshold={0.85} intensity={0.35} mipmapBlur />
            <Vignette eskil={false} offset={0.25} darkness={0.6} />
          </EffectComposer>
        </Suspense>
      </Canvas>
    </>
  );
}
