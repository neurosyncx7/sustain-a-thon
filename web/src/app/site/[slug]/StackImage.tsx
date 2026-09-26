"use client";

import { useEffect, useRef } from "react";

// Renders the real wind-rotated stack (8-bit PNG, 128 = zero) with the site's diverging ramp.
export function StackImage({ src, xkm, ykm }: { src: string; xkm: [number, number]; ykm: [number, number] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const c = ref.current!; c.width = img.width; c.height = img.height;
      const ctx = c.getContext("2d")!; ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height);
      for (let i = 0; i < d.data.length; i += 4) {
        const v = d.data[i];
        if (v === 0) { d.data[i + 3] = 0; continue; }
        const s = (v - 128) / 127;
        const t = Math.abs(s) ** 0.8;
        const [r, g, b] = s >= 0 ? [16 + t * 96, 24 + t * 170, 40 + t * 215] : [26 + t * 40, 24, 30 + t * 6];
        d.data[i] = r; d.data[i + 1] = g; d.data[i + 2] = b; d.data[i + 3] = 255;
      }
      ctx.putImageData(d, 0, 0);
    };
    img.src = src;
  }, [src]);
  return (
    <figure>
      <canvas ref={ref} className="w-full rounded-xl [image-rendering:pixelated]" style={{ aspectRatio: `${xkm[1] - xkm[0]} / ${ykm[1] - ykm[0]}` }} />
      <figcaption className="mt-2 text-[12px] text-paper/55">Wind-rotated stack, wind blowing left to right; {xkm[0]} to {xkm[1]} km along wind, {ykm[0]} to {ykm[1]} km across. Blue = excess methane flux.</figcaption>
    </figure>
  );
}
