"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { STAGES } from "@/content/stages";
import { formatSolarTime, sunDirection } from "@/lib/astro";
import { goToStage, useWorld } from "@/lib/store";
import { frame } from "@/lib/timeline";
import { StageEvidence } from "./StageEvidence";
import { LiveDot } from "@/components/live/LiveDot";
import * as THREE from "three";

const ease = [0.16, 1, 0.3, 1] as const;

function Nav() {
  const idx = useWorld((s) => s.stageIndex);
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between px-5 md:px-8">
      <button
        onClick={() => goToStage(0)}
        className="pointer-events-auto flex items-baseline gap-2 text-[15px] font-medium tracking-tight text-paper/95 transition-opacity hover:opacity-80"
        aria-label="Vāyu Lekha, back to the start"
      >
        Vāyu Lekha
        <span className="hidden text-[12px] font-normal text-paper/45 sm:inline">the air ledger</span>
      </button>
      <nav className="pointer-events-auto hidden items-center gap-1 lg:flex" aria-label="Stages">
        {STAGES.map((s, i) => (
          <button
            key={s.slug}
            onClick={() => goToStage(i)}
            aria-current={idx === i ? "step" : undefined}
            className={`relative rounded-full px-3 py-1.5 text-[13px] transition-colors ${
              idx === i ? "text-paper" : "text-paper/50 hover:text-paper/85"
            }`}
          >
            {idx === i && (
              <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full bg-paper/[0.08] ring-1 ring-paper/15"
                transition={{ type: "spring", stiffness: 380, damping: 32 }} />
            )}
            <span className="relative">{s.nav}</span>
          </button>
        ))}
      </nav>
      <div className="pointer-events-auto flex items-center gap-2">
        <LiveDot className="bg-ink/40 backdrop-blur-md" />
        <Link href="/ledger" className="rounded-full px-3.5 py-1.5 text-[13px] text-paper/80 ring-1 ring-paper/20 transition hover:bg-paper/10 hover:text-paper active:scale-[0.98]">
          Open inventory
        </Link>
      </div>
    </header>
  );
}

