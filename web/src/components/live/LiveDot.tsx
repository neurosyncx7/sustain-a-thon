"use client";

import Link from "next/link";
import { useAgo, useLive } from "./useLive";

// Header status: when did the satellite last see India, per the pipeline's own newest pass.
export function LiveDot({ className = "" }: { className?: string }) {
  const { data, error } = useLive();
  const pass = data?.latest_pass?.ok ? data.latest_pass.data : null;
  const ago = useAgo(pass?.sensing_end ?? null);
  const mirrorAgo = useAgo(data?.mirror?.ok ? data.mirror.data.newest_over_india?.start_utc : null);
  const live = Boolean(pass || mirrorAgo);
  const label = pass ? `Last pass over India ${ago}` : mirrorAgo ? `Newest orbit ${mirrorAgo}` : error ? "Live feed offline" : data ? "Awaiting first live pass" : "Connecting";
  return (
    <Link href="/ledger#live" aria-label={`Live status: ${label}`}
      className={`group flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] text-paper/70 ring-1 ring-paper/10 transition hover:bg-paper/[0.06] hover:text-paper ${className}`}>
      <span className="relative flex h-2 w-2">
        {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-flame/60 [animation-duration:2.4s]" />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${live ? "bg-flame" : error ? "bg-[#c58067]" : "bg-paper/40"}`} />
      </span>
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">Live</span>
    </Link>
  );
}
