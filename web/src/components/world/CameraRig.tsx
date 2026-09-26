"use client";

import { useFrame, useThree } from "@react-three/fiber";
import gsap from "gsap";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useWorldStore } from "@/lib/store";
import { STATIONS } from "@/content/stations";

// r3f-scene skill: this is the ONLY component allowed to touch camera.position/quaternion.
// Station components request a target via useWorldStore.requestCameraTarget(); everything
// here reacts to that, never the other way around.
export function CameraRig() {
  const { camera } = useThree();
  const cameraTarget = useWorldStore((s) => s.cameraTarget);
  const setTweening = useWorldStore((s) => s.setTweening);
  const isTweening = useWorldStore((s) => s.isTweening);

  const proxy = useRef({ x: 0, y: 1.6, z: 6, lx: 0, ly: 1, lz: 0 }).current;
  const mouse = useRef({ x: 0, y: 0 });
  const idleOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useEffect(() => {
    if (!cameraTarget) return;
    const station = STATIONS[cameraTarget.stationSlug];
    if (!station) return;
    setTweening(true);
    const tl = gsap.timeline({
      defaults: { duration: 1.6, ease: "power3.inOut" },
      onComplete: () => setTweening(false),
    });
    tl.to(proxy, {
      x: station.cameraWaypoint[0],
      y: station.cameraWaypoint[1],
      z: station.cameraWaypoint[2],
      ease: "back.out(1.2)",
      duration: 1.9,
    }, 0);
    tl.to(proxy, {
      lx: station.lookAt[0],
      ly: station.lookAt[1],
      lz: station.lookAt[2],
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraTarget?.nonce]);

  useFrame(() => {
    let px = proxy.x;
    let py = proxy.y;
    if (!isTweening) {
      // idle parallax: lerp toward a small mouse-driven offset, gated off during any active tween
      idleOffset.current.x += (mouse.current.x * 0.15 - idleOffset.current.x) * 0.04;
      idleOffset.current.y += (-mouse.current.y * 0.1 - idleOffset.current.y) * 0.04;
      px += idleOffset.current.x;
      py += idleOffset.current.y;
    }
    camera.position.set(px, py, proxy.z);
    camera.lookAt(proxy.lx, proxy.ly, proxy.lz);
  });

  return null;
}
