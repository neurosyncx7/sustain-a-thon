"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { useWorld } from "@/lib/store";
import { evaluate, frame } from "@/lib/timeline";

// r3f-scene skill: the ONLY writer of camera transforms. Pose comes from the scroll timeline
// (eased Bezier flights with holds); we add critically damped smoothing so wheel ticks never
// jerk, plus a small mouse parallax that fades out during flights.

const smPos = new THREE.Vector3(), smTgt = new THREE.Vector3(), par = new THREE.Vector2();
let initialised = false;

export function CameraRig() {
  const { camera } = useThree();
  const mouse = useRef(new THREE.Vector2());

  useFrame((state, dt) => {
    const p = useWorld.getState().progress;
    evaluate(p);
    mouse.current.set(state.pointer.x, state.pointer.y);
    const k = 1 - Math.exp(-dt * 4.5);
    if (!initialised) { smPos.copy(frame.pos); smTgt.copy(frame.target); initialised = true; }
    smPos.lerp(frame.pos, k);
    smTgt.lerp(frame.target, k);
    par.lerp(mouse.current, 1 - Math.exp(-dt * 2));
    const hold = 1 - frame.flight;
    const cam = camera as THREE.PerspectiveCamera;
    cam.position.copy(smPos);
    cam.position.x += par.x * 0.6 * hold;
    cam.position.y += par.y * 0.3 * hold;
    cam.lookAt(smTgt);
    if (Math.abs(cam.fov - frame.fov) > 0.01) {
      cam.fov += (frame.fov - cam.fov) * k;
      cam.updateProjectionMatrix();
    }
  });
  return null;
}
