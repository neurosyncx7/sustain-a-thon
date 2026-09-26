"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { Suspense, useEffect } from "react";
import * as THREE from "three";
import { useWorld } from "@/lib/store";
import { CameraRig } from "./CameraRig";
import { PostFX } from "./PostFX";
import { SkyDome } from "./env/SkyDome";
import { Stars } from "./env/Stars";
import { SunRig } from "./env/SunRig";
import { Dust } from "./env/Atmosphere";
import { Courtyard } from "./instruments/Courtyard";
import { SamratYantra } from "./instruments/SamratYantra";

function Ready() {
  // Pre-compile every shader before the loader leaves, so the first flight never stutters.
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    let cancelled = false;
    const done = () => !cancelled && useWorld.getState().setReady(true);
    const anyGl = gl as any;
    if (anyGl.compileAsync) anyGl.compileAsync(scene, camera).then(done, done);
    else { gl.compile(scene, camera); done(); }
    return () => { cancelled = true; };
  }, [gl, scene, camera]);
  return null;
}

export function World() {
  return (
    <Canvas
      shadows="soft"
      dpr={[1, 1.75]}
      gl={{ antialias: false, powerPreference: "high-performance", toneMapping: THREE.NoToneMapping }}
      camera={{ fov: 52, near: 0.3, far: 3000, position: [9, 1.7, 36] }}
      className="!fixed inset-0"
    >
      <Suspense fallback={null}>
        <SkyDome />
        <Stars />
        <SunRig />
        <Courtyard />
        <SamratYantra />
        <Dust />
        <CameraRig />
        <PostFX />
        <Ready />
      </Suspense>
    </Canvas>
  );
}
