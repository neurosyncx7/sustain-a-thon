import { NextResponse, type NextRequest } from "next/server";

// First line of defence for the API: per-IP rate limits (sign-in attempts are the strictest).
// Best effort: counters live in each server instance, so this blunts scraping and key guessing
// rather than replacing a platform firewall.
const LIMITS: [RegExp, string, number, number][] = [
  [/^\/api\/partner\/session$/, "POST", 5, 60_000],
  [/^\/api\/pipeline$/, "POST", 3, 600_000],
  [/^\/api\//, "*", 120, 60_000],
];
const hits = new Map<string, number[]>();

export function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const rule = LIMITS.find(([re, m]) => re.test(path) && (m === "*" || m === req.method));
  if (!rule) return NextResponse.next();
  const [re, , max, win] = rule;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
  const k = `${re.source}|${req.method}|${ip}`;
  const now = Date.now();
  const arr = (hits.get(k) ?? []).filter((t) => now - t < win);
  if (arr.length >= max) {
    return NextResponse.json({ error: "Too many requests; slow down." },
      { status: 429, headers: { "retry-after": String(Math.ceil((win - (now - arr[0])) / 1000)) } });
  }
  arr.push(now); hits.set(k, arr);
  if (hits.size > 5000) hits.clear();
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
