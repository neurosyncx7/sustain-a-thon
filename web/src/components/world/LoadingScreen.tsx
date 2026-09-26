"use client";

import { useProgress } from "@react-three/drei";
import { AnimatePresence, motion } from "framer-motion";
import { useWorldStore } from "@/lib/store";
import { useEffect } from "react";

// r3f-scene / checklist requirement: a designed loading screen, never a bare spinner.
export function LoadingScreen() {
  const { progress, active } = useProgress();
  const isLoading = useWorldStore((s) => s.isLoading);
  const setLoading = useWorldStore((s) => s.setLoading);

  useEffect(() => {
    if (!active && progress >= 100) {
      const t = setTimeout(() => setLoading(false), 350);
      return () => clearTimeout(t);
    }
  }, [active, progress, setLoading]);

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#08070a] text-[#e8e4dc]"
        >
          <div className="mb-6 text-xs tracking-[0.35em] text-[#ff6a1f] uppercase">
            PS-13-S3
          </div>
          <div className="relative h-px w-56 overflow-hidden bg-white/10">
            <motion.div
              className="absolute inset-y-0 left-0 bg-[#ff6a1f]"
              style={{ width: `${Math.max(4, progress)}%` }}
              transition={{ ease: "easeOut" }}
            />
          </div>
          <div className="mt-4 font-mono text-[11px] text-white/40">
            calibrating orbit · {Math.round(progress)}%
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
