import { getPartner, inventoryForRequest } from "@/lib/access";

export const dynamic = "force-dynamic";

// Plume stack image of one site: partner tier only (it shows the source's position and shape).
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(await getPartner())) return new Response("Partner sign-in required", { status: 403 });
  const { doc } = await inventoryForRequest(`stack/${slug}`);
  const s = doc.sites.find((x: any) => x.slug === slug);
  const b64 = s?.evidence?.stack?.png_b64;
  if (!b64) return new Response("not found", { status: 404 });
  return new Response(Buffer.from(b64, "base64"), { headers: { "content-type": "image/png", "cache-control": "private, no-store" } });
}
