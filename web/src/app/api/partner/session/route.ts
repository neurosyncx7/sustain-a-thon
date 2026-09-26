import { NextResponse } from "next/server";
import { audit, clearedCookie, getPartner, orgForKey, partnerTierConfigured, sessionCookie } from "@/lib/access";

export const dynamic = "force-dynamic";

// Partner sign-in: an access key issued to an organisation is exchanged for a signed, http-only,
// 12-hour session cookie. Keys are never stored, only their SHA-256; attempts are rate-limited in
// src/proxy.ts and every sign-in is written to the audit log.
export async function GET() {
  const p = await getPartner();
  return NextResponse.json({ configured: partnerTierConfigured(), partner: p ? { org: p.org, expires_utc: new Date(p.exp * 1000).toISOString() } : null },
    { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  if (!partnerTierConfigured()) return NextResponse.json({ ok: false, error: "The partner tier is not configured on this deployment." }, { status: 501 });
  const { key } = await req.json().catch(() => ({ key: "" }));
  const org = typeof key === "string" && key.length >= 16 && key.length <= 200 ? orgForKey(key) : null;
  if (!org) {
    console.warn(JSON.stringify({ audit: "partner_signin_failed", at: new Date().toISOString() }));
    await new Promise((r) => setTimeout(r, 600));        // flatten timing, slow guessing
    return NextResponse.json({ ok: false, error: "That access key is not recognised." }, { status: 401 });
  }
  audit(org, "sign-in");
  const res = NextResponse.json({ ok: true, org });
  const c = sessionCookie(org);
  res.cookies.set(c.name, c.value, c.options);
  return res;
}

export async function DELETE() {
  const p = await getPartner();
  if (p) audit(p.org, "sign-out");
  const res = NextResponse.json({ ok: true });
  res.cookies.set(clearedCookie.name, clearedCookie.value, clearedCookie.options);
  return res;
}
