"use client";

import Lenis from "lenis";
import { useEffect } from "react";
import gsap from "gsap";

// Drives Lenis off the shared rAF loop and keeps GSAP's ticker in sync, per r3f-scene's rule
// that the R3F CameraRig's idle updates and any scroll-triggered GSAP timelines run off one
// consistent clock rather than fighting two separate rAF loops.
export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    function raf(time: number) {
      lenis.raf(time);
    }
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
