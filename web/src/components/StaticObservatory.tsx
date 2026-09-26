"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { STAGES } from "@/content/stages";
import { StageEvidence } from "./hud/StageEvidence";

// Low-power / no-WebGL experience: the same seven beats as a scroll story, illustrated with
// stills rendered from this very world (public/stills, captured by tools/shoot.mjs), and the same
// live evidence modules. Never a blank canvas.
export function StaticObservatory() {
  const reduce = useReducedMotion();
  return (
    <main className="min-h-[100dvh] bg-ink text-paper">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between bg-ink/80 px-4 backdrop-blur-md">
        <span className="text-[15px] font-medium tracking-tight">Vāyu Lekha</span>
        <Link href="/ledger" className="rounded-full px-3 py-1.5 text-[13px] ring-1 ring-paper/20 active:scale-[0.98]">Open inventory</Link>
      </header>
      {STAGES.map((s) => (
        <section key={s.slug} className="relative">
          <div className="relative aspect-[16/10] w-full overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/stills/${s.slug}.jpg`} alt={`${s.instrument}, rendered from the observatory scene`}
              className="h-full w-full object-cover" loading="lazy" />
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink to-transparent" />
          </div>
          <motion.div className="relative -mt-10 px-4 pb-14"
            initial={reduce ? false : { opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
            <div className="text-[12px] text-flame/90">{s.instrument}</div>
            <h2 className="mt-2 text-[26px] font-medium leading-[1.1] tracking-tight">{s.title}</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-paper/70">{s.story}</p>
            <div className="mt-5"><StageEvidence slug={s.slug} expanded /></div>
          </motion.div>
        </section>
      ))}
    </main>
  );
}
