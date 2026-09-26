import "server-only";
import { createDecipheriv, createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { readJson } from "./data";

// Tiered disclosure (research/pipeline/protect.py explains why). Public visitors get the redacted
// inventory; a verified partner (pollution control board, regulator, accredited researcher) signs in
// with an access key issued to their organisation and gets the decrypted full evidence package.
//
//   PARTNER_KEYS    "org-slug:sha256(access key),org2:..."  (only hashes are stored server-side)
//   SESSION_SECRET  random secret that signs the partner session cookie
//   INVENTORY_KEY   base64 AES-256 key that decrypts data/inventory/inventory.enc.json
// With any of them missing the partner tier is simply unavailable, and the site says so.

const COOKIE = "vl_partner";
const TTL_S = 12 * 3600;

export const partnerTierConfigured = () =>
  Boolean(process.env.PARTNER_KEYS && process.env.SESSION_SECRET && process.env.INVENTORY_KEY);

function partners(): Map<string, string> {
  const m = new Map<string, string>();
  for (const part of (process.env.PARTNER_KEYS ?? "").split(",")) {
    const [org, hash] = part.trim().split(":");
    if (org && hash) m.set(hash.toLowerCase(), org);
  }
  return m;
}

/** Returns the organisation for a valid access key, comparing hashes in constant time. */
export function orgForKey(key: string): string | null {
  const h = createHash("sha256").update(key.trim()).digest();
  for (const [hash, org] of partners()) {
    const ref = Buffer.from(hash, "hex");
    if (ref.length === h.length && timingSafeEqual(ref, h)) return org;
  }
  return null;
}

const b64u = (b: Buffer) => b.toString("base64url");
const sign = (payload: string) => b64u(createHmac("sha256", process.env.SESSION_SECRET!).update(payload).digest());

export function sessionCookie(org: string) {
  const payload = b64u(Buffer.from(JSON.stringify({ org, exp: Math.floor(Date.now() / 1000) + TTL_S })));
  return {
    name: COOKIE, value: `${payload}.${sign(payload)}`,
    options: { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: "/", maxAge: TTL_S },
  };
}

export async function getPartner(): Promise<{ org: string; exp: number } | null> {
  if (!partnerTierConfigured()) return null;
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  const want = Buffer.from(sign(payload)), got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const p = JSON.parse(Buffer.from(payload, "base64url").toString());
    return p.exp > Date.now() / 1000 && partners().size && [...partners().values()].includes(p.org) ? p : null;
  } catch { return null; }
}

export const clearedCookie = { name: COOKIE, value: "", options: { path: "/", maxAge: 0 } };

let fullCache: { id: string; doc: any } | null = null;
function decryptInventory(env: any): any {
  if (fullCache && fullCache.id === env.iv) return fullCache.doc;
  const key = Buffer.from(process.env.INVENTORY_KEY!, "base64");
  const buf = Buffer.from(env.ct, "base64");
  const d = createDecipheriv("aes-256-gcm", key, Buffer.from(env.iv, "base64"));
  d.setAAD(Buffer.from(env.aad));
  d.setAuthTag(buf.subarray(buf.length - 16));
  const doc = JSON.parse(Buffer.concat([d.update(buf.subarray(0, buf.length - 16)), d.final()]).toString());
  fullCache = { id: env.iv, doc };
  return doc;
}

/** Structured audit line for every disclosure of partner-tier data (kept in the platform logs). */
export function audit(org: string, what: string) {
  console.log(JSON.stringify({ audit: "partner_access", org, what, at: new Date().toISOString() }));
}

/** The inventory at the caller's tier. `what` names the view for the audit log. */
export async function inventoryForRequest(what: string): Promise<{ doc: any; partner: string | null }> {
  const p = await getPartner();
  if (p) {
    try {
      const doc = decryptInventory(await readJson("inventory/inventory.enc.json"));
      audit(p.org, what);
      return { doc, partner: p.org };
    } catch (e) {
      console.error("partner inventory unavailable", e instanceof Error ? e.message : e);
    }
  }
  return { doc: await readJson("inventory/inventory_public.json"), partner: null };
}

/** Public-tier rounding for any coordinate that leaves the server outside the inventory. */
export const coarse = (x: number, step = 0.25) => Math.round(Math.round(x / step) * step * 100) / 100;
