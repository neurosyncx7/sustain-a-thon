import { NextResponse } from "next/server";
import { canDispatch, dispatch, pipelineRuns } from "@/lib/live";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ dispatch_enabled: canDispatch(), workflows: await pipelineRuns() }, { headers: { "cache-control": "no-store" } });
}

// Starts a real pipeline run on GitHub Actions. Guarded: only the two workflows below, never while
// one is already queued or running, and at most once per 10 minutes per server instance.
let lastDispatch = 0;
export async function POST(req: Request) {
  if (!canDispatch()) return NextResponse.json({ ok: false, error: "dispatch not configured" }, { status: 501 });
  const body = await req.json().catch(() => ({}));
  const workflow = body.workflow === "inventory.yml" ? "inventory.yml" : "live.yml";
  if (Date.now() - lastDispatch < 10 * 60e3) return NextResponse.json({ ok: false, error: "a run was started less than 10 minutes ago" }, { status: 429 });
  const runs = await pipelineRuns();
  const w = runs.find((r) => r.workflow === workflow);
  if (w?.ok && w.runs.some((r: any) => r.status === "queued" || r.status === "in_progress"))
    return NextResponse.json({ ok: false, error: "a run of this workflow is already in progress" }, { status: 409 });
  const res = await dispatch(workflow, workflow === "live.yml" ? { ingest: false } : {});
  if (res.ok) lastDispatch = Date.now();
  return NextResponse.json(res, { status: res.ok ? 202 : 502 });
}
