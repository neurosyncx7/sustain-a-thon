"use client";

import { motion } from "framer-motion";
import { STATIONS } from "@/content/stations";

// checklist requirement: mobile/low-power/no-WebGL gets a lighter static hero, never a blank canvas.
export function MobileFallback() {
  const s = STATIONS["orbit-overview"];
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#08070a] px-6 text-center text-[#e8e4dc]">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        <div className="mb-3 text-xs tracking-[0.35em] text-[#ff6a1f] uppercase">PS-13-S3</div>
        <h1 className="mb-4 text-2xl font-semibold">{s.title}</h1>
        <p className="mx-auto max-w-sm text-sm text-white/60">{s.summary}</p>
      </motion.div>
    </div>
  );
}
