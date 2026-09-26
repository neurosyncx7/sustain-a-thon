"use client";

import { motion, useReducedMotion } from "framer-motion";

// Route transitions: every page fades in, eased, never a hard cut. Opacity only: a transform or
// filter here would become the containing block of the fixed canvas and HUD.
export default function Template({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
      {children}
    </motion.div>
  );
}
