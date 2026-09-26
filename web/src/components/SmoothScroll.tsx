"use client";

import Lenis from "lenis";
import { useEffect } from "react";

// Document pages (ledger, dossiers) get the same wheel feel as the observatory, without its
// stage-settling: plain eased scrolling, in-page anchors eased too, reduced motion respected.
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 0.9, anchors: { offset: -24, duration: 1.2 } });
    let raf = requestAnimationFrame(function loop(t) { lenis.raf(t); raf = requestAnimationFrame(loop); });
    if (window.location.hash) {
      const el = document.querySelector(window.location.hash);
      if (el) requestAnimationFrame(() => lenis.scrollTo(el as HTMLElement, { offset: -24, duration: 1.2 }));
    }
    return () => { cancelAnimationFrame(raf); lenis.destroy(); };
  }, []);
  return null;
}
