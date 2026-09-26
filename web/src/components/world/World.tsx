"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { Suspense, useEffect, useState } from "react";
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
import { FloorMap, Satellite } from "./instruments/FloorMap";
import { Rashivalaya } from "./instruments/Rashivalaya";
import { JaiPrakash } from "./instruments/JaiPrakash";
import { Attribution } from "./instruments/Attribution";
import { Ledger } from "./instruments/Ledger";
import { STAGE_INDEX } from "@/content/stages";
import { lazy } from "react";

// Rapier's WASM loads only when the viewer approaches the ledger.
const LedgerProps = lazy(() => import("./instruments/LedgerProps").then((m) => ({ default: m.LedgerProps })));
function LazyLedgerProps() {
  const near = useWorld((s) => s.stageIndex >= STAGE_INDEX.ledger - 1);
  return near ? <Suspense fallback={null}><LedgerProps /></Suspense> : null;
}

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

// Quality tiers keep the frame rate, not the feature list, constant: when the GPU falls behind we
// shed resolution first, then ambient occlusion, then depth of field. Three flip-flops at most, so
// the scene never oscillates.
const DPR = (q: number) => [1, 1.25, Math.min(1.75, typeof window === "undefined" ? 1.5 : window.devicePixelRatio)][q];

function Quality() {
  const setQ = useWorld((s) => s.setQuality);
  return (
    <PerformanceMonitor flipflops={3} bounds={() => [45, 58]}
      onDecline={() => setQ(Math.max(0, useWorld.getState().quality - 1) as 0 | 1 | 2)}
      onIncline={() => setQ(Math.min(2, useWorld.getState().quality + 1) as 0 | 1 | 2)}
      onFallback={() => setQ(0)} />
  );
}

export function World() {
  const quality = useWorld((s) => s.quality);
  const [dpr, setDpr] = useState(1.25);
  useEffect(() => {
    const weak = window.matchMedia("(max-width: 900px)").matches || ((navigator as any).deviceMemory ?? 8) <= 4;
    if (weak) useWorld.getState().setQuality(1);
  }, []);
  useEffect(() => setDpr(DPR(quality)), [quality]);
  return (
    <Canvas
      shadows="soft"
      dpr={dpr}
      gl={{ antialias: false, powerPreference: "high-performance", toneMapping: THREE.NoToneMapping }}
      camera={{ fov: 52, near: 0.3, far: 3000, position: [9, 1.7, 36] }}
      className="!fixed inset-0"
    >
      <Quality />
      <Suspense fallback={null}>
        <SkyDome />
        <Stars />
        <SunRig />
        <Courtyard />
        <SamratYantra />
        <FloorMap />
        <Satellite />
        <Rashivalaya />
        <JaiPrakash />
        <Attribution />
        <Ledger />
        <LazyLedgerProps />
        <Dust />
        <CameraRig />
        <PostFX />
        <Ready />
      </Suspense>
    </Canvas>
  );
}
