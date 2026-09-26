import * as THREE from "three";

// Geometry helpers for masonry that follows analytic curves (quadrant arcs, bowl rims).

/** Ribbon surface: pts(i) + s*side, s in [-w/2, w/2]. Returns a BufferGeometry with normals. */
export function ribbon(points: THREE.Vector3[], side: THREE.Vector3, width: number) {
  const pos: number[] = [], idx: number[] = [];
  points.forEach((p) => {
    const a = p.clone().addScaledVector(side, -width / 2);
    const b = p.clone().addScaledVector(side, width / 2);
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
  });
  for (let i = 0; i < points.length - 1; i++) {
    const k = i * 2;
    idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Vertical curtain from each point straight down to ground y=0 (piers under arcs). */
export function curtainToGround(points: THREE.Vector3[], flip = false) {
  const pos: number[] = [], idx: number[] = [];
  points.forEach((p) => pos.push(p.x, p.y, p.z, p.x, 0, p.z));
  for (let i = 0; i < points.length - 1; i++) {
    const k = i * 2;
    if (flip) idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    else idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function arcPoints(center: THREE.Vector3, u: THREE.Vector3, v: THREE.Vector3, r: number,
  a0: number, a1: number, n: number) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = a0 + ((a1 - a0) * i) / n;
    pts.push(center.clone().addScaledVector(u, r * Math.cos(t)).addScaledVector(v, r * Math.sin(t)));
  }
  return pts;
}

/** Arched opening shape (rectangle + semicircle), for holes in extruded walls. */
export function archPath(cx: number, y0: number, w: number, h: number) {
  const p = new THREE.Path();
  p.moveTo(cx - w / 2, y0);
  p.lineTo(cx + w / 2, y0);
  p.lineTo(cx + w / 2, y0 + h - w / 2);
  p.absarc(cx, y0 + h - w / 2, w / 2, 0, Math.PI, false);
  p.lineTo(cx - w / 2, y0);
  return p;
}