function ModeToggle() {
  const mode = useWorld((s) => s.mode);
  const setMode = useWorld((s) => s.setMode);
  return (
    <div className="pointer-events-auto fixed bottom-5 left-1/2 z-30 -translate-x-1/2">
      <div role="radiogroup" aria-label="View mode" className="relative flex rounded-full bg-ink/70 p-1 ring-1 ring-paper/15 backdrop-blur-md">
        {(["story", "evidence"] as const).map((m) => (
          <button key={m} role="radio" aria-checked={mode === m} onClick={() => setMode(m)}
            className={`relative z-10 w-24 rounded-full py-1.5 text-[12px] font-medium capitalize transition-colors ${mode === m ? "text-ink" : "text-paper/65 hover:text-paper"}`}>
            {mode === m && (
              <motion.span layoutId="mode-pill" className="absolute inset-0 -z-10 rounded-full bg-paper"
                transition={{ type: "spring", stiffness: 420, damping: 34 }} />
            )}
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}

function SolarClock() {
  const t = useRef<HTMLSpanElement>(null);
  const e = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let raf = 0; const v = new THREE.Vector3();
    const tick = () => {
      const H = frame.env.hourAngle;
      if (t.current) t.current.textContent = formatSolarTime(H);
      if (e.current) {
        const el = (Math.asin(sunDirection(H, v).y) * 180) / Math.PI;
        e.current.textContent = `${el >= 0 ? "+" : ""}${el.toFixed(1)}°`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="pointer-events-none fixed bottom-6 right-5 z-30 hidden text-right md:block md:right-8">
      <div className="num text-[22px] leading-none text-paper"><span ref={t}>22:00</span></div>
      <div className="mt-1.5 text-[11px] text-paper/50">Jaipur solar time · sun <span ref={e} className="num" /></div>
    </div>
  );
}

function ProgressRail() {
  const idx = useWorld((s) => s.stageIndex);
  return (
    <div className="pointer-events-auto fixed right-3 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-3 md:flex" aria-hidden>
      {STAGES.map((s, i) => (
        <button key={s.slug} onClick={() => goToStage(i)} tabIndex={-1}
          className="group flex h-4 w-4 items-center justify-center" title={s.instrument}>
          <span className={`block rounded-full transition-all duration-500 ${i === idx ? "h-3 w-[3px] bg-flame" : "h-[5px] w-[5px] bg-paper/30 group-hover:bg-paper/70"}`} />
        </button>
      ))}
    </div>
  );
}

function StagePanel() {
  const idx = useWorld((s) => s.stageIndex);
  const mode = useWorld((s) => s.mode);
  const reduce = useReducedMotion();
  const st = STAGES[idx];
  const hero = st.slug === "prologue";
  const item = {
    hidden: { opacity: 0, y: reduce ? 0 : 18, filter: reduce ? "none" : "blur(8px)" },
    show: { opacity: 1, y: 0, filter: "blur(0px)" },
  };
  return (
    <div className={`pointer-events-none fixed left-5 right-5 z-20 md:left-8 md:right-auto ${hero ? "bottom-20 md:bottom-14 md:w-[min(680px,52vw)]" : "bottom-20 md:bottom-16 md:w-[min(580px,46vw)]"}`}>
      <div className="absolute -inset-x-10 -inset-y-14 -z-10 bg-[radial-gradient(closest-side,rgb(7_8_13/0.78),transparent)]" />
      <AnimatePresence mode="wait">
        <motion.div key={st.slug} initial="hidden" animate="show" exit="hidden"
          transition={{ staggerChildren: reduce ? 0 : 0.07 }} className="pointer-events-auto">
          <motion.div variants={item} transition={{ duration: 0.7, ease }} className="flex flex-wrap items-baseline gap-x-3 text-[12px]">
            <span className="text-flame/90">{st.step}</span>
            {!hero && <span className="text-paper/45">{st.instrument}</span>}
          </motion.div>
          <motion.h1 variants={item} transition={{ duration: 0.8, ease }}
            className={`mt-2 font-medium tracking-tight text-paper ${hero ? "text-[30px] leading-[1.04] md:text-[48px]" : "text-[26px] leading-[1.08] md:text-[36px]"}`}>
            {st.title}
          </motion.h1>
          <motion.p variants={item} transition={{ duration: 0.8, ease }} className={`mt-3 max-w-[60ch] leading-relaxed text-paper/72 ${hero ? "text-[14.5px] md:text-[15.5px]" : "text-[14px] md:text-[14.5px]"}`}>
            {st.story}
          </motion.p>
          {st.algorithms.length > 0 && (
            <motion.ul variants={item} transition={{ duration: 0.8, ease }} className="mt-3 flex flex-wrap gap-1.5" aria-label="Running at this step">
              {st.algorithms.map((a) => (
                <li key={a} className="rounded-full bg-flame/[0.08] px-2.5 py-1 text-[11px] text-[#bcd9ff] ring-1 ring-flame/25">{a}</li>
              ))}
            </motion.ul>
          )}
          <motion.div variants={item} transition={{ duration: 0.8, ease }} className="mt-4">
            <StageEvidence slug={st.slug} expanded={mode === "evidence"} />
          </motion.div>
          <motion.div variants={item} transition={{ duration: 0.8, ease }} className="mt-4 flex flex-wrap items-center gap-2">
            {hero && (
              <button onClick={() => goToStage(1)}
                className="rounded-full bg-paper px-4 py-2 text-[13px] font-medium text-ink transition hover:bg-white active:scale-[0.98]">
                Begin the reading
              </button>
            )}
            <Link href={st.link.href}
              className="group inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] text-paper/80 ring-1 ring-paper/20 transition hover:bg-paper/10 hover:text-paper active:scale-[0.98]">
              {st.link.label}
              <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-0.5">→</span>
            </Link>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function Hud() {
  return (
    <>
      <Nav />
      <StagePanel />
      <ProgressRail />
      <SolarClock />
      <ModeToggle />
    </>
  );
}
