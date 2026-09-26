import { latestTextureUrl } from "@/lib/live";

// Proxies the newest pass texture (8-bit XCH4 grid, 0 = no data) so the scene can sample it
// same-origin. Cached for 10 minutes; a missing texture is a 404, never a stand-in image.
export async function GET() {
  const r = await fetch(latestTextureUrl, { next: { revalidate: 600 } }).catch(() => null);
  if (!r || !r.ok) return new Response("no live texture yet", { status: 404 });
  return new Response(await r.arrayBuffer(), { headers: { "content-type": "image/png", "cache-control": "public, max-age=600" } });
}
