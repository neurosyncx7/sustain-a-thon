"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { JAIPUR_LAT_DEG, lstFromHourAngle, sunDirection } from "@/lib/astro";
import { frame } from "@/lib/timeline";

// The real night sky over Jaipur: 19,054 catalogue stars (to V=7.2) placed by right ascension and
// declination for the scene's sidereal time, coloured by B-V, sized by magnitude, dimmed by
// airmass near the horizon and scintillating more there (as real stars do).

const vert = /* glsl */ `
attribute vec4 aStar;               // ra, dec, mag, bv
uniform float uLst, uLat, uTime, uPx;
varying vec3 vCol; varying float vA;
vec3 bvToRgb(float bv){
  bv = clamp(bv, -0.4, 2.0);
  vec3 hot = vec3(0.62,0.72,1.0), mid = vec3(1.0,0.97,0.92), cool = vec3(1.0,0.72,0.45);
  return bv < 0.4 ? mix(hot, mid, (bv+0.4)/0.8) : mix(mid, cool, (bv-0.4)/1.6);
}
void main(){
  float h = uLst - aStar.x, d = aStar.y;
  vec3 dir = vec3(-cos(d)*sin(h), sin(uLat)*sin(d)+cos(uLat)*cos(d)*cos(h),
                  -(cos(uLat)*sin(d)-sin(uLat)*cos(d)*cos(h)));
  float alt = dir.y;
  float airmass = 1.0/max(alt+0.06, 0.02);
  float ext = exp(-0.12*(airmass-1.0));                      // atmospheric extinction
  float flux = pow(10.0, -0.4*(aStar.z - 1.0));
  float tw = 1.0 + (0.18 + 0.5*(1.0-clamp(alt*3.0,0.0,1.0))) * sin(uTime*(3.0+fract(aStar.x*97.0)*6.0) + aStar.y*211.0);
  vA = clamp(flux*1.8, 0.05, 1.0) * ext * smoothstep(-0.01, 0.06, alt) * tw;
  vCol = bvToRgb(aStar.w);
  vec4 mv = modelViewMatrix * vec4(dir*850.0, 1.0);
  gl_PointSize = uPx * clamp(0.9 + 2.2*sqrt(flux), 0.9, 5.0);
  gl_Position = projectionMatrix * mv;
}`;
const frag = /* glsl */ `
varying vec3 vCol; varying float vA; uniform float uOpacity;
void main(){
  vec2 c = gl_PointCoord - 0.5; float r2 = dot(c,c)*4.0;
  float core = exp(-r2*6.0), halo = exp(-r2*1.6)*0.25;
  float a = (core + halo) * vA * uOpacity;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vCol * (1.0 + core*1.4), a);
}`;

const tmpSun = new THREE.Vector3();

export function Stars() {
  const [geo, setGeo] = useState<THREE.BufferGeometry | null>(null);
  const pts = useRef<THREE.Points>(null);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, fog: false,
        uniforms: {
          uLst: { value: 0 }, uLat: { value: (JAIPUR_LAT_DEG * Math.PI) / 180 }, uTime: { value: 0 },
          uPx: { value: 1.5 }, uOpacity: { value: 1 },
        },
      }),
    [],
  );

  useEffect(() => {
    let alive = true;
    fetch("/data/stars.bin").then((r) => r.arrayBuffer()).then((buf) => {
      if (!alive) return;
      const a = new Float32Array(buf);
      const g = new THREE.BufferGeometry();
      g.setAttribute("aStar", new THREE.BufferAttribute(a, 4));
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array((a.length / 4) * 3), 3));
      setGeo(g);
    });
    return () => { alive = false; };
  }, []);

  useFrame(({ clock, camera, gl }) => {
    const e = frame.env;
    pts.current?.position.copy(camera.position);
    mat.uniforms.uLst.value = lstFromHourAngle(e.hourAngle);
    mat.uniforms.uTime.value = clock.elapsedTime;
    mat.uniforms.uPx.value = 1.35 * gl.getPixelRatio();
    const sunY = sunDirection(e.hourAngle, tmpSun).y;
    const dark = 1 - THREE.MathUtils.smoothstep(sunY, -0.28, -0.03); // civil -> astronomical twilight
    mat.uniforms.uOpacity.value = e.stars * dark * (1 - 0.9 * e.cloud);
  });

  if (!geo) return null;
  return <points ref={pts} geometry={geo} material={mat} frustumCulled={false} renderOrder={-9} />;
}
