"use client";

import { create } from "zustand";

// Client cache for the research API. Components call useApi("/api/months") and re-render when
// the real payload lands; nothing is ever defaulted to invented values while loading.
type Entry = { data?: any; error?: string; loading: boolean };
const useStore = create<{ entries: Record<string, Entry> }>(() => ({ entries: {} }));
const inflight = new Map<string, Promise<void>>();

function load(url: string) {
  if (inflight.has(url)) return;
  useStore.setState((s) => ({ entries: { ...s.entries, [url]: { loading: true } } }));
  inflight.set(url, fetch(url)
    .then(async (r) => {
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      const data = await r.json();
      useStore.setState((s) => ({ entries: { ...s.entries, [url]: { data, loading: false } } }));
    })
    .catch((e) => useStore.setState((s) => ({ entries: { ...s.entries, [url]: { error: String(e), loading: false } } }))));
}

export function useApi<T = any>(url: string): Entry & { data?: T } {
  const entry = useStore((s) => s.entries[url]);
  if (!entry && typeof window !== "undefined") queueMicrotask(() => load(url));
  return entry ?? { loading: true };
}

export function prefetch(urls: string[]) { urls.forEach(load); }
