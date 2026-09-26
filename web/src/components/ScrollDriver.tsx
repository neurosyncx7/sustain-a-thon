"use client";

import Lenis from "lenis";
import { useEffect, useRef } from "react";
import { STAGES } from "@/content/stages";
import { registerScrollToStage, useWorld } from "@/lib/store";

// Scroll is time. Lenis smooths the wheel; its progress drives the whole world. When the user
// stops between stages we settle to the nearest one, so every stop is a composed frame.
const N = STAGES.length;

export function ScrollDriver() {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lenis = new Lenis({ duration: reduce ? 0 : 1.35, smoothWheel: !reduce, wheelMultiplier: 0.8 });
    lenisRef.current = lenis;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    let programmatic = false;

    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const toStage = (i: number, duration = 2.6) => {
      programmatic = true;
      lenis.scrollTo((i / (N - 1)) * lenis.limit, {
        duration: reduce ? 0 : duration,
        easing: ease,
        onComplete: () => { programmatic = false; },
      });
    };
    registerScrollToStage((i) => toStage(Math.max(0, Math.min(N - 1, i))));

    lenis.on("scroll", (l: Lenis) => {
      useWorld.getState().setProgress(l.limit > 0 ? l.animatedScroll / l.limit : 0);
      if (programmatic) return;
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        const x = (l.animatedScroll / l.limit) * (N - 1);
        const nearest = Math.round(x);
        if (Math.abs(x - nearest) > 0.02) toStage(nearest, 1.4);
      }, 220);
    });

    // Deep links: /?at=<stage slug> opens on that stage (and the URL follows the journey).
    const at = new URLSearchParams(window.location.search).get("at");
    const startIdx = STAGES.findIndex((st) => st.slug === at);
    if (startIdx > 0) requestAnimationFrame(() => {
      lenis.scrollTo((startIdx / (N - 1)) * lenis.limit, { immediate: true, force: true });
      useWorld.getState().setProgress(startIdx / (N - 1));
    });
    const unsub = useWorld.subscribe((st, prev) => {
      if (st.stageIndex !== prev.stageIndex) {
        const url = new URL(window.location.href);
        url.searchParams.set("at", STAGES[st.stageIndex].slug);
        window.history.replaceState(null, "", url);
      }
    });

    let raf = 0;
    const loop = (t: number) => { lenis.raf(t); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);

    const onKey = (e: KeyboardEvent) => {
      const i = useWorld.getState().stageIndex;
      if (["ArrowDown", "PageDown", " "].includes(e.key)) { e.preventDefault(); toStage(i + 1); }
      if (["ArrowUp", "PageUp"].includes(e.key)) { e.preventDefault(); toStage(i - 1); }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(settleTimer);
      window.removeEventListener("keydown", onKey);
      unsub();
      lenis.destroy();
    };
  }, []);

  // The scroll length: one generous screen per stage transition.
  return <div aria-hidden style={{ height: `${(N - 1) * 140 + 100}dvh` }} />;
}
