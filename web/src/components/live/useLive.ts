"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";

// One shared poller for /api/live: the HUD dot and the ledger's live panel read the same payload.
// Polls every 60 s while the tab is visible, immediately on focus; never invents a value.
type LiveState = { data?: any; error?: string; at?: number; subscribers: number };
const useStore = create<LiveState>(() => ({ subscribers: 0 }));
let timer: ReturnType<typeof setInterval> | null = null;
let inflight = false;

async function poll() {
  if (inflight || (typeof document !== "undefined" && document.visibilityState === "hidden")) return;
  inflight = true;
  try {
    const r = await fetch("/api/live", { cache: "no-store" });
    if (!r.ok) throw new Error(`${r.status}`);
    useStore.setState({ data: await r.json(), error: undefined, at: Date.now() });
  } catch (e) {
    useStore.setState({ error: e instanceof Error ? e.message : String(e), at: Date.now() });
  } finally {
    inflight = false;
  }
}

export function refreshLive() { return poll(); }

export function useLive() {
  const s = useStore();
  useEffect(() => {
    useStore.setState((x) => ({ subscribers: x.subscribers + 1 }));
    if (!timer) {
      poll();
      timer = setInterval(poll, 60_000);
      window.addEventListener("focus", poll);
    }
    return () => {
      useStore.setState((x) => ({ subscribers: x.subscribers - 1 }));
      if (useStore.getState().subscribers <= 0 && timer) {
        clearInterval(timer); timer = null;
        window.removeEventListener("focus", poll);
      }
    };
  }, []);
  return s;
}

/** "3 h ago" that re-renders every 30 s. */
export function useAgo(iso?: string | null) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30_000); return () => clearInterval(t); }, []);
  if (!iso) return null;
  const s = iso.replace(" ", "T");
  const t = Date.parse(s.endsWith("Z") || s.includes("+") ? s : s + "Z");
  if (!Number.isFinite(t)) return null;
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}
