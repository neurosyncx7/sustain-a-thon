"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useWorld } from "@/lib/store";

// A designed threshold, not a spinner: a sundial arc draws as shaders compile and data arrives.
export function Loader() {
  const ready = useWorld((s) => s.ready);
  const [minDone, setMinDone] = useState(false);
  const [p, setP] = useState(0.08);
  useEffect(() => { const t = setTimeout(() => setMinDone(true), 1400); return () => clearTimeout(t); }, []);
  useEffect(() => {
    if (ready) { setP(1); return; }
    const id = setInterval(() => setP((v) => Math.min(0.9, v + (0.9 - v) * 0.08)), 120);
    // never trap the viewer: after 12 s, let them in even if a shader is still compiling
    const bail = setTimeout(() => useWorld.getState().setReady(true), 12000);
    return () => { clearInterval(id); clearTimeout(bail); };
  }, [ready]);
  const show = !(ready && minDone);
  const R = 46, C = Math.PI * R; // half circle: the dial
  return (
    <AnimatePresence>
      {show && (
        <motion.div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink"
          exit={{ opacity: 0 }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}>
          <svg width="120" height="70" viewBox="0 0 120 70" aria-hidden>
            <path d={`M ${60 - R} 60 A ${R} ${R} 0 0 1 ${60 + R} 60`} fill="none" stroke="rgb(236 228 216 / 0.12)" strokeWidth="1.5" />
            <motion.path d={`M ${60 - R} 60 A ${R} ${R} 0 0 1 ${60 + R} 60`} fill="none" stroke="#6fb4ff" strokeWidth="1.5"
              strokeDasharray={C} animate={{ strokeDashoffset: C * (1 - p) }} transition={{ ease: "easeOut", duration: 0.4 }} />
            <line x1="60" y1="60" x2={60 + R * Math.cos(Math.PI * (1 - p))} y2={60 - R * Math.sin(Math.PI * (1 - p))} stroke="rgb(236 228 216 / 0.7)" strokeWidth="1" />
          </svg>
          <p className="mt-6 text-[13px] text-paper/70">Aligning the gnomon to 26.92° north</p>
          <p className="num mt-1 text-[11px] text-paper/40">{Math.round(p * 100)}%</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
