"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { ScrollDriver } from "./ScrollDriver";
import { Hud } from "./hud/Hud";
import { Loader } from "./hud/Loader";
import { StaticObservatory } from "./StaticObservatory";
import { prefetch } from "@/lib/useData";

const World = dynamic(() => import("./world/World").then((m) => m.World), { ssr: false });

function canRun3D() {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2");
    if (!gl) return false;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const small = Math.min(window.innerWidth, window.innerHeight) < 560;
    const lowMem = (navigator as any).deviceMemory !== undefined && (navigator as any).deviceMemory < 4;
    return !(coarse && small) && !lowMem;
  } catch { return false; }
}

export function Observatory() {
  const [mode, setMode] = useState<"pending" | "3d" | "static">("pending");
  useEffect(() => {
    prefetch(["/api/overview", "/api/months", "/api/maps", "/api/candidates", "/api/sites", "/api/sites/jawaharnagar"]);
    const forced = new URLSearchParams(location.search).get("render");
    setMode(forced === "static" ? "static" : forced === "3d" ? "3d" : canRun3D() ? "3d" : "static");
  }, []);
  if (mode === "pending") return <main className="min-h-[100dvh] bg-ink" />;
  if (mode === "static") return <StaticObservatory />;
  return (
    <main className="relative bg-ink text-paper">
      <Loader />
      <World />
      <Hud />
      <ScrollDriver />
    </main>
  );
}
