import { create } from "zustand";
import { STAGES } from "@/content/stages";

// `progress` changes every scroll frame, so components read it with useWorld.getState() inside
// useFrame (no React re-render). Only `stageIndex` and UI flags are subscribed by React.
export type Mode = "story" | "evidence";

interface WorldState {
  progress: number;          // 0..1 across all stages
  stageIndex: number;        // nearest stage
  mode: Mode;
  ready: boolean;            // scene assets compiled, loader may leave
  hovered: string | null;    // hovered instrument slug
  quality: 0 | 1 | 2;        // render tier chosen by the performance monitor (2 = full)
  setQuality: (q: 0 | 1 | 2) => void;
  setProgress: (p: number) => void;
  setMode: (m: Mode) => void;
  setReady: (r: boolean) => void;
  setHovered: (h: string | null) => void;
}

const N = STAGES.length;

export const useWorld = create<WorldState>((set, get) => ({
  progress: 0,
  stageIndex: 0,
  mode: "story",
  ready: false,
  hovered: null,
  quality: 2,
  setQuality: (quality) => set({ quality }),
  setProgress: (p) => {
    const stageIndex = Math.round(p * (N - 1));
    if (stageIndex !== get().stageIndex) set({ progress: p, stageIndex });
    else get().progress = p; // silent write, no subscribers notified
  },
  setMode: (mode) => set({ mode }),
  setReady: (ready) => set({ ready }),
  setHovered: (hovered) => set({ hovered }),
}));

// Scroll controller registered by the page so 3D clicks and nav can request a stage.
let scrollToStage: ((i: number) => void) | null = null;
export const registerScrollToStage = (fn: (i: number) => void) => (scrollToStage = fn);
export const goToStage = (i: number) => scrollToStage?.(i);
