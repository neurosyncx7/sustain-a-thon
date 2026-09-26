import { create } from "zustand";

export type CameraTargetRequest = {
  stationSlug: string;
  hotspotId?: string;
  nonce: number; // bump to re-trigger the same target (e.g. re-focus)
};

interface WorldState {
  activeStation: string;
  hoveredHotspot: string | null;
  isTweening: boolean;
  isLoading: boolean;
  cameraTarget: CameraTargetRequest | null;
  setActiveStation: (slug: string) => void;
  setHoveredHotspot: (id: string | null) => void;
  setTweening: (v: boolean) => void;
  setLoading: (v: boolean) => void;
  requestCameraTarget: (stationSlug: string, hotspotId?: string) => void;
}

export const useWorldStore = create<WorldState>((set, get) => ({
  activeStation: "orbit-overview",
  hoveredHotspot: null,
  isTweening: false,
  isLoading: true,
  cameraTarget: null,
  setActiveStation: (slug) => set({ activeStation: slug }),
  setHoveredHotspot: (id) => set({ hoveredHotspot: id }),
  setTweening: (v) => set({ isTweening: v }),
  setLoading: (v) => set({ isLoading: v }),
  requestCameraTarget: (stationSlug, hotspotId) =>
    set({
      cameraTarget: { stationSlug, hotspotId, nonce: (get().cameraTarget?.nonce ?? 0) + 1 },
    }),
}));
