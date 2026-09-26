"use client";

import dynamic from "next/dynamic";
import { ScrollDriver } from "./ScrollDriver";

const World = dynamic(() => import("./world/World").then((m) => m.World), { ssr: false });

export function Observatory() {
  return (
    <main className="relative bg-[#07080d] text-[#ece4d8]">
      <World />
      <ScrollDriver />
    </main>
  );
}
