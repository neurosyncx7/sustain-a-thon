import "server-only";

// Live sources, fetched at request time and cached briefly by Next's data cache. Every source
// reports its own status and timestamp; a failed source is reported as failed, never filled in.
export const REPO = process.env.GITHUB_REPOSITORY ?? "neurosyncx7/sustain-a-thon";
const S3 = "https://meeo-s5p.s3.amazonaws.com";
const RAW = `https://raw.githubusercontent.com/${REPO}/data`;

export type Source<T> = { ok: true; fetched_utc: string; data: T } | { ok: false; fetched_utc: string; error: string };

const now = () => new Date().toISOString();

async function get<T>(url: string, init: RequestInit & { revalidate?: number; parse?: "json" | "text" } = {}): Promise<Source<T>> {
  const { revalidate = 300, parse = "json", ...rest } = init;
  try {
    const r = await fetch(url, { ...rest, next: { revalidate }, signal: AbortSignal.timeout(9000) });
    if (!r.ok) return { ok: false, fetched_utc: now(), error: `${r.status} ${r.statusText}` };
    const data = (parse === "json" ? await r.json() : await r.text()) as T;
    return { ok: true, fetched_utc: now(), data };
  } catch (e) {
    return { ok: false, fetched_utc: now(), error: e instanceof Error ? e.message : String(e) };
  }
}

function ghHeaders(): HeadersInit {
  const h: Record<string, string> = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

/** The pipeline's own newest processed pass (written every 3 h by .github/workflows/live.yml). */
export async function latestPass() {
  return get<any>(`${RAW}/live/latest.json`, { revalidate: 120 });
}

export async function passHistory() {
  return get<any[]>(`${RAW}/live/history.json`, { revalidate: 600 });
}

export const latestTextureUrl = `${RAW}/live/latest.png`;

/** Newest TROPOMI CH4 granules on the public mirror today (UTC), straight from the S3 listing. */
export async function mirrorToday(stream: "NRTI" | "OFFL" = "NRTI") {
  const d = new Date();
  const out: { key: string; start_utc: string; orbit: string }[] = [];
  let last: Source<string> | null = null;
  for (let back = 0; back < 3 && out.length === 0; back++) {
    const day = new Date(d.getTime() - back * 86400e3);
    const prefix = `${stream}/L2__CH4___/${day.toISOString().slice(0, 10).replaceAll("-", "/")}/`;
    last = await get<string>(`${S3}/?list-type=2&prefix=${encodeURIComponent(prefix)}&max-keys=1000`, { parse: "text", revalidate: 300 });
    if (!last.ok) break;
    for (const m of last.data.matchAll(/<Key>([^<]+\.nc)<\/Key>/g)) {
      const key = m[1];
      const t = key.match(/CH4____(\d{8}T\d{6})/)?.[1];
      const orbit = key.match(/_(\d{5})_\d{2}_\d{6}_\d{8}T\d{6}\.nc$/)?.[1] ?? "";
      if (t) out.push({ key, orbit, start_utc: `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}T${t.slice(9, 11)}:${t.slice(11, 13)}:${t.slice(13, 15)}Z` });
    }
  }
  if (!last || !last.ok) return { ok: false as const, fetched_utc: now(), error: last && !last.ok ? last.error : "no listing" };
  out.sort((a, b) => a.start_utc.localeCompare(b.start_utc));
  const india = out.filter((g) => { const h = +g.start_utc.slice(11, 13); return h >= 3 && h <= 11; });
  return { ok: true as const, fetched_utc: now(), data: { stream, granules_listed: out.length, newest: out.at(-1) ?? null, newest_over_india: india.at(-1) ?? null } };
}

/** Current 10 m wind at a set of sites (ECMWF/DWD blend via Open-Meteo forecast, keyless). */
export async function currentWinds(sites: { slug: string; lat: number; lon: number }[]) {
  if (!sites.length) return { ok: true as const, fetched_utc: now(), data: [] };
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${sites.map((s) => s.lat).join(",")}&longitude=${sites.map((s) => s.lon).join(",")}` +
    `&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms&timezone=UTC`;
  const r = await get<any>(url, { revalidate: 900 });
  if (!r.ok) return r;
  const arr = Array.isArray(r.data) ? r.data : [r.data];
  return { ok: true as const, fetched_utc: r.fetched_utc, data: sites.map((s, i) => ({ slug: s.slug, time_utc: arr[i]?.current?.time, speed_ms: arr[i]?.current?.wind_speed_10m, from_deg: arr[i]?.current?.wind_direction_10m })) };
}

export async function fxUsdInr() {
  return get<{ date: string; rates: { INR: number } }>("https://api.frankfurter.app/latest?from=USD&to=INR", { revalidate: 3600 });
}

const WORKFLOWS = ["live.yml", "inventory.yml", "extract-sites.yml", "extract-tropomi.yml"] as const;

export async function pipelineRuns() {
  const res = await Promise.all(WORKFLOWS.map((w) =>
    get<any>(`https://api.github.com/repos/${REPO}/actions/workflows/${w}/runs?per_page=3`, { headers: ghHeaders(), revalidate: 60 })));
  return WORKFLOWS.map((w, i) => {
    const r = res[i];
    if (!r.ok) return { workflow: w, ok: false as const, error: r.error };
    return {
      workflow: w, ok: true as const,
      runs: (r.data.workflow_runs ?? []).map((x: any) => ({
        id: x.id, status: x.status, conclusion: x.conclusion, event: x.event,
        created_utc: x.created_at, updated_utc: x.updated_at, url: x.html_url,
      })),
    };
  });
}

export const canDispatch = () => Boolean(process.env.GITHUB_DISPATCH_TOKEN);

export async function dispatch(workflow: "live.yml" | "inventory.yml", inputs: Record<string, string | boolean> = {}) {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) return { ok: false, error: "dispatch not configured" };
  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${workflow}/dispatches`, {
    method: "POST", cache: "no-store",
    headers: { ...ghHeaders(), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ref: "main", inputs }),
  });
  return r.status === 204 ? { ok: true } : { ok: false, error: `${r.status} ${await r.text()}` };
}
